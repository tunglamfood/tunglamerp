import { describe, it, expect } from "vitest";
import { flagsForWorker, flagsForNeverScanned, flagsForUnmatched } from "./flags";
import { buildMonthDays } from "./month-calc";
import { DayInput, Worker } from "./types";

const HOL = new Set(["2026-06-01"]);
const W: Worker = {
  code: "B32",
  scannerId: "2028",
  name: "ISLAM MD NORUL",
  site: "KB",
  group: "B4",
  nationality: "Bangladesh",
  status: "active",
};

function run(entries: DayInput[]) {
  const byDate = new Map(entries.map((e) => [e.date, e]));
  const days = buildMonthDays(2026, 6, byDate, HOL);
  return flagsForWorker(W, days, byDate);
}

describe("flagsForWorker", () => {
  it("flags a day with only one punch and suggests the standard finish time", () => {
    const flags = run([{ date: "2026-06-02", punches: ["07:06"] }]);
    const f = flags.find((x) => x.date === "2026-06-02")!;
    expect(f.kind).toBe("SINGLE_PUNCH");
    expect(f.suggestFirst).toBe("07:06");
    expect(f.suggestLast).toBe("19:00");
    expect(f.message).toContain("scanned once");
  });

  it("flags a day over 16 hours", () => {
    const flags = run([{ date: "2026-06-02", punches: ["04:00", "21:00"] }]);
    expect(flags.find((x) => x.date === "2026-06-02")!.kind).toBe("TOO_LONG");
  });

  it("flags a working day under 2 hours", () => {
    const flags = run([{ date: "2026-06-02", punches: ["07:00", "08:30"] }]);
    expect(flags.find((x) => x.date === "2026-06-02")!.kind).toBe("TOO_SHORT");
  });

  it("does not flag a short Saturday", () => {
    // 6 June 2026 is a Saturday. Short rest-day work is normal.
    const flags = run([{ date: "2026-06-06", punches: ["07:00", "08:30"] }]);
    expect(flags.some((x) => x.date === "2026-06-06")).toBe(false);
  });

  it("flags a working day with no scan at all", () => {
    const flags = run([]);
    const f = flags.find((x) => x.date === "2026-06-02")!;
    expect(f.kind).toBe("NO_SCAN");
  });

  it("does not flag an unworked Saturday or public holiday", () => {
    const flags = run([]);
    expect(flags.some((x) => x.date === "2026-06-01")).toBe(false); // holiday
    expect(flags.some((x) => x.date === "2026-06-06")).toBe(false); // Saturday
  });

  it("raises nothing once the office has marked the day absent", () => {
    const flags = run([{ date: "2026-06-02", punches: [], markedAbsent: true }]);
    expect(flags.some((x) => x.date === "2026-06-02")).toBe(false);
  });

  it("raises nothing once the office has supplied the missing time", () => {
    const flags = run([{ date: "2026-06-02", punches: ["07:06"], lastOverride: "19:12" }]);
    expect(flags.some((x) => x.date === "2026-06-02")).toBe(false);
  });
});

describe("whole-month flags", () => {
  it("flags a scanner ID that matches no worker", () => {
    const flags = flagsForUnmatched([{ scannerId: "9999", name: "UNKNOWN PERSON" }]);
    expect(flags[0].kind).toBe("UNKNOWN_WORKER");
    expect(flags[0].code).toBeNull();
    expect(flags[0].message).toContain("9999");
  });

  it("flags an active worker who never scanned all month", () => {
    const flags = flagsForNeverScanned([W], new Set());
    expect(flags[0].kind).toBe("NEVER_SCANNED");
    expect(flags[0].code).toBe("B32");
  });

  it("does not flag a worker who has left", () => {
    const flags = flagsForNeverScanned([{ ...W, status: "left" }], new Set());
    expect(flags).toHaveLength(0);
  });

  it("does not flag a worker who did scan", () => {
    expect(flagsForNeverScanned([W], new Set(["B32"]))).toHaveLength(0);
  });
});
