// Production setup (lines, how each item is supplied, batches, recipes) and the
// saved daily plans (manual stock/extra, the locked quantities, actual output and lots).
import "server-only";
import { serverSupabase } from "./supabase-server";
import { fail } from "./db-error";
import type { Mode, Override, ProdItem, ProdLine, RecipeLine } from "./production";

/* ── Setup ─────────────────────────────────────────────────────────────────── */

export async function listLines(): Promise<ProdLine[]> {
  const { data, error } = await serverSupabase().from("prod_lines").select("*").order("sort");
  fail("Could not load the production lines", error);
  return ((data ?? []) as ProdLine[]).map((l) => ({ code: l.code, name: l.name, sort: l.sort, active: l.active }));
}

export async function saveLine(l: ProdLine): Promise<void> {
  const { error } = await serverSupabase().from("prod_lines").upsert({ code: l.code, name: l.name, sort: l.sort, active: l.active });
  fail("Could not save that line", error);
}

export async function deleteLine(code: string): Promise<void> {
  const { error } = await serverSupabase().from("prod_lines").delete().eq("code", code);
  fail("Could not remove that line", error);
}

type ItemRow = {
  item_code: string; mode: Mode; makes_item: string | null; units_per: number; line_code: string | null;
  batch_size: number | null; min_run: number | null; buffer_pct: number; shelf_life_days: number | null;
  recipe_yield: number | null; sort: number;
};
const num = (v: number | null) => (v == null ? null : Number(v));

export async function listItems(): Promise<ProdItem[]> {
  const { data, error } = await serverSupabase().from("prod_items").select("*").limit(5000);
  fail("Could not load the production setup", error);
  return ((data ?? []) as ItemRow[]).map((r) => ({
    itemCode: r.item_code, mode: r.mode, makesItem: r.makes_item, unitsPer: Number(r.units_per), lineCode: r.line_code,
    batchSize: num(r.batch_size), minRun: num(r.min_run), bufferPct: Number(r.buffer_pct), shelfLifeDays: r.shelf_life_days,
    recipeYield: num(r.recipe_yield), sort: r.sort,
  }));
}

export async function listRecipes(): Promise<RecipeLine[]> {
  const { data, error } = await serverSupabase().from("prod_recipe_lines").select("*").order("sort").limit(10000);
  fail("Could not load the recipes", error);
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    itemCode: r.item_code as string, ingredient: r.ingredient as string, qty: Number(r.qty), uom: (r.uom as string) ?? "",
    prepBefore: !!r.prep_before, note: (r.note as string) ?? null, sort: r.sort as number,
  }));
}

/** Saves how one item is supplied; for a product made here, also its recipe (replaced whole). */
export async function saveItem(i: ProdItem, recipe: RecipeLine[] | null): Promise<void> {
  const db = serverSupabase();
  const { error } = await db.from("prod_items").upsert({
    item_code: i.itemCode, mode: i.mode,
    makes_item: i.makesItem && i.makesItem !== i.itemCode ? i.makesItem : null,
    units_per: i.unitsPer, line_code: i.lineCode, batch_size: i.batchSize, min_run: i.minRun,
    buffer_pct: i.bufferPct, shelf_life_days: i.shelfLifeDays, recipe_yield: i.recipeYield, sort: i.sort,
    updated_at: new Date().toISOString(),
  });
  fail(`Could not save ${i.itemCode}`, error);
  if (recipe) {
    const { error: wipe } = await db.from("prod_recipe_lines").delete().eq("item_code", i.itemCode);
    fail("Could not update the recipe", wipe);
    if (recipe.length) {
      const { error: ins } = await db.from("prod_recipe_lines").insert(recipe.map((r, n) => ({
        item_code: i.itemCode, ingredient: r.ingredient, qty: r.qty, uom: r.uom, prep_before: r.prepBefore, note: r.note, sort: n,
      })));
      fail("Could not save the recipe", ins);
    }
  }
}

export interface ProdSettings { cutoffHour: number | null; includePending: boolean }

export async function getSettings(): Promise<ProdSettings> {
  const { data } = await serverSupabase().from("prod_settings").select("*").eq("id", 1).maybeSingle();
  return { cutoffHour: data?.cutoff_hour ?? null, includePending: data?.include_pending ?? true };
}

export async function saveSettings(s: ProdSettings): Promise<void> {
  const { error } = await serverSupabase().from("prod_settings").upsert({ id: 1, cutoff_hour: s.cutoffHour, include_pending: s.includePending, updated_at: new Date().toISOString() });
  fail("Could not save the settings", error);
}

/* ── Plans ─────────────────────────────────────────────────────────────────── */

export interface PlanLineRecord {
  itemCode: string; orderedQty: number; stockQty: number; extraQty: number; planQty: number; batches: number | null;
  actualQty: number | null; wasteQty: number | null; lotNo: string | null; producedOn: string | null; expiryDate: string | null; note: string | null;
}
export interface SavedPlan { id: number; deliveryDate: string; status: "draft" | "locked" | "done"; lockedAt: string | null; lockedBy: string | null; note: string | null; lines: PlanLineRecord[] }

export async function getPlan(delivery: string): Promise<SavedPlan | null> {
  const db = serverSupabase();
  const { data: p, error } = await db.from("prod_plans").select("*").eq("delivery_date", delivery).maybeSingle();
  fail("Could not load the plan", error);
  if (!p) return null;
  const { data: ls, error: le } = await db.from("prod_plan_lines").select("*").eq("plan_id", p.id);
  fail("Could not load the plan lines", le);
  return {
    id: p.id, deliveryDate: p.delivery_date, status: p.status, lockedAt: p.locked_at, lockedBy: p.locked_by, note: p.note,
    lines: ((ls ?? []) as Record<string, unknown>[]).map((r) => ({
      itemCode: r.item_code as string, orderedQty: Number(r.ordered_qty), stockQty: Number(r.stock_qty), extraQty: Number(r.extra_qty),
      planQty: Number(r.plan_qty), batches: num(r.batches as number | null), actualQty: num(r.actual_qty as number | null),
      wasteQty: num(r.waste_qty as number | null), lotNo: (r.lot_no as string) ?? null, producedOn: (r.produced_on as string) ?? null,
      expiryDate: (r.expiry_date as string) ?? null, note: (r.note as string) ?? null,
    })),
  };
}

async function ensurePlan(delivery: string): Promise<{ id: number; status: string }> {
  const db = serverSupabase();
  const { data } = await db.from("prod_plans").select("id, status").eq("delivery_date", delivery).maybeSingle();
  if (data) return data as { id: number; status: string };
  const { data: made, error } = await db.from("prod_plans").insert({ delivery_date: delivery }).select("id, status").single();
  fail("Could not start the plan", error);
  return made as { id: number; status: string };
}

/** Stock carried over and manual top-ups, kept while the plan is still a draft. */
export async function saveOverrides(delivery: string, overrides: Record<string, Override>): Promise<void> {
  const plan = await ensurePlan(delivery);
  if (plan.status !== "draft") throw new Error("This plan is locked. Unlock it first to change it.");
  const rows = Object.entries(overrides).map(([item_code, o]) => ({ plan_id: plan.id, item_code, stock_qty: o.stockQty || 0, extra_qty: o.extraQty || 0 }));
  if (!rows.length) return;
  const { error } = await serverSupabase().from("prod_plan_lines").upsert(rows, { onConflict: "plan_id,item_code" });
  fail("Could not save the plan", error);
}

/** Locks the plan with the quantities worked out now; the factory works to these. */
export async function lockPlan(
  delivery: string,
  rows: { itemCode: string; ordered: number; stock: number; extra: number; plan: number; batches: number | null }[],
  by: string,
): Promise<void> {
  const db = serverSupabase();
  const plan = await ensurePlan(delivery);
  if (plan.status !== "draft") throw new Error("This plan is already locked.");
  if (rows.length) {
    const { error } = await db.from("prod_plan_lines").upsert(rows.map((r) => ({
      plan_id: plan.id, item_code: r.itemCode, ordered_qty: r.ordered, stock_qty: r.stock, extra_qty: r.extra, plan_qty: r.plan, batches: r.batches,
    })), { onConflict: "plan_id,item_code" });
    fail("Could not lock the plan", error);
  }
  const { error } = await db.from("prod_plans").update({ status: "locked", locked_at: new Date().toISOString(), locked_by: by, updated_at: new Date().toISOString() }).eq("id", plan.id);
  fail("Could not lock the plan", error);
}

export async function setPlanStatus(delivery: string, status: "draft" | "locked" | "done"): Promise<void> {
  const { error } = await serverSupabase().from("prod_plans").update({ status, updated_at: new Date().toISOString(), ...(status === "draft" ? { locked_at: null, locked_by: null } : {}) }).eq("delivery_date", delivery);
  fail("Could not change the plan", error);
}

/** What was really made, with its lot number and expiry date. */
export async function recordOutput(
  delivery: string,
  r: { itemCode: string; actualQty: number | null; wasteQty: number | null; lotNo: string | null; producedOn: string | null; expiryDate: string | null; note: string | null },
): Promise<void> {
  const plan = await ensurePlan(delivery);
  if (plan.status === "draft") throw new Error("Lock the plan before recording what was made.");
  const { error } = await serverSupabase().from("prod_plan_lines").upsert({
    plan_id: plan.id, item_code: r.itemCode, actual_qty: r.actualQty, waste_qty: r.wasteQty, lot_no: r.lotNo,
    produced_on: r.producedOn, expiry_date: r.expiryDate, note: r.note,
  }, { onConflict: "plan_id,item_code" });
  fail("Could not save what was made", error);
}

/* ── Lots ──────────────────────────────────────────────────────────────────── */

export interface LotRecord { lotNo: string; itemCode: string; deliveryDate: string; producedOn: string | null; expiryDate: string | null; actualQty: number | null }

/** Lots recorded, newest first; with a query, only lots whose number contains it. */
export async function findLots(query: string | null, limit = 40): Promise<LotRecord[]> {
  let q = serverSupabase()
    .from("prod_plan_lines")
    .select("lot_no, item_code, produced_on, expiry_date, actual_qty, prod_plans!inner(delivery_date)")
    .not("lot_no", "is", null)
    .order("produced_on", { ascending: false })
    .limit(limit);
  if (query) q = q.ilike("lot_no", `%${query.replace(/[%_]/g, "")}%`);
  const { data, error } = await q;
  fail("Could not look up the lots", error);
  return ((data ?? []) as Record<string, unknown>[]).map((r) => {
    const plan = (Array.isArray(r.prod_plans) ? r.prod_plans[0] : r.prod_plans) as { delivery_date: string };
    return {
      lotNo: r.lot_no as string, itemCode: r.item_code as string, deliveryDate: plan.delivery_date,
      producedOn: (r.produced_on as string) ?? null, expiryDate: (r.expiry_date as string) ?? null, actualQty: r.actual_qty == null ? null : Number(r.actual_qty),
    };
  });
}
