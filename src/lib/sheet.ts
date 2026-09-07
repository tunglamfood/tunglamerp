// The order form the factory picks and packs from.
//
// One sheet, three readers. Down the left are the items; across are the
// outlets. Packing reads a column — what goes on whose lorry. Manufacturing
// reads the Total column — how much to make in all. The office reads the money
// line at the foot of each column and checks it against that outlet's invoice.
//
// Everything here is arithmetic on plain data, so it can be tested without a
// database or a screen — and it is, against the real 07/09 sheet.
import { OrderBatch, OrderLine, PriceRow, Product } from "./types";
import { priceFor } from "./pricing";

/** A column on the sheet: one outlet, or the single customer buying alone. */
export interface SheetOutlet {
  code: string;
  /** SNW, SMY — what the office writes at the head of the column. */
  short: string;
  name: string;
}

/** A row: one item, its quantity in each column, and the batch it was packed from. */
export interface SheetRow {
  itemCode: string;
  /** What the sheet calls it, which is not always what Million calls it. */
  label: string;
  packSize: string;
  uom: string;
  price: number;
  /** Outlet code to quantity. An outlet missing from here ordered none. */
  qty: Record<string, number>;
  batchCode: string;
  batchConfirmed: boolean;
}

export interface SheetTotals {
  /** Per item, added across every outlet — what manufacturing makes. */
  perItem: Record<string, number>;
  /** Per outlet: how many bags, and what they come to. */
  perOutlet: Record<string, { qty: number; amount: number }>;
  qty: number;
  amount: number;
  /** Items with a quantity but no price — the amount line is short by these. */
  unpriced: string[];
}

/**
 * Money is counted in sen and only turned back into ringgit to be shown.
 *
 * Adding 0.07 three times in decimals gives 0.21000000000000002, and a column
 * of those drifts far enough to fail the one check this sheet exists for —
 * whether it agrees with the invoice. Sen are whole numbers, which do not drift.
 */
const sen = (ringgit: number) => Math.round(ringgit * 100);

/** What one item comes to across every column. */
export function itemQty(row: SheetRow): number {
  let n = 0;
  for (const v of Object.values(row.qty)) n += v || 0;
  return n;
}

/**
 * Every figure printed on the sheet: each column's bags and money, each item's
 * run size, and what the whole delivery comes to.
 */
export function sheetTotals(rows: SheetRow[], outlets: SheetOutlet[]): SheetTotals {
  const perItem: Record<string, number> = {};
  const perOutlet: Record<string, { qty: number; amount: number }> = {};
  const unpriced = new Set<string>();

  for (const o of outlets) perOutlet[o.code] = { qty: 0, amount: 0 };

  const senPerOutlet: Record<string, number> = {};
  for (const o of outlets) senPerOutlet[o.code] = 0;

  for (const row of rows) {
    perItem[row.itemCode] = itemQty(row);
    const unit = sen(row.price);
    for (const o of outlets) {
      const q = row.qty[o.code] || 0;
      if (q === 0) continue;
      perOutlet[o.code].qty += q;
      senPerOutlet[o.code] += Math.round(q * unit);
      if (row.price === 0) unpriced.add(row.itemCode);
    }
  }

  let qty = 0;
  let totalSen = 0;
  for (const o of outlets) {
    perOutlet[o.code].amount = senPerOutlet[o.code] / 100;
    qty += perOutlet[o.code].qty;
    totalSen += senPerOutlet[o.code];
  }

  return { perItem, perOutlet, qty, amount: totalSen / 100, unpriced: [...unpriced] };
}

/**
 * Build the rows for a sheet from what the outlets ordered.
 *
 * Only items somebody actually ordered appear, in the order the products are
 * listed, so two sheets for the same customer read the same way week to week.
 */
export function buildRows({
  lines,
  products,
  prices,
  batches,
  owner,
  onDate,
  labels,
}: {
  lines: OrderLine[];
  products: Product[];
  prices: PriceRow[];
  batches: OrderBatch[];
  /** Whose price list applies: a group if there is one, else the single outlet. */
  owner: { customerCode?: string | null; groupCode?: string | null };
  onDate: string;
  /** Item code to the short name the sheet prints, where one is set. */
  labels?: Record<string, string>;
}): SheetRow[] {
  const byItem = new Map<string, Record<string, number>>();
  for (const l of lines) {
    const at = byItem.get(l.itemCode) ?? {};
    const key = l.outletCode ?? "";
    at[key] = (at[key] ?? 0) + l.qty;
    byItem.set(l.itemCode, at);
  }

  const batchOf = new Map(batches.map((b) => [b.itemCode, b]));
  const order = new Map(products.map((p, i) => [p.itemCode, i]));

  return [...byItem.entries()]
    .sort((a, b) => (order.get(a[0]) ?? 1e9) - (order.get(b[0]) ?? 1e9))
    .map(([itemCode, qty]) => {
      const product = products.find((p) => p.itemCode === itemCode);
      const b = batchOf.get(itemCode);
      return {
        itemCode,
        label: labels?.[itemCode] ?? product?.description ?? itemCode,
        packSize: product?.packSize ?? "",
        uom: product?.uom ?? "",
        price: priceOf(owner, product, prices, onDate),
        qty,
        batchCode: b?.batchCode ?? "",
        batchConfirmed: b?.confirmed ?? false,
      };
    });
}

/**
 * The price to use, outlet first and group behind it.
 *
 * The group list is the normal case — every Sri Ternak shop pays the same — but
 * an outlet on its own terms overrides it without the group having to change.
 */
export function priceOf(
  owner: { customerCode?: string | null; groupCode?: string | null },
  product: Product | undefined,
  prices: PriceRow[],
  onDate: string,
): number {
  if (owner.customerCode) {
    const own = priceFor(owner.customerCode, product, prices, onDate);
    if (own.source === "dealer") return own.price;
  }
  if (owner.groupCode) {
    const group = prices.filter((p) => p.groupCode === owner.groupCode);
    let best: PriceRow | undefined;
    for (const row of group) {
      if (row.itemCode !== (product?.itemCode ?? "")) continue;
      if (row.effectiveFrom > onDate) continue;
      if (!best || row.effectiveFrom > best.effectiveFrom) best = row;
    }
    if (best) return best.price;
  }
  if (owner.customerCode) return priceFor(owner.customerCode, product, prices, onDate).price;
  return product && product.basePrice > 0 ? product.basePrice : 0;
}

/** The sheet's rows flattened back into one line per outlet, ready to store. */
export function rowsToLines(rows: SheetRow[], outlets: SheetOutlet[]): OrderLine[] {
  const out: OrderLine[] = [];
  let n = 0;
  for (const row of rows) {
    for (const o of outlets) {
      const qty = row.qty[o.code] || 0;
      if (qty === 0) continue; // an empty cell is not an order line
      out.push({
        lineNo: ++n,
        itemCode: row.itemCode,
        qty,
        uom: row.uom,
        price: row.price,
        note: null,
        outletCode: outlets.length === 1 && o.code === "" ? null : o.code,
      });
    }
  }
  return out;
}

/** The batch codes worth storing: an item nobody wrote a code for is not a record. */
export function rowsToBatches(rows: SheetRow[]): OrderBatch[] {
  return rows
    .filter((r) => r.batchCode.trim() !== "")
    .map((r) => ({
      itemCode: r.itemCode,
      batchCode: r.batchCode.trim(),
      source: "typed" as const,
      confirmed: r.batchConfirmed,
    }));
}

/**
 * What still stands between this sheet and being finished.
 *
 * Said as sentences the office can act on, in the order they matter: you cannot
 * check an invoice against a sheet that is missing prices, and you cannot trace
 * a batch nobody wrote down.
 */
export function sheetWarnings(rows: SheetRow[], totals: SheetTotals): string[] {
  const out: string[] = [];
  if (rows.length === 0) return ["Nothing has been ordered yet."];

  if (totals.unpriced.length > 0) {
    out.push(
      `${totals.unpriced.length} ${totals.unpriced.length === 1 ? "item has" : "items have"} ` +
        `no price for this customer, so the amount below is short of the real figure: ` +
        `${totals.unpriced.join(", ")}.`,
    );
  }

  const missing = rows.filter((r) => r.batchCode.trim() === "").length;
  if (missing > 0 && missing < rows.length) {
    out.push(`${missing} of ${rows.length} items still have no batch code.`);
  }

  const unconfirmed = rows.filter((r) => r.batchCode.trim() !== "" && !r.batchConfirmed).length;
  if (unconfirmed > 0) {
    out.push(
      `${unconfirmed} batch ${unconfirmed === 1 ? "code has" : "codes have"} not been checked ` +
        "by anybody yet.",
    );
  }

  return out;
}
