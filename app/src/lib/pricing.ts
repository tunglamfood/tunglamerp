// What a dealer pays for a product on a given day.
//
// The same item costs a different price to every dealer, and those prices move.
// Rather than overwriting, each change is a new row with the date it starts, so
// an order written last month keeps the price it was actually sold at.
import { PriceRow, Product } from "./types";

/**
 * The price in force for one dealer and one product on `onDate`: the newest
 * row dated on or before that day. Falls back to the product's own list price,
 * and finally to zero, which the order screen shows as "no price set".
 */
export function priceFor(
  customerCode: string,
  item: Product | undefined,
  prices: PriceRow[],
  onDate: string,
): { price: number; source: "dealer" | "list" | "none"; from?: string } {
  let best: PriceRow | undefined;
  for (const row of prices) {
    if (row.customerCode !== customerCode) continue;
    if (row.itemCode !== (item?.itemCode ?? "")) continue;
    if (row.effectiveFrom > onDate) continue; // not started yet
    if (!best || row.effectiveFrom > best.effectiveFrom) best = row;
  }
  if (best) return { price: best.price, source: "dealer", from: best.effectiveFrom };
  if (item && item.basePrice > 0) return { price: item.basePrice, source: "list" };
  return { price: 0, source: "none" };
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
