import { describe, expect, it } from "vitest";
import { periodRange, salesReport } from "./sales-report";
import type { Customer, Product, SalesOrder } from "./types";

const cust = (code: string, name: string): Customer => ({
  code, name, shortName: name, state: "", address: null, contact: null, email: null, attn: null, incomeTaxNo: null, active: true,
});
const prod = (itemCode: string, description: string): Product =>
  ({ itemCode, description, barcode: null, itemGroup: "", itemType: "", uom: "PKT", packSize: "", basePrice: 0, cost: 0, active: true }) as unknown as Product;
let n = 0;
const order = (customerCode: string, orderDate: string, lines: [string, number, number][], extra: Partial<SalesOrder> = {}): SalesOrder => ({
  id: ++n, orderNo: `SO-${n}`, customerCode, orderDate, deliverOn: null, status: "confirmed", theirRef: null, note: null,
  source: "erp",
  lines: lines.map(([itemCode, qty, price], i) => ({ lineNo: i + 1, itemCode, qty, uom: "PKT", price, note: null })),
  ...extra,
});

const customers = [cust("A", "Ah Beng"), cust("B", "Sin Joo"), cust("C", "Poon Lee")];
const products = [prod("TL120", "Egg tofu"), prod("TK4P", "Tau kwa")];

describe("salesReport", () => {
  const orders = [
    order("A", "2026-11-03", [["TL120", 10, 2], ["TK4P", 5, 3]], { source: "portal" }),
    order("A", "2026-11-10", [["TL120", 20, 2]]),
    order("B", "2026-11-12", [["TK4P", 4, 0]], { source: "rep" }),
    order("B", "2026-11-12", [["TK4P", 100, 3]], { status: "cancelled" }),
    order("C", "2026-10-30", [["TL120", 1, 2]]), // before the period
  ];
  const r = salesReport({
    orders, customers, products, from: "2026-11-01", to: "2026-11-17", today: "2026-11-17",
    logins: [
      { customerCode: "A", groupCode: null, role: "dealer", active: true, lastLoginAt: "2026-11-15T03:00:00Z" },
      { customerCode: "A", groupCode: null, role: "dealer", active: true, lastLoginAt: null },
      { customerCode: "C", groupCode: null, role: "dealer", active: true, lastLoginAt: "2026-09-01T00:00:00Z" },
      { customerCode: null, groupCode: null, role: "rep", active: true, lastLoginAt: "2026-11-16T00:00:00Z" },
    ],
  });

  it("counts orders and value in the period, leaving out cancelled ones", () => {
    expect(r.orders).toBe(3);
    expect(r.value).toBe(10 * 2 + 5 * 3 + 20 * 2);
    expect(r.dealers).toBe(2);
    expect(r.unpricedLines).toBe(1);
    expect(r.bySource).toEqual({ portal: 1, rep: 1, office: 1 });
  });

  it("puts each day of a month on the chart", () => {
    expect(r.bucket).toBe("day");
    expect(r.series).toHaveLength(17);
    expect(r.series.find((b) => b.start === "2026-11-03")?.value).toBe(35);
  });

  it("ranks dealers by value and products by quantity", () => {
    expect(r.topDealers[0]).toMatchObject({ key: "A", name: "Ah Beng", orders: 2, value: 75, portalShare: 0.5 });
    expect(r.topProducts[0]).toMatchObject({ itemCode: "TL120", qty: 30 });
  });

  it("counts portal adoption per dealer, not per phone", () => {
    expect(r.adoption).toEqual({ dealersWithLogin: 2, signedIn30d: 1, orderedOnPortal: 1 });
  });

  it("flags a regular dealer who has gone quiet", () => {
    const weekly = ["2026-08-04", "2026-08-11", "2026-08-18", "2026-08-25", "2026-09-01"].map((d) => order("C", d, [["TL120", 1, 2]]));
    const q = salesReport({ orders: weekly, customers, products, logins: [], from: "2026-11-01", to: "2026-11-17", today: "2026-11-17" });
    expect(q.quiet).toHaveLength(1);
    expect(q.quiet[0]).toMatchObject({ key: "C", usualGap: 7, lastOrder: "2026-09-01" });
  });
});

describe("chains", () => {
  it("adds a chain's branches together", () => {
    const branch = (code: string) => ({ ...cust(code, code), groupCode: "LOTUS" });
    const r = salesReport({
      orders: [order("L1", "2026-11-03", [["TL120", 10, 2]]), order("L2", "2026-11-04", [["TL120", 5, 2]]), order("A", "2026-11-04", [["TL120", 1, 2]])],
      customers: [branch("L1"), branch("L2"), branch("L3"), ...customers], products, logins: [],
      from: "2026-11-01", to: "2026-11-17", today: "2026-11-17", groupNames: { LOTUS: "Lotus's" },
    });
    expect(r.chains).toEqual([{ code: "LOTUS", name: "Lotus's", branches: 3, ordering: 2, orders: 2, value: 30 }]);
  });
});

describe("periodRange", () => {
  it("knows this month, last month and the last 90 days", () => {
    expect(periodRange("month", "2026-11-17")).toMatchObject({ from: "2026-11-01", to: "2026-11-17" });
    expect(periodRange("last", "2026-11-17")).toMatchObject({ from: "2026-10-01", to: "2026-10-31" });
    expect(periodRange("90", "2026-11-17")).toMatchObject({ from: "2026-08-20", to: "2026-11-17" });
  });
});
