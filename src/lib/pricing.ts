// What a dealer pays for a product on a given day.
//
// The same item costs a different price to every dealer, and those prices move.
// Rather than overwriting, each change is a new row with the date it starts, so
// an order written last month keeps the price it was actually sold at.
import { PriceRow, Product } from "./types";

/**
 * The price in force for one dealer and one product on `onDate`: the newest
 * row dated on or before that day — the dealer's own first, then their group's.
 * Falls back to the product's own list price, and finally to zero, which the
 * order screen shows as "no price set".
 *
 * The database has the same rule as sales_price_for(), which the dealer portal
 * uses — keep the two in step.
 */
export function priceFor(
  customerCode: string,
  item: Product | undefined,
  prices: PriceRow[],
  onDate: string,
  groupCode?: string | null,
): { price: number; source: "dealer" | "group" | "list" | "none"; from?: string } {
  const newest = (match: (row: PriceRow) => boolean) => {
    let best: PriceRow | undefined;
    for (const row of prices) {
      if (!match(row)) continue;
      if (row.itemCode !== (item?.itemCode ?? "")) continue;
      if (row.effectiveFrom > onDate) continue; // not started yet
      if (!best || row.effectiveFrom > best.effectiveFrom) best = row;
    }
    return best;
  };
  const own = newest((row) => row.customerCode === customerCode);
  if (own) return { price: own.price, source: "dealer", from: own.effectiveFrom };
  if (groupCode) {
    const shared = newest((row) => !row.customerCode && row.groupCode === groupCode);
    if (shared) return { price: shared.price, source: "group", from: shared.effectiveFrom };
  }
  if (item && item.basePrice > 0) return { price: item.basePrice, source: "list" };
  return { price: 0, source: "none" };
}

/** A promotion as the order screen needs it (see Sales → Promotions). */
export interface PromoRule {
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

/**
 * The best promotion price for this dealer, item and quantity on a day — the same rule
 * the database applies to portal orders (sales_promo_for). Null when none applies.
 */
export function promoFor(
  customerCode: string,
  groupCode: string | null | undefined,
  itemCode: string,
  qty: number,
  onDate: string,
  basePrice: number,
  promos: PromoRule[],
): number | null {
  let best: number | null = null;
  for (const p of promos) {
    if (!p.active || p.itemCode !== itemCode) continue;
    if (p.startsOn > onDate || (p.endsOn && p.endsOn < onDate)) continue;
    if (p.customerCode && p.customerCode !== customerCode) continue;
    if (p.groupCode && p.groupCode !== (groupCode ?? null)) continue;
    if (qty < p.minQty) continue;
    const price = p.kind === "price" ? p.value : basePrice > 0 ? Math.round(basePrice * (1 - p.value / 100) * 100) / 100 : 0;
    if (price > 0 && (best === null || price < best)) best = price;
  }
  return best;
}

/** The dealer's own price, unless a promotion for this quantity is lower. */
export function priceWithPromo(
  customerCode: string,
  item: Product | undefined,
  qty: number,
  prices: PriceRow[],
  promos: PromoRule[],
  onDate: string,
  groupCode?: string | null,
): { price: number; source: "dealer" | "group" | "list" | "none" | "promo" } {
  const base = priceFor(customerCode, item, prices, onDate, groupCode);
  if (!item) return base;
  const promo = promoFor(customerCode, groupCode, item.itemCode, qty, onDate, base.price, promos);
  if (promo !== null && (base.price <= 0 || promo < base.price)) return { price: promo, source: "promo" };
  return base;
}

/** Every dealer price for one product, newest first — for the product screen. */
export function pricesForItem(itemCode: string, prices: PriceRow[]): PriceRow[] {
  return prices
    .filter((p) => p.itemCode === itemCode)
    .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
}

/** The current price list for one dealer: one row per product, newest wins. */
export function currentListFor(
  customerCode: string,
  prices: PriceRow[],
  onDate: string,
): Map<string, PriceRow> {
  const out = new Map<string, PriceRow>();
  for (const row of prices) {
    if (row.customerCode !== customerCode) continue;
    if (row.effectiveFrom > onDate) continue;
    const held = out.get(row.itemCode);
    if (!held || row.effectiveFrom > held.effectiveFrom) out.set(row.itemCode, row);
  }
  return out;
}

export function lineAmount(qty: number, price: number): number {
  return Math.round(qty * price * 100) / 100;
}

export function orderTotal(lines: { qty: number; price: number }[]): number {
  return Math.round(lines.reduce((s, l) => s + l.qty * l.price, 0) * 100) / 100;
}

/** SO-2026-09-0007 — sortable, and readable down a phone line. */
export function nextOrderNo(existing: string[], onDate: string): string {
  const prefix = `SO-${onDate.slice(0, 7)}-`;
  let highest = 0;
  for (const no of existing) {
    if (!no.startsWith(prefix)) continue;
    const n = Number(no.slice(prefix.length));
    if (Number.isFinite(n) && n > highest) highest = n;
  }
  return `${prefix}${String(highest + 1).padStart(4, "0")}`;
}
