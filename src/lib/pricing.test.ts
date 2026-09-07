import { describe, it, expect } from "vitest";
import { currentListFor, lineAmount, nextOrderNo, priceFor, pricesForItem, orderTotal } from "./pricing";
import { PriceRow, Product } from "./types";

const item = (over: Partial<Product> = {}): Product => ({
  itemCode: "AD120", description: "EGG TOFU - AD120GM", barcode: null,
  itemGroup: "KB", itemType: "TOFU", uom: "PCS", packSize: "", basePrice: 0,
  cost: 0.28, active: true, ...over,
});

const price = (customerCode: string, itemCode: string, p: number, from: string): PriceRow =>
  ({ customerCode, itemCode, price: p, effectiveFrom: from, note: null });

describe("priceFor", () => {
  const rows = [
    price("3030/0003", "AD120", 0.48, "2026-01-01"),
    price("3030/0003", "AD120", 0.52, "2026-07-01"),
    price("3030/0084", "AD120", 0.55, "2026-01-01"),
  ];

  it("gives each dealer their own price", () => {
    expect(priceFor("3030/0003", item(), rows, "2026-06-01").price).toBe(0.48);
    expect(priceFor("3030/0084", item(), rows, "2026-06-01").price).toBe(0.55);
  });

  it("uses the newest price that has already started", () => {
    expect(priceFor("3030/0003", item(), rows, "2026-07-02").price).toBe(0.52);
  });

  it("ignores a price that starts after the order date, so old orders keep theirs", () => {
    expect(priceFor("3030/0003", item(), rows, "2026-06-30").price).toBe(0.48);
  });

  it("falls back to the product's own list price when the dealer has none", () => {
    const r = priceFor("3030/9999", item({ basePrice: 0.6 }), rows, "2026-06-01");
    expect(r).toMatchObject({ price: 0.6, source: "list" });
  });

  it("says plainly when there is no price at all", () => {
    expect(priceFor("3030/9999", item(), rows, "2026-06-01")).toMatchObject({
      price: 0, source: "none",
    });
  });

  it("reports which dated row it used, so the office can see why", () => {
    expect(priceFor("3030/0003", item(), rows, "2026-08-01")).toMatchObject({
      source: "dealer", from: "2026-07-01",
    });
  });

  it("gives nothing for an item that does not exist", () => {
    expect(priceFor("3030/0003", undefined, rows, "2026-06-01").price).toBe(0);
  });
});

describe("pricesForItem", () => {
  it("lists every dealer's price for one product, newest first", () => {
    const rows = [
      price("A", "AD120", 1, "2026-01-01"),
      price("B", "AD120", 2, "2026-05-01"),
      price("A", "CD500", 9, "2026-01-01"),
    ];
    expect(pricesForItem("AD120", rows).map((r) => r.customerCode)).toEqual(["B", "A"]);
  });
});

describe("currentListFor", () => {
  it("gives one row per product, the newest that has started", () => {
    const rows = [
      price("A", "AD120", 1.0, "2026-01-01"),
      price("A", "AD120", 1.2, "2026-06-01"),
      price("A", "CD500", 2.6, "2026-01-01"),
      price("A", "CD500", 3.0, "2027-01-01"), // future, ignored
      price("B", "AD120", 9.9, "2026-01-01"),
    ];
    const list = currentListFor("A", rows, "2026-08-01");
    expect(list.size).toBe(2);
    expect(list.get("AD120")!.price).toBe(1.2);
    expect(list.get("CD500")!.price).toBe(2.6);
  });
});

describe("money", () => {
  it("rounds a line to sen", () => {
    expect(lineAmount(2000, 0.48)).toBe(960);
    expect(lineAmount(3, 1.115)).toBe(3.35);
  });
  it("totals an order to sen", () => {
    expect(orderTotal([{ qty: 2000, price: 0.48 }, { qty: 200, price: 1.65 }])).toBe(1290);
  });
});

describe("nextOrderNo", () => {
  it("starts at one for a new month", () => {
    expect(nextOrderNo([], "2026-09-05")).toBe("SO-2026-09-0001");
  });
  it("carries on from the highest of that month", () => {
    expect(nextOrderNo(["SO-2026-09-0001", "SO-2026-09-0007"], "2026-09-20"))
      .toBe("SO-2026-09-0008");
  });
  it("does not let another month's numbers interfere", () => {
    expect(nextOrderNo(["SO-2026-08-0099"], "2026-09-05")).toBe("SO-2026-09-0001");
  });
});
