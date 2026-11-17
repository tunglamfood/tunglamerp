// The daily production plan: plain arithmetic on orders already loaded, so it can
// be tested without a database.
//
//   orders for one delivery date (confirmed — and, if asked, still waiting)
//   → each line converted to what the factory makes (a carton of 180 = 180 tubes)
//   → + buffer % + any manual extra − usable stock carried over
//   → at least the minimum run, rounded up to whole batches
//   → raw materials from the recipe, with "before production" prep (soaking) first.
// Bought-in goods are listed for picking; they are not produced.
import type { Product, SalesOrder } from "./types";

export type Mode = "make" | "buy" | "none";

export interface ProdItem {
  itemCode: string;
  mode: Mode;
  makesItem: string | null;
  unitsPer: number;
  lineCode: string | null;
  batchSize: number | null;
  minRun: number | null;
  bufferPct: number;
  shelfLifeDays: number | null;
  recipeYield: number | null;
  sort: number;
}

export interface ProdLine { code: string; name: string; sort: number; active: boolean }
export interface RecipeLine { itemCode: string; ingredient: string; qty: number; uom: string; prepBefore: boolean; note: string | null; sort: number }
export interface Override { stockQty: number; extraQty: number }

export interface Source { orderNo: string; customer: string; qty: number; pending: boolean; late: boolean }
export interface PlanRow {
  itemCode: string;
  description: string;
  lineCode: string | null;
  ordered: number;
  buffer: number;
  extra: number;
  stock: number;
  need: number;
  batches: number | null;
  plan: number;
  sources: Source[];
  /** Made here but never set up — counted as itself, no line, no batches. */
  notSetUp: boolean;
}
export interface BoughtRow { itemCode: string; description: string; uom: string; qty: number; sources: Source[] }
export interface Ingredient { ingredient: string; description: string; uom: string; qty: number; prepBefore: boolean; forItems: string[] }

export interface Plan {
  rows: PlanRow[];
  bought: BoughtRow[];
  ingredients: Ingredient[];
  orders: number;
  dealers: number;
  pending: number;
  late: number;
  noDate: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86400_000).toISOString().slice(0, 10);

/** Made here, bought in or not a product — from the item group when nobody has said. */
export function defaultMode(p: Pick<Product, "itemGroup" | "itemCode"> | undefined): Mode {
  if (!p) return "none";
  const g = (p.itemGroup ?? "").toUpperCase();
  if (g === "TRADING") return "buy";
  if (["KB", "KL", "TOFU", "SOYA MILK", "TAUGEH"].includes(g)) return "make";
  return "none";
}

/** The delivery date an order counts for: its own, or the day after it was taken. */
export const deliveryOf = (o: Pick<SalesOrder, "deliverOn" | "orderDate">) => o.deliverOn ?? addDays(o.orderDate, 1);

/**
 * True when a portal order came in after the cut-off for its delivery day
 * (cutoffHour on the day before delivery, Malaysian time).
 */
export function isLate(o: Pick<SalesOrder, "submittedAt">, delivery: string, cutoffHour: number | null): boolean {
  if (cutoffHour == null || !o.submittedAt) return false;
  const cutoff = Date.parse(`${addDays(delivery, -1)}T${String(cutoffHour).padStart(2, "0")}:00:00+08:00`);
  return Date.parse(o.submittedAt) > cutoff;
}

export function buildPlan({
  orders, products, items, recipes, lines, overrides = {}, delivery, includePending, cutoffHour = null, names = {},
}: {
  orders: SalesOrder[];
  products: Product[];
  items: ProdItem[];
  recipes: RecipeLine[];
  lines: ProdLine[];
  overrides?: Record<string, Override>;
  delivery: string;
  includePending: boolean;
  cutoffHour?: number | null;
  names?: Record<string, string>;
}): Plan {
  const product = new Map(products.map((p) => [p.itemCode, p]));
  const setup = new Map(items.map((i) => [i.itemCode, i]));
  const desc = (code: string) => product.get(code)?.description ?? code;

  const counted = orders.filter((o) => {
    if (deliveryOf(o) !== delivery) return false;
    if (o.status === "confirmed" || o.status === "delivered") return true;
    return includePending && (o.status === "submitted" || o.status === "on_hold");
  });

  const rows = new Map<string, PlanRow>();
  const bought = new Map<string, BoughtRow>();
  const dealers = new Set<string>();
  let pending = 0, late = 0, noDate = 0;

  for (const o of counted) {
    const isPending = o.status === "submitted" || o.status === "on_hold";
    const isLateOrder = isLate(o, delivery, cutoffHour);
    if (isPending) pending++;
    if (isLateOrder) late++;
    if (!o.deliverOn) noDate++;
    for (const l of o.lines) {
      if (!l.itemCode || !(l.qty > 0)) continue;
      const customer = l.outletCode || o.customerCode || o.groupCode || "?";
      dealers.add(customer);
      const src = { orderNo: o.orderNo, customer: names[customer] ?? customer, pending: isPending, late: isLateOrder };
      const s = setup.get(l.itemCode);
      const mode = s?.mode ?? defaultMode(product.get(l.itemCode));
      if (mode === "none") continue;
      if (mode === "buy") {
        const b = bought.get(l.itemCode) ?? { itemCode: l.itemCode, description: desc(l.itemCode), uom: l.uom, qty: 0, sources: [] };
        b.qty = round2(b.qty + l.qty);
        b.sources.push({ ...src, qty: l.qty });
        bought.set(l.itemCode, b);
        continue;
      }
      const base = s?.makesItem || l.itemCode;
      const qty = l.qty * (s?.unitsPer ?? 1);
      const baseSetup = setup.get(base);
      const row = rows.get(base) ?? {
        itemCode: base, description: desc(base), lineCode: baseSetup?.lineCode ?? null,
        ordered: 0, buffer: 0, extra: 0, stock: 0, need: 0, batches: null, plan: 0, sources: [],
        notSetUp: !baseSetup,
      };
      row.ordered = round2(row.ordered + qty);
      row.sources.push({ ...src, qty });
      rows.set(base, row);
    }
  }

  // Items with a manual top-up but no orders still get made.
  for (const [code, ov] of Object.entries(overrides)) {
    if (rows.has(code) || !(ov.extraQty > 0)) continue;
    const s = setup.get(code);
    rows.set(code, { itemCode: code, description: desc(code), lineCode: s?.lineCode ?? null, ordered: 0, buffer: 0, extra: 0, stock: 0, need: 0, batches: null, plan: 0, sources: [], notSetUp: !s });
  }

  for (const row of rows.values()) {
    const s = setup.get(row.itemCode);
    const ov = overrides[row.itemCode];
    row.buffer = row.ordered > 0 && s?.bufferPct ? Math.ceil((row.ordered * s.bufferPct) / 100) : 0;
    row.extra = ov?.extraQty ?? 0;
    row.stock = ov?.stockQty ?? 0;
    let need = Math.max(0, row.ordered + row.buffer + row.extra - row.stock);
    if (need > 0 && s?.minRun) need = Math.max(need, s.minRun);
    row.need = round2(need);
    if (s?.batchSize && need > 0) {
      row.batches = Math.ceil(need / s.batchSize - 1e-9);
      row.plan = round2(row.batches * s.batchSize);
    } else {
      row.batches = s?.batchSize ? 0 : null;
      row.plan = Math.ceil(need - 1e-9);
    }
  }

  // Raw materials: each recipe makes recipe_yield (or one batch) of the product.
  const ing = new Map<string, Ingredient>();
  for (const row of rows.values()) {
    if (!(row.plan > 0)) continue;
    const s = setup.get(row.itemCode);
    const yieldUnits = s?.recipeYield || s?.batchSize;
    if (!yieldUnits) continue;
    for (const r of recipes.filter((x) => x.itemCode === row.itemCode)) {
      const key = `${r.ingredient}|${r.uom}|${r.prepBefore}`;
      const cur = ing.get(key) ?? { ingredient: r.ingredient, description: desc(r.ingredient), uom: r.uom, qty: 0, prepBefore: r.prepBefore, forItems: [] };
      cur.qty = round2(cur.qty + (r.qty * row.plan) / yieldUnits);
      if (!cur.forItems.includes(row.itemCode)) cur.forItems.push(row.itemCode);
      ing.set(key, cur);
    }
  }

  const lineSort = new Map(lines.map((l) => [l.code, l.sort]));
  const order = (r: PlanRow) => [lineSort.get(r.lineCode ?? "") ?? 9999, setup.get(r.itemCode)?.sort ?? 0] as const;
  const sorted = [...rows.values()].sort((a, b) => {
    const [la, sa] = order(a), [lb, sb] = order(b);
    return la - lb || sa - sb || a.description.localeCompare(b.description);
  });

  return {
    rows: sorted,
    bought: [...bought.values()].sort((a, b) => a.description.localeCompare(b.description)),
    ingredients: [...ing.values()].sort((a, b) => Number(b.prepBefore) - Number(a.prepBefore) || a.description.localeCompare(b.description)),
    orders: counted.length,
    dealers: dealers.size,
    pending,
    late,
    noDate,
  };
}

/** A lot number for one product on one production day: 261118-EGG-TL120. */
export function lotNo(producedOn: string, lineCode: string | null, itemCode: string): string {
  return `${producedOn.slice(2).replace(/-/g, "")}-${lineCode ?? "X"}-${itemCode}`.toUpperCase();
}

export function expiryOf(producedOn: string, shelfLifeDays: number | null): string | null {
  return shelfLifeDays ? addDays(producedOn, shelfLifeDays) : null;
}

/** The Chinese calendar month and day of a date (1 = 初一, 15 = 十五). */
export function lunarDate(iso: string): { month: number; day: number } | null {
  try {
    const parts = new Intl.DateTimeFormat("en-u-ca-chinese", { month: "numeric", day: "numeric", timeZone: "UTC" })
      .formatToParts(new Date(`${iso}T00:00:00Z`));
    const month = parseInt(parts.find((p) => p.type === "month")?.value ?? "", 10);
    const day = parseInt(parts.find((p) => p.type === "day")?.value ?? "", 10);
    return Number.isFinite(month) && Number.isFinite(day) ? { month, day } : null;
  } catch {
    return null;
  }
}

/**
 * Things worth knowing before planning a delivery day: 初一 / 十五 (vegetarian days, when
 * tofu sells more — shops stock up the day before), the Chinese New Year season, and
 * public holidays on the day or the day after.
 */
export function dayNotes(delivery: string, holidays: { onDate: string; name: string }[] = []): string[] {
  const notes: string[] = [];
  const today = lunarDate(delivery);
  const tomorrow = lunarDate(addDays(delivery, 1));
  if (today?.day === 1 || today?.day === 15) {
    notes.push(`${today.day === 1 ? "初一" : "十五"} — the ${today.day === 1 ? "1st" : "15th"} of the lunar month: many customers eat vegetarian, so tofu sells more. Consider a bigger buffer.`);
  } else if (tomorrow?.day === 1 || tomorrow?.day === 15) {
    notes.push(`The day before ${tomorrow.day === 1 ? "初一" : "十五"}: shops stock up for the vegetarian day. Orders often come in late — keep a buffer.`);
  }
  if (today && ((today.month === 12 && today.day >= 15) || (today.month === 1 && today.day <= 15))) {
    notes.push("Chinese New Year season: demand runs high and the factory may close for some days — plan the last delivery before the break.");
  }
  for (const h of holidays) {
    if (h.onDate === delivery) notes.push(`Public holiday on this delivery day: ${h.name}.`);
    else if (h.onDate === addDays(delivery, 1)) notes.push(`Public holiday the next day (${h.name}): shops may order extra.`);
  }
  return notes;
}
