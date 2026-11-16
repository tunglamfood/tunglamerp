import { describe, expect, it } from "vitest";
import { AUTOCOUNT_COLUMNS, acDate, autocountRows, exportable } from "./autocount";
import { Customer, SalesOrder } from "./types";

const order = (over: Partial<SalesOrder> = {}): SalesOrder => ({
  id: 1, orderNo: "SO-2026-11-0001", customerCode: "3030/0003", orderDate: "2026-11-16",
  deliverOn: "2026-11-17", status: "confirmed", theirRef: "PO-77", note: null, currency: "MYR",
  lines: [
    { lineNo: 1, itemCode: "TK4P", qty: 10, uom: "PKT", price: 2.35, note: null },
    { lineNo: 2, itemCode: "PB270", qty: 3, uom: "PKT", price: 3.4, note: null },
  ],
  ...over,
});

const customers = new Map<string, Customer>([["3030/0003", {
  code: "3030/0003", name: "FOUR THREE THREE FOOD PROSESSING", shortName: "433", state: "Penang",
  address: null, contact: null, email: null, attn: null, incomeTaxNo: null, active: true,
}]]);

describe("autocountRows", () => {
  it("writes one row per line with the order's header on each", () => {
    const rows = autocountRows([order()], customers, new Map([["TK4P", "TAUFU KERAS 4PCS (400GM)"]]));
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      DocNo: "SO-2026-11-0001", DocDate: "16/11/2026", DebtorCode: "3030/0003",
      DebtorName: "FOUR THREE THREE FOOD PROSESSING", RefNo: "PO-77", DeliveryDate: "17/11/2026",
      ItemCode: "TK4P", Description: "TAUFU KERAS 4PCS (400GM)", UOM: "PKT", Qty: 10, UnitPrice: 2.35, SubTotal: 23.5,
    });
    expect(Object.keys(rows[0])).toEqual([...AUTOCOUNT_COLUMNS]);
  });
});

describe("a group's sheet", () => {
  it("becomes one document per outlet, each billed to that outlet", () => {
    const sheet = order({
      customerCode: null, groupCode: "SNW",
      lines: [
        { lineNo: 1, itemCode: "TK4P", qty: 5, uom: "PKT", price: 2, note: null, outletCode: "3030/0101" },
        { lineNo: 2, itemCode: "TK4P", qty: 7, uom: "PKT", price: 2, note: null, outletCode: "3030/0102" },
        { lineNo: 3, itemCode: "PB270", qty: 0, uom: "PKT", price: 3, note: null, outletCode: "3030/0102" },
      ],
    });
    const rows = autocountRows([sheet], customers, new Map());
    expect(rows.map((r) => [r.DocNo, r.DebtorCode, r.Qty])).toEqual([
      ["SO-2026-11-0001-1", "3030/0101", 5],
      ["SO-2026-11-0001-2", "3030/0102", 7],
    ]);
  });
});

describe("exportable", () => {
  it("takes confirmed and delivered orders in the range that have not gone out yet", () => {
    const list = [
      order({ orderNo: "A", status: "confirmed" }),
      order({ orderNo: "B", status: "delivered" }),
      order({ orderNo: "C", status: "submitted" }),
      order({ orderNo: "D", status: "cancelled" }),
      order({ orderNo: "E", status: "confirmed", exportedAt: "2026-11-16T10:00:00Z" }),
      order({ orderNo: "F", status: "confirmed", orderDate: "2026-10-01" }),
    ];
    expect(exportable(list, "2026-11-01", "2026-11-30", false).map((o) => o.orderNo)).toEqual(["A", "B"]);
    expect(exportable(list, "2026-11-01", "2026-11-30", true).map((o) => o.orderNo)).toEqual(["A", "B", "E"]);
  });
});

describe("acDate", () => {
  it("writes dates the way AutoCount reads them", () => {
    expect(acDate("2026-01-05")).toBe("05/01/2026");
    expect(acDate(null)).toBe("");
  });
});
