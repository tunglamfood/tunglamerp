import { describe, expect, it } from "vitest";
import { buildPlan, dayNotes, defaultMode, deliveryOf, expiryOf, isLate, lotNo, lunarDate, type ProdItem } from "./production";
import type { Product, SalesOrder } from "./types";

const prod = (itemCode: string, description: string, itemGroup = "KB"): Product =>
  ({ itemCode, description, itemGroup, itemType: "", uom: "PCS", packSize: "", basePrice: 0, cost: 0, active: true, barcode: null }) as unknown as Product;
const item = (itemCode: string, over: Partial<ProdItem> = {}): ProdItem => ({
  itemCode, mode: "make", makesItem: null, unitsPer: 1, lineCode: "EGG", batchSize: null, minRun: null,
  bufferPct: 0, shelfLifeDays: null, recipeYield: null, sort: 0, ...over,
});
let n = 0;
const order = (lines: [string, number][], over: Partial<SalesOrder> = {}): SalesOrder => ({
  id: ++n, orderNo: `SO-${n}`, customerCode: `C${n}`, orderDate: "2026-11-18", deliverOn: "2026-11-19",
  status: "confirmed", theirRef: null, note: null,
  lines: lines.map(([itemCode, qty], i) => ({ lineNo: i + 1, itemCode, qty, uom: "PCS", price: 0, note: null })),
  ...over,
});

const products = [prod("TL120", "Egg tofu 120g"), prod("TL3X1", "Egg tofu 3x120g"), prod("CTN180", "Egg tofu carton 180"),
  prod("MEE", "Yellow noodles", "TRADING"), prod("SOY", "Soybean", "RM"), prod("RENT", "Rental", "")];
const items = [
  item("TL120", { batchSize: 200, minRun: 400, bufferPct: 5, recipeYield: 200, shelfLifeDays: 10 }),
  item("TL3X1", { makesItem: "TL120", unitsPer: 3 }),
  item("CTN180", { makesItem: "TL120", unitsPer: 180 }),
];
const lines = [{ code: "EGG", name: "Egg tofu", sort: 20, active: true }];

describe("daily production plan", () => {
  const orders = [
    order([["TL120", 100], ["TL3X1", 50]]),       // 100 + 150 = 250 tubes
    order([["CTN180", 1], ["MEE", 10]]),           // 180 tubes + 10 noodles bought in
    order([["TL120", 999]], { status: "cancelled" }),
    order([["TL120", 30]], { status: "submitted" }),
    order([["TL120", 70]], { deliverOn: "2026-11-20" }),
  ];

  it("converts packs and cartons into what the line makes, adds the buffer and rounds to batches", () => {
    const plan = buildPlan({ orders, products, items, recipes: [], lines, delivery: "2026-11-19", includePending: false });
    const tubes = plan.rows.find((r) => r.itemCode === "TL120")!;
    expect(tubes.ordered).toBe(430);
    expect(tubes.buffer).toBe(22);          // 5% of 430, rounded up
    expect(tubes.need).toBe(452);
    expect(tubes.batches).toBe(3);          // 452 / 200 → 3 batches
    expect(tubes.plan).toBe(600);
    expect(plan.bought).toEqual([expect.objectContaining({ itemCode: "MEE", qty: 10 })]);
    expect(plan.orders).toBe(2);
  });

  it("counts orders still waiting for confirmation only when asked", () => {
    const plan = buildPlan({ orders, products, items, recipes: [], lines, delivery: "2026-11-19", includePending: true });
    expect(plan.rows[0].ordered).toBe(460);
    expect(plan.pending).toBe(1);
  });

  it("takes usable stock off and keeps to the minimum run", () => {
    const plan = buildPlan({ orders: [order([["TL120", 50]])], products, items, recipes: [], lines, delivery: "2026-11-19", includePending: false, overrides: { TL120: { stockQty: 20, extraQty: 0 } } });
    expect(plan.rows[0]).toMatchObject({ ordered: 50, buffer: 3, stock: 20, need: 400, batches: 2, plan: 400 });
  });

  it("works out raw materials from the recipe, prep-before first", () => {
    const plan = buildPlan({
      orders: [order([["TL120", 400]])], products, items, lines, delivery: "2026-11-19", includePending: false,
      recipes: [
        { itemCode: "TL120", ingredient: "SOY", qty: 12, uom: "KG", prepBefore: true, note: null, sort: 0 },
      ],
    });
    // 400 + 20 buffer = 420 → 3 batches = 600 tubes = 3 recipes of 200
    expect(plan.ingredients).toEqual([expect.objectContaining({ ingredient: "SOY", qty: 36, uom: "KG", prepBefore: true })]);
  });

  it("guesses made-here, bought-in or neither from the item group when nothing is set up", () => {
    expect(defaultMode(prod("X", "x", "KB"))).toBe("make");
    expect(defaultMode(prod("X", "x", "TRADING"))).toBe("buy");
    expect(defaultMode(prod("X", "x", ""))).toBe("none");
    const plan = buildPlan({ orders: [order([["RENT", 1], ["SOY", 5]])], products, items: [], recipes: [], lines, delivery: "2026-11-19", includePending: false });
    expect(plan.rows).toHaveLength(0);
  });

  it("flags orders after the cut-off and orders with no delivery date", () => {
    expect(deliveryOf({ deliverOn: null, orderDate: "2026-11-18" })).toBe("2026-11-19");
    expect(isLate({ submittedAt: "2026-11-18T07:30:00Z" }, "2026-11-19", 14)).toBe(true);   // 15:30 MYT
    expect(isLate({ submittedAt: "2026-11-18T05:00:00Z" }, "2026-11-19", 14)).toBe(false);  // 13:00 MYT
    expect(isLate({ submittedAt: null }, "2026-11-19", 14)).toBe(false);
  });

  it("names lots and works out expiry", () => {
    expect(lotNo("2026-11-18", "EGG", "TL120")).toBe("261118-EGG-TL120");
    expect(expiryOf("2026-11-18", 10)).toBe("2026-11-28");
    expect(expiryOf("2026-11-18", null)).toBeNull();
  });
});

describe("day notes", () => {
  it("knows 初一, 十五, the day before, and the New Year season", () => {
    expect(lunarDate("2026-11-09")).toEqual({ month: 10, day: 1 });
    expect(dayNotes("2026-11-09")[0]).toMatch(/初一/);
    expect(dayNotes("2026-11-23")[0]).toMatch(/十五/);
    expect(dayNotes("2026-11-08")[0]).toMatch(/day before 初一/);
    expect(dayNotes("2027-02-07").some((n) => /Chinese New Year/.test(n))).toBe(true);
    expect(dayNotes("2026-11-17")).toEqual([]);
  });

  it("mentions public holidays on the day and the day after", () => {
    const notes = dayNotes("2026-11-17", [{ onDate: "2026-11-18", name: "Test Day" }]);
    expect(notes).toEqual(["Public holiday the next day (Test Day): shops may order extra."]);
  });
});
