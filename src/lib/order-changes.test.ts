import { describe, expect, it } from "vitest";
import { lineChanges } from "./order-changes";

const row = (item_code: string, qty: number, uom = "PKT") => ({ item_code, qty, uom });
const line = (itemCode: string, qty: number, uom = "PKT") => ({ itemCode, qty, uom });

describe("lineChanges", () => {
  it("finds nothing when the office saves without changing quantities", () => {
    expect(lineChanges([row("TL120", 30), row("TK4P", 10)], [line("TK4P", 10), line("TL120", 30)])).toEqual([]);
  });

  it("reports a quantity cut, an item added and an item removed", () => {
    const got = lineChanges([row("TL120", 30), row("TK4P", 10)], [line("TL120", 20), line("PB270", 5)]);
    expect(got).toEqual(
      expect.arrayContaining([
        { item: "TL120", from: 30, to: 20, uom: "PKT" },
        { item: "TK4P", from: 10, to: 0, uom: "PKT" },
        { item: "PB270", from: 0, to: 5, uom: "PKT" },
      ]),
    );
    expect(got).toHaveLength(3);
  });

  it("adds up an item that appears on several lines (chain outlets)", () => {
    expect(lineChanges([row("TL120", 10), row("TL120", 5)], [line("TL120", 15)])).toEqual([]);
  });
});
