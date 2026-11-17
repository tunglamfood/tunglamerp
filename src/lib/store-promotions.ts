// Promotions shown on the dealer portal and applied by the database when a portal
// order is placed (portal_place_order → sales_promo_for).
import "server-only";
import { serverSupabase } from "./supabase-server";
import { fail } from "./db-error";

export interface Promotion {
  id?: number;
  titleEn: string;
  titleMs: string | null;
  titleZh: string | null;
  itemCode: string;
  kind: "price" | "percent";
  value: number;
  minQty: number;
  customerCode: string | null;
  groupCode: string | null;
  startsOn: string;
  endsOn: string | null;
  active: boolean;
}

type Row = {
  id: number; title_en: string; title_ms: string | null; title_zh: string | null; item_code: string;
  kind: "price" | "percent"; value: number; min_qty: number; customer_code: string | null; group_code: string | null;
  starts_on: string; ends_on: string | null; active: boolean;
};

export async function listPromotions(): Promise<Promotion[]> {
  const { data, error } = await serverSupabase()
    .from("sales_promotions").select("*").order("starts_on", { ascending: false }).order("id", { ascending: false });
  fail("Could not load the promotions", error);
  return ((data ?? []) as Row[]).map((r) => ({
    id: r.id, titleEn: r.title_en, titleMs: r.title_ms, titleZh: r.title_zh, itemCode: r.item_code,
    kind: r.kind, value: Number(r.value), minQty: r.min_qty, customerCode: r.customer_code, groupCode: r.group_code,
    startsOn: r.starts_on, endsOn: r.ends_on, active: r.active,
  }));
}

export async function savePromotion(p: Promotion): Promise<void> {
  const row = {
    title_en: p.titleEn, title_ms: p.titleMs, title_zh: p.titleZh, item_code: p.itemCode,
    kind: p.kind, value: p.value, min_qty: p.minQty,
    customer_code: p.customerCode, group_code: p.customerCode ? null : p.groupCode,
    starts_on: p.startsOn, ends_on: p.endsOn, active: p.active, updated_at: new Date().toISOString(),
  };
  const db = serverSupabase();
  const { error } = p.id
    ? await db.from("sales_promotions").update(row).eq("id", p.id)
    : await db.from("sales_promotions").insert(row);
  fail("Could not save that promotion", error);
}

export async function deletePromotion(id: number): Promise<void> {
  const { error } = await serverSupabase().from("sales_promotions").delete().eq("id", id);
  fail("Could not remove that promotion", error);
}
