import { describe, it, expect } from "vitest";
import {
  SheetOutlet, SheetRow, buildRows, itemQty, priceOf, rowsToBatches, rowsToLines,
  sheetTotals, sheetWarnings,
} from "./sheet";
import { OrderLine, PriceRow, Product } from "./types";

/* ── The real sheet ──────────────────────────────────────────────────────────
 * Sri Ternak, delivery 07/09, five outlets. Quantities and every total below
 * are copied from the order form the office actually sent, so the arithmetic
 * here is checked against a sheet a person has already added up by hand.
 * ─────────────────────────────────────────────────────────────────────────── */

const OUTLETS: SheetOutlet[] = [
  { code: "3030/0211", short: "SMY", name: "Semenyih" },
  { code: "3030/0167", short: "SW", name: "Setiawangsa" },
  { code: "3030/0200", short: "TE", name: "Tmn Ehsan" },
  { code: "3030/0286", short: "JAKEL", name: "Jakel Square" },
  { code: "3030/0166", short: "SLY", name: "Selayang" },
];

// item, then SMY, SW, TE, JAKEL, SLY — a blank on the form is a zero here.
const FORM: [string, number, number, number, number, number][] = [
  ["AD120", 1, 0, 0, 0, 0],
  ["AD3X1", 10, 5, 3, 8, 9],
  ["TB300", 3, 2, 10, 2, 4],
  ["TK4P", 10, 15, 10, 12, 5],
  ["TK6P", 9, 20, 12, 4, 0],
  ["TK1KG", 40, 65, 45, 45, 35],
  ["CT480", 0, 0, 0, 0, 2],
  ["CM1KG", 0, 2, 0, 2, 4],
  ["CT1KG", 0, 0, 0, 2, 4],
  ["CT2KG", 0, 14, 4, 0, 30],
  ["CD500", 0, 0, 0, 0, 3],
  ["CD1500", 0, 0, 4, 0, 20],
  ["TP50P", 2, 2, 0, 0, 0],
  ["PB10P", 2, 0, 4, 2, 2],
  ["PB270", 5, 15, 6, 8, 8],
  ["PB1KG", 4, 0, 0, 0, 5],
  ["PP270", 0, 0, 1, 0, 0],
  ["AKIP450", 10, 3, 4, 15, 10],
  ["APK450", 7, 5, 4, 12, 10],
  ["CKIP280", 0, 0, 2, 0, 0],
  ["CPK160", 5, 0, 2, 0, 0],
  ["CGK160", 5, 7, 4, 10, 0],
];

const rowsFromForm = (price = 0): SheetRow[] =>
  FORM.map(([itemCode, ...qtys]) => ({
    itemCode,
    label: itemCode,
    packSize: "10 X 1",
    uom: "BAG",
    price,
    qty: Object.fromEntries(OUTLETS.map((o, i) => [o.code, qtys[i]])),
    batchCode: "",
    batchConfirmed: false,
  }));

describe("the Sri Ternak sheet of 07/09", () => {
  const rows = rowsFromForm();
  const totals = sheetTotals(rows, OUTLETS);

  it("adds each outlet's column to the figure printed on the form", () => {
    expect(totals.perOutlet["3030/0211"].qty).toBe(113); // SMY
    expect(totals.perOutlet["3030/0167"].qty).toBe(155); // SW
    expect(totals.perOutlet["3030/0200"].qty).toBe(115); // TE
    expect(totals.perOutlet["3030/0286"].qty).toBe(122); // JAKEL
    expect(totals.perOutlet["3030/0166"].qty).toBe(151); // SLY
  });

  it("adds the whole sheet to 656 bags", () => {
    expect(totals.qty).toBe(656);
  });

  it("gives manufacturing the right figure per item", () => {
    expect(totals.perItem["TK1KG"]).toBe(230);
    expect(totals.perItem["TK4P"]).toBe(52);
    expect(totals.perItem["CT2KG"]).toBe(48);
    expect(totals.perItem["AKIP450"]).toBe(42);
    expect(totals.perItem["PB270"]).toBe(42);
    expect(totals.perItem["APK450"]).toBe(38);
    expect(totals.perItem["CGK160"]).toBe(26);
    expect(totals.perItem["CD1500"]).toBe(24);
    // Ordered by one outlet only, which is where an off-by-one would show.
    expect(totals.perItem["AD120"]).toBe(1);
    expect(totals.perItem["PP270"]).toBe(1);
    expect(totals.perItem["CT480"]).toBe(2);
  });

  it("the item totals add to the outlet totals", () => {
    const byItem = Object.values(totals.perItem).reduce((a, b) => a + b, 0);
    expect(byItem).toBe(totals.qty);
  });
});

describe("the single-outlet sheet", () => {
  // Senawang orders alone: one column, and the total column repeats it.
  const only: SheetOutlet[] = [{ code: "3030/0225", short: "SNW", name: "Senawang" }];
  const rows: SheetRow[] = [
    { itemCode: "TK1KG", label: "TK1KG", packSize: "4 X 1", uom: "BAG", price: 0,
      qty: { "3030/0225": 25 }, batchCode: "", batchConfirmed: false },
    { itemCode: "TK4P", label: "TK400GM", packSize: "10 X 1", uom: "BAG", price: 0,
      qty: { "3030/0225": 20 }, batchCode: "", batchConfirmed: false },
  ];

  it("puts the same figure in the column and the total", () => {
    const t = sheetTotals(rows, only);
    expect(t.perOutlet["3030/0225"].qty).toBe(45);
    expect(t.perItem["TK1KG"]).toBe(25);
    expect(t.qty).toBe(45);
  });
});

describe("amounts", () => {
  const outlets: SheetOutlet[] = [
    { code: "A", short: "A", name: "A" },
    { code: "B", short: "B", name: "B" },
  ];
  const row = (itemCode: string, price: number, a: number, b: number): SheetRow => ({
    itemCode, label: itemCode, packSize: "", uom: "BAG", price,
    qty: { A: a, B: b }, batchCode: "", batchConfirmed: false,
  });

  it("charges each outlet for what it ordered", () => {
    const t = sheetTotals([row("X", 10.5, 2, 3)], outlets);
    expect(t.perOutlet.A.amount).toBe(21);
    expect(t.perOutlet.B.amount).toBe(31.5);
    expect(t.amount).toBe(52.5);
  });

  it("does not drift when a column is added up", () => {
    // Three sevens of a sen added as decimals give 0.21000000000000002, and a
    // long column drifts far enough to disagree with the invoice by a sen.
    const t = sheetTotals(
      [row("X", 0.07, 1, 0), row("Y", 0.07, 1, 0), row("Z", 0.07, 1, 0)],
      outlets,
    );
    expect(t.perOutlet.A.amount).toBe(0.21);
    expect(t.amount).toBe(0.21);
  });

  it("holds together over a long column of real prices", () => {
    const many = Array.from({ length: 40 }, (_, i) => row(`I${i}`, 8.15, 3, 1));
    const t = sheetTotals(many, outlets);
    expect(t.perOutlet.A.amount).toBe(978);   // 40 x 3 x 8.15
    expect(t.perOutlet.B.amount).toBe(326);   // 40 x 1 x 8.15
    expect(t.amount).toBe(1304);
  });

  it("names the items that have no price, because the total is short by them", () => {
    const t = sheetTotals([row("X", 12, 1, 0), row("Y", 0, 4, 0)], outlets);
    expect(t.unpriced).toEqual(["Y"]);
    expect(t.amount).toBe(12);
  });

  it("does not call an item unpriced when nobody ordered it", () => {
    const t = sheetTotals([row("Y", 0, 0, 0)], outlets);
    expect(t.unpriced).toEqual([]);
  });
});

describe("priceOf", () => {
  const product: Product = {
    itemCode: "TK1KG", description: "Taufu Keras 1KG", barcode: null, itemGroup: "",
    itemType: "", uom: "PKT", packSize: "", basePrice: 9, cost: 0, active: true,
  };
  const price = (over: Partial<PriceRow>): PriceRow => ({
    customerCode: null, groupCode: null, itemCode: "TK1KG", price: 0,
    effectiveFrom: "2026-01-01", note: null, ...over,
  });

  it("uses the group list, which is the normal case", () => {
    const p = priceOf({ groupCode: "SRITERNAK" }, product,
      [price({ groupCode: "SRITERNAK", price: 7.5 })], "2026-09-07");
    expect(p).toBe(7.5);
  });

  it("lets one outlet on its own terms beat the group", () => {
    const p = priceOf({ customerCode: "3030/0166", groupCode: "SRITERNAK" }, product, [
      price({ groupCode: "SRITERNAK", price: 7.5 }),
      price({ customerCode: "3030/0166", price: 6.9 }),
    ], "2026-09-07");
    expect(p).toBe(6.9);
  });

  it("keeps the price the order was written at, not a later one", () => {
    const p = priceOf({ groupCode: "G" }, product, [
      price({ groupCode: "G", price: 7.0, effectiveFrom: "2026-01-01" }),
      price({ groupCode: "G", price: 8.0, effectiveFrom: "2026-10-01" }),
    ], "2026-09-07");
    expect(p).toBe(7.0);
  });

  it("falls back to the list price, then to nothing", () => {
    expect(priceOf({ groupCode: "G" }, product, [], "2026-09-07")).toBe(9);
    expect(priceOf({ groupCode: "G" }, { ...product, basePrice: 0 }, [], "2026-09-07")).toBe(0);
  });
});

describe("storing and reopening a sheet", () => {
  const products: Product[] = ["TK1KG", "TK4P", "PB270"].map((itemCode, i) => ({
    itemCode, description: itemCode, barcode: null, itemGroup: "", itemType: "",
    uom: "PKT", packSize: `${i + 4} X 1`, basePrice: 0, cost: 0, active: true,
  }));

  it("writes a line per outlet, and none for an empty cell", () => {
    const rows: SheetRow[] = [{
      itemCode: "TK1KG", label: "TK1KG", packSize: "", uom: "BAG", price: 7,
      qty: { A: 3, B: 0, C: 5 }, batchCode: "", batchConfirmed: false,
    }];
    const outlets: SheetOutlet[] = ["A", "B", "C"].map((c) => ({ code: c, short: c, name: c }));
    const lines = rowsToLines(rows, outlets);
    expect(lines).toHaveLength(2);
    expect(lines.map((l) => l.outletCode)).toEqual(["A", "C"]);
    expect(lines.map((l) => l.qty)).toEqual([3, 5]);
    expect(lines.every((l) => l.price === 7)).toBe(true);
  });

  it("puts the columns back the way they were", () => {
    const lines: OrderLine[] = [
      { lineNo: 1, itemCode: "TK1KG", qty: 40, uom: "BAG", price: 0, note: null, outletCode: "A" },
      { lineNo: 2, itemCode: "TK1KG", qty: 65, uom: "BAG", price: 0, note: null, outletCode: "B" },
      { lineNo: 3, itemCode: "PB270", qty: 5, uom: "BAG", price: 0, note: null, outletCode: "A" },
    ];
    const rows = buildRows({
      lines, products, prices: [], batches: [],
      owner: { groupCode: "G" }, onDate: "2026-09-07",
    });
    expect(rows.map((r) => r.itemCode)).toEqual(["TK1KG", "PB270"]); // product order, not line order
    expect(rows[0].qty).toEqual({ A: 40, B: 65 });
    expect(itemQty(rows[0])).toBe(105);
    expect(rows[0].packSize).toBe("4 X 1");
  });

  it("brings the batch codes back with the sheet", () => {
    const lines: OrderLine[] = [
      { lineNo: 1, itemCode: "TK1KG", qty: 1, uom: "", price: 0, note: null, outletCode: "A" },
    ];
    const rows = buildRows({
      lines, products, prices: [],
      batches: [{ itemCode: "TK1KG", batchCode: "B2609", source: "photo", confirmed: true }],
      owner: { groupCode: "G" }, onDate: "2026-09-07",
    });
    expect(rows[0].batchCode).toBe("B2609");
    expect(rows[0].batchConfirmed).toBe(true);
  });

  it("keeps only the batch codes somebody actually wrote", () => {
    const rows: SheetRow[] = [
      { itemCode: "A", label: "", packSize: "", uom: "", price: 0, qty: {}, batchCode: " B1 ", batchConfirmed: false },
      { itemCode: "B", label: "", packSize: "", uom: "", price: 0, qty: {}, batchCode: "   ", batchConfirmed: false },
    ];
    const out = rowsToBatches(rows);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ itemCode: "A", batchCode: "B1", source: "typed" });
  });
});

describe("what still needs doing", () => {
  const rows = (over: Partial<SheetRow>[]): SheetRow[] =>
    over.map((o, i) => ({
      itemCode: `I${i}`, label: "", packSize: "", uom: "", price: 1,
      qty: { A: 1 }, batchCode: "", batchConfirmed: false, ...o,
    }));
  const outlets: SheetOutlet[] = [{ code: "A", short: "A", name: "A" }];

  it("says so when the sheet is empty", () => {
    expect(sheetWarnings([], sheetTotals([], outlets))).toEqual(["Nothing has been ordered yet."]);
  });

  it("warns that the amount is short when a price is missing", () => {
    const r = rows([{ price: 0 }, { price: 5 }]);
    const w = sheetWarnings(r, sheetTotals(r, outlets));
    expect(w[0]).toContain("no price");
    expect(w[0]).toContain("short");
  });

  it("counts the batch codes still to be written", () => {
    const r = rows([{ batchCode: "B1", batchConfirmed: true }, {}, {}]);
    const w = sheetWarnings(r, sheetTotals(r, outlets));
    expect(w.some((x) => x.includes("2 of 3 items still have no batch code"))).toBe(true);
  });

  it("counts batch codes nobody has checked", () => {
    const r = rows([{ batchCode: "B1" }, { batchCode: "B2" }]);
    const w = sheetWarnings(r, sheetTotals(r, outlets));
    expect(w.some((x) => x.includes("2 batch codes have not been checked"))).toBe(true);
  });

  it("says nothing once every code is in and checked", () => {
    const r = rows([{ batchCode: "B1", batchConfirmed: true }]);
    expect(sheetWarnings(r, sheetTotals(r, outlets))).toEqual([]);
  });
});
