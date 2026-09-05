import { describe, it, expect } from "vitest";
import { alertsFor, figuresFor } from "./dashboard";
import { Assignment, Customer, PriceRow, Product, SalesOrder, Worker, WorkerDocument } from "./types";

const TODAY = "2026-09-05";
const WORKING = new Set(["active"]);

const worker = (code: string, over: Partial<Worker> = {}): Worker => ({
  code, scannerId: "2028", name: `WORKER ${code}`, site: "KB", group: "B1",
  nationality: "Bangladesh", status: "active", ...over,
});
const customer = (code: string, over: Partial<Customer> = {}): Customer => ({
  code, name: `CUSTOMER ${code}`, shortName: code, state: "Penang", address: null,
  contact: null, email: null, attn: null, incomeTaxNo: null, active: true, ...over,
});
const product = (itemCode: string, cost: number): Product => ({
  itemCode, description: itemCode, barcode: null, itemGroup: "KB", itemType: "",
  uom: "PKT", packSize: "", basePrice: 0, cost, active: true,
});
const price = (customerCode: string, itemCode: string, p: number): PriceRow =>
  ({ customerCode, itemCode, price: p, effectiveFrom: "2026-01-01", note: null });
const doc = (code: string, expiresOn: string | null): WorkerDocument =>
  ({ code, kind: "Work permit", number: null, issuedOn: null, expiresOn, note: null });
const order = (date: string, qty: number, unit: number, status = "confirmed"): SalesOrder => ({
  orderNo: `SO-${date}-${qty}`, customerCode: "C1", orderDate: date, deliverOn: null,
  status: status as SalesOrder["status"], theirRef: null, note: null,
  lines: [{ lineNo: 1, itemCode: "A", qty, uom: "PKT", price: unit, note: null }],
});

const base = {
  workers: [] as Worker[], working: WORKING, customers: [] as Customer[],
  products: [] as Product[], orders: [] as SalesOrder[], prices: [] as PriceRow[], today: TODAY,
};

describe("figuresFor", () => {
  it("counts the people, and who cannot be tracked yet", () => {
    const f = figuresFor({
      ...base,
      workers: [worker("B08"), worker("B09", { scannerId: "" }), worker("B10", { status: "left" })],
    });
    expect(f).toMatchObject({ workers: 3, working: 2, notEnrolled: 1 });
  });

  it("does not count a worker who has left as needing a scanner number", () => {
    const f = figuresFor({
      ...base,
      workers: [worker("B10", { status: "left", scannerId: "" })],
    });
    expect(f.notEnrolled).toBe(0);
  });

  it("adds up this month's orders and leaves other months alone", () => {
    const f = figuresFor({
      ...base,
      orders: [order("2026-09-01", 100, 2.5), order("2026-09-20", 10, 1), order("2026-08-30", 999, 9)],
    });
    expect(f.ordersThisMonth).toBe(2);
    expect(f.orderValueThisMonth).toBe(260);
  });

  it("leaves a cancelled order out of the value", () => {
    const f = figuresFor({
      ...base,
      orders: [order("2026-09-01", 100, 2.5), order("2026-09-02", 100, 2.5, "cancelled")],
    });
    expect(f.ordersThisMonth).toBe(1);
    expect(f.orderValueThisMonth).toBe(250);
  });

  it("counts prices that sit below what the item costs", () => {
    const f = figuresFor({
      ...base,
      customers: [customer("C1"), customer("C2")],
      products: [product("A", 1.0)],
      prices: [price("C1", "A", 0.8), price("C2", "A", 1.2)],
    });
    expect(f.belowCost).toBe(1);
    expect(f.pricedProducts).toBe(1);
  });

  it("does not call a carton cost against a packet price a loss", () => {
    // Real case from the Penang sheet: RSL500-MYG priced at 7.20 with a
    // recorded cost of 112. That is a carton cost, not a 104 ringgit loss.
    const f = figuresFor({
      ...base,
      customers: [customer("C1")],
      products: [product("RSL500-MYG", 112)],
      prices: [price("C1", "RSL500-MYG", 7.2)],
    });
    expect(f.belowCost).toBe(0);
    expect(f.costLooksWrong).toBe(1);
  });
});

describe("alertsFor", () => {
  const bare = {
    documents: [] as WorkerDocument[], workers: [] as Worker[], working: WORKING,
    customers: [] as Customer[], products: [] as Product[], prices: [] as PriceRow[],
    assignments: [] as Assignment[], today: TODAY, monthFlags: null, monthKey: "2026-09",
  };

  it("says nothing when there is nothing to say", () => {
    expect(alertsFor(bare)).toEqual([]);
  });

  it("puts an expired permit first, and calls it bad", () => {
    const out = alertsFor({
      ...bare,
      documents: [doc("B08", "2026-08-01"), doc("B09", "2026-09-20")],
      workers: [worker("B08"), worker("B09")],
    });
    expect(out[0].level).toBe("bad");
    expect(out[0].title).toContain("already expired");
    expect(out[1].title).toContain("expiring within a month");
  });

  it("names the worker, not just the code", () => {
    const out = alertsFor({
      ...bare,
      documents: [doc("B08", "2026-08-01")],
      workers: [worker("B08", { name: "ISLAM MD MAZAHARUL" })],
    });
    expect(out[0].detail).toContain("ISLAM MD MAZAHARUL");
  });

  it("flags a price below cost", () => {
    const out = alertsFor({
      ...bare,
      customers: [customer("C1", { shortName: "433" })],
      products: [product("AD120", 0.5)],
      prices: [price("C1", "AD120", 0.4)],
    });
    expect(out.some((a) => a.title.includes("below what the item costs"))).toBe(true);
    expect(out.find((a) => a.title.includes("below"))!.detail).toContain("433");
  });

  it("separates a real loss from a cost recorded in the wrong unit", () => {
    const out = alertsFor({
      ...bare,
      customers: [customer("C1", { shortName: "433" })],
      products: [product("AD120", 0.5), product("RSL500-MYG", 112)],
      prices: [price("C1", "AD120", 0.4), price("C1", "RSL500-MYG", 7.2)],
    });
    const loss = out.find((a) => a.title.includes("below what the item costs"))!;
    const unit = out.find((a) => a.title.includes("cost that looks wrong"))!;
    expect(loss.detail).toContain("AD120");
    expect(loss.detail).not.toContain("RSL500-MYG");
    expect(unit.level).toBe("info");
    expect(unit.detail).toContain("per carton");
  });

  it("does not flag a price above cost", () => {
    const out = alertsFor({
      ...bare,
      customers: [customer("C1")],
      products: [product("AD120", 0.5)],
      prices: [price("C1", "AD120", 0.6)],
    });
    expect(out).toEqual([]);
  });

  it("mentions the month only when it has something outstanding", () => {
    expect(alertsFor({ ...bare, monthFlags: 0 }).length).toBe(0);
    expect(alertsFor({ ...bare, monthFlags: 7 })[0].title).toContain("7 things to check");
  });

  it("counts workers with no scanner number", () => {
    const out = alertsFor({ ...bare, workers: [worker("B08", { scannerId: "" })] });
    expect(out[0].title).toContain("1 worker not on the scanner");
  });

  it("gets the singular right", () => {
    const out = alertsFor({ ...bare, documents: [doc("B08", "2026-08-01")], workers: [worker("B08")] });
    expect(out[0].title).toBe("1 document already expired");
  });
});
