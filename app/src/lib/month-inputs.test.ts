import { describe, it, expect } from "vitest";
import {
  extrasFromPayItems, mergeExtras, paidLeaveDaysInMonth, unpaidLeaveDaysInMonth,
} from "./month-inputs";
import { LeaveRecord, PayExtras, PayItem } from "./types";

const item = (code: string, kind: string, amount: number): PayItem =>
  ({ monthKey: "2026-09", code, kind, label: "", amount, note: null });

const leave = (
  code: string, from: string, to: string, days: number, paid = true,
): LeaveRecord => ({ code, kind: "Annual", fromDate: from, toDate: to, days, paid, note: null });

describe("extrasFromPayItems", () => {
  it("adds allowances up into the allowance column", () => {
    const out = extrasFromPayItems([
      item("B08", "allowance", 200),
      item("B08", "allowance", 100),
    ]);
    expect(out.get("B08")).toEqual({ code: "B08", allowance: 300, advance: 0 });
  });

  it("puts everything that is not an allowance into the advance column", () => {
    // Million has one column for money taken off, so levy, hostel and an
    // actual advance all land together.
    const out = extrasFromPayItems([
      item("B08", "advance", 550),
      item("B08", "deduction", 125),
      item("B08", "levy", 40),
    ]);
    expect(out.get("B08")).toEqual({ code: "B08", allowance: 0, advance: 715 });
  });

  it("keeps workers apart", () => {
    const out = extrasFromPayItems([item("B08", "allowance", 200), item("M04", "advance", 50)]);
    expect(out.get("B08")!.allowance).toBe(200);
    expect(out.get("M04")!.advance).toBe(50);
  });

  it("rounds to sen", () => {
    const out = extrasFromPayItems([item("B08", "allowance", 0.105), item("B08", "allowance", 0.105)]);
    expect(out.get("B08")!.allowance).toBe(0.21);
  });
});

describe("mergeExtras", () => {
  const e = (code: string, a: number, b: number): PayExtras =>
    ({ code, allowance: a, advance: b });

  it("lets what the office recorded beat what was uploaded", () => {
    const out = mergeExtras(
      new Map([["B08", e("B08", 300, 0)]]),
      new Map([["B08", e("B08", 200, 550)]]),
    );
    expect(out.get("B08")).toEqual({ code: "B08", allowance: 300, advance: 0 });
  });

  it("keeps an uploaded worker who has nothing recorded", () => {
    const out = mergeExtras(new Map(), new Map([["M04", e("M04", 100, 50)]]));
    expect(out.get("M04")!.allowance).toBe(100);
  });
});

describe("paidLeaveDaysInMonth", () => {
  it("counts a whole leave that sits inside the month", () => {
    const out = paidLeaveDaysInMonth([leave("B08", "2026-09-10", "2026-09-12", 3)], "2026-09");
    expect(out.get("B08")).toBe(3);
  });

  it("ignores leave in another month", () => {
    const out = paidLeaveDaysInMonth([leave("B08", "2026-08-10", "2026-08-12", 3)], "2026-09");
    expect(out.has("B08")).toBe(false);
  });

  it("splits leave that runs over a month end, so it is not counted twice", () => {
    // 29 Sep to 3 Oct is five days: two in September, three in October.
    const rec = leave("B08", "2026-09-29", "2026-10-03", 5);
    expect(paidLeaveDaysInMonth([rec], "2026-09").get("B08")).toBe(2);
    expect(paidLeaveDaysInMonth([rec], "2026-10").get("B08")).toBe(3);
  });

  it("honours a half day", () => {
    const out = paidLeaveDaysInMonth([leave("B08", "2026-09-10", "2026-09-10", 0.5)], "2026-09");
    expect(out.get("B08")).toBe(0.5);
  });

  it("leaves unpaid leave out — that is no-pay leave, counted elsewhere", () => {
    const out = paidLeaveDaysInMonth(
      [leave("B08", "2026-09-10", "2026-09-12", 3, false)], "2026-09",
    );
    expect(out.has("B08")).toBe(false);
  });

  it("adds up several records for one worker", () => {
    const out = paidLeaveDaysInMonth(
      [leave("B08", "2026-09-01", "2026-09-02", 2), leave("B08", "2026-09-20", "2026-09-20", 1)],
      "2026-09",
    );
    expect(out.get("B08")).toBe(3);
  });
});

describe("unpaidLeaveDaysInMonth", () => {
  it("counts only the unpaid records", () => {
    const out = unpaidLeaveDaysInMonth(
      [leave("B08", "2026-09-10", "2026-09-12", 3, false), leave("B08", "2026-09-20", "2026-09-20", 1)],
      "2026-09",
    );
    expect(out.get("B08")).toBe(3);
  });
});
