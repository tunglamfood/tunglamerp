import { describe, it, expect } from "vitest";
import { buildMonthView, holidaySet } from "./month-service";
import { DayInput, Worker } from "./types";

const w = (code: string, over: Partial<Worker> = {}): Worker => ({
  code,
  scannerId: "",
  name: `WORKER ${code}`,
  site: "KB",
  group: "B1",
  nationality: "Bangladesh",
  status: "active",
  ...over,
});

const day = (date: string, punches: string[]): DayInput => ({ date, punches });

describe("holidaySet", () => {
  it("turns the stored day numbers into ISO dates", () => {
    expect(holidaySet("2026-06")).toEqual(new Set(["2026-06-01"]));
  });
  it("handles a month with two holidays", () => {
    expect(holidaySet("2026-11")).toEqual(new Set(["2026-11-06", "2026-11-08"]));
  });
  it("returns nothing for a month with no holiday", () => {
    expect(holidaySet("2026-07")).toEqual(new Set());
  });
});

describe("buildMonthView", () => {
  it("produces totals for every active worker, even one with no scans at all", () => {
    const view = buildMonthView("2026-06", [w("B08"), w("M04")], new Map());
    expect(view.totals.map((t) => t.code)).toEqual(["B08", "M04"]);
    // The holiday is still credited — that is the point.
    expect(view.totals[0].phDays).toBe(1);
    expect(view.totals[0].workingDays).toBe(25);
    expect(view.totals[0].nonPayLeave).toBe(25);
  });

  it("leaves out workers who have left", () => {
    const view = buildMonthView(
      "2026-06",
      [w("B08"), w("B09", { status: "left" }), w("B10", { status: "balik-cuti" })],
      new Map(),
    );
    expect(view.totals.map((t) => t.code)).toEqual(["B08"]);
  });

  it("returns totals in code order, so the Million file is always the same shape", () => {
    const view = buildMonthView("2026-06", [w("N04"), w("B08"), w("M10")], new Map());
    expect(view.totals.map((t) => t.code)).toEqual(["B08", "M10", "N04"]);
  });

  it("counts a worker's scans towards their totals", () => {
    const scans = new Map<string, DayInput[]>([
      ["B08", [day("2026-06-02", ["07:00", "19:00"])]],
    ]);
    const view = buildMonthView("2026-06", [w("B08")], scans);
    expect(view.totals[0].basicDays).toBe(1);
    expect(view.totals[0].otHours).toBe(3.25); // 195 minutes
  });

  it("flags a scanner ID that matches nobody", () => {
    const view = buildMonthView("2026-06", [w("B08")], new Map(), [
      { scannerId: "9999", name: "SOMEBODY ELSE" },
    ]);
    expect(view.flags.filter((f) => f.kind === "UNKNOWN_WORKER")).toHaveLength(1);
  });

  it("flags an active worker who never scanned", () => {
    const view = buildMonthView("2026-06", [w("B08")], new Map());
    expect(view.flags.filter((f) => f.kind === "NEVER_SCANNED").map((f) => f.code)).toEqual(["B08"]);
  });

  it("flags the days a worker scanned only once", () => {
    const scans = new Map<string, DayInput[]>([["B08", [day("2026-06-02", ["07:06"])]]]);
    const view = buildMonthView("2026-06", [w("B08")], scans);
    const single = view.flags.filter((f) => f.kind === "SINGLE_PUNCH");
    expect(single).toHaveLength(1);
    expect(single[0].date).toBe("2026-06-02");
    // The scanned end is kept, the missing end is left empty — batches finish
    // at different times, so a guess would be wrong for most of them.
    expect(single[0].suggestFirst).toBe("07:06");
    expect(single[0].suggestLast).toBe("");
  });

  it("keeps flags and totals describing the same days", () => {
    // A worker who scanned every working day has no missing-day flags at all.
    const days: DayInput[] = [];
    for (let d = 2; d <= 30; d++) {
      if ([6, 13, 20, 27].includes(d)) continue;
      days.push(day(`2026-06-${String(d).padStart(2, "0")}`, ["07:00", "19:00"]));
    }
    const view = buildMonthView("2026-06", [w("B08")], new Map([["B08", days]]));
    expect(view.totals[0].basicDays).toBe(25);
    expect(view.totals[0].nonPayLeave).toBe(0);
    expect(view.flags).toHaveLength(0);
  });
});
