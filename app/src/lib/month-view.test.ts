import { describe, it, expect } from "vitest";
import { hasAnything } from "./month-view";
import { Flag, MonthTotals } from "./types";

const empty: MonthTotals = {
  code: "B08", workingDays: 27, basicDays: 0, otHours: 0, restDayHours: 0,
  phDays: 0, phOtHours: 0, nonPayLeave: 27, otHoursOldSheet: 0, r2DifferenceHours: 0,
};
const flag = (kind: Flag["kind"]): Flag => ({
  kind, code: "B08", name: "SOMEBODY", date: null, punches: [],
  suggestFirst: null, suggestLast: null, message: "",
});
const view = (totals: MonthTotals[], flags: Flag[]) =>
  ({ totals, flags, workers: [], extras: {} });

describe("hasAnything", () => {
  it("says no for a month nobody has touched", () => {
    expect(hasAnything(null)).toBe(false);
    expect(hasAnything(view([], []))).toBe(false);
  });

  it("says no when the only flags are workers who never scanned", () => {
    // Every active worker raises this on an untouched month. It is not data.
    expect(hasAnything(view([empty], [flag("NEVER_SCANNED"), flag("NO_SCAN")]))).toBe(false);
  });

  it("says yes once somebody has a worked day", () => {
    expect(hasAnything(view([{ ...empty, basicDays: 1 }], []))).toBe(true);
  });

  it("says yes for rest day or holiday hours alone", () => {
    expect(hasAnything(view([{ ...empty, restDayHours: 4 }], []))).toBe(true);
    expect(hasAnything(view([{ ...empty, phOtHours: 3 }], []))).toBe(true);
  });

  it("says yes for a flag that can only come from a real scan", () => {
    for (const kind of ["SINGLE_PUNCH", "TOO_LONG", "TOO_SHORT"] as const) {
      expect(hasAnything(view([empty], [flag(kind)])), kind).toBe(true);
    }
  });
});
