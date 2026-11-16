// Confirmed sales orders as rows for AutoCount's Excel import.
//
// One row per order line, with the order's header repeated on every row — the
// shape AutoCount's "import Sales Order from Excel" expects. The column names
// are kept in one list so they can be renamed to match the exact template the
// AutoCount installation uses, without touching anything else.
import { Customer, SalesOrder } from "./types";
import { lineAmount } from "./pricing";

export const AUTOCOUNT_COLUMNS = [
  "DocNo", "DocDate", "DebtorCode", "DebtorName", "CurrencyCode", "RefNo", "DeliveryDate", "Remark",
  "ItemCode", "Description", "UOM", "Qty", "UnitPrice", "SubTotal",
] as const;

export type AutoCountRow = Record<(typeof AUTOCOUNT_COLUMNS)[number], string | number>;

/** dd/MM/yyyy — how AutoCount reads dates from Excel in Malaysia. */
export function acDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

export function autocountRows(
  orders: SalesOrder[],
  customers: Map<string, Customer>,
  descriptions: Map<string, string>,
): AutoCountRow[] {
  const rows: AutoCountRow[] = [];
  for (const o of orders) {
    // A group's sheet is invoiced outlet by outlet, so each outlet becomes its
    // own document: SO-2026-11-0001-1, -2… in the order the outlets appear.
    const debtors = o.customerCode
      ? [o.customerCode]
      : [...new Set(o.lines.map((l) => l.outletCode ?? "").filter(Boolean))];
    debtors.forEach((debtor, i) => {
      const c = customers.get(debtor);
      const lines = o.customerCode ? o.lines : o.lines.filter((l) => l.outletCode === debtor);
      for (const l of lines) {
        if (!l.itemCode || !(l.qty > 0)) continue;
        rows.push({
          DocNo: o.customerCode ? o.orderNo : `${o.orderNo}-${i + 1}`,
          DocDate: acDate(o.orderDate),
          DebtorCode: debtor,
          DebtorName: c?.name ?? "",
          CurrencyCode: o.currency ?? c?.currency ?? "MYR",
          RefNo: o.theirRef ?? "",
          DeliveryDate: acDate(o.deliverOn),
          Remark: o.note ?? "",
          ItemCode: l.itemCode,
          Description: descriptions.get(l.itemCode) ?? "",
          UOM: l.uom,
          Qty: l.qty,
          UnitPrice: l.price,
          SubTotal: lineAmount(l.qty, l.price),
        });
      }
    });
  }
  return rows;
}

/** Orders that may go to the accounting system: confirmed or delivered, in the range. */
export function exportable(orders: SalesOrder[], from: string, to: string, includeExported: boolean): SalesOrder[] {
  return orders
    .filter((o) => o.status === "confirmed" || o.status === "delivered")
    .filter((o) => o.orderDate >= from && o.orderDate <= to)
    .filter((o) => includeExported || !o.exportedAt)
    .filter((o) => (o.customerCode || o.groupCode) && o.lines.length > 0)
    .sort((a, b) => a.orderNo.localeCompare(b.orderNo));
}
