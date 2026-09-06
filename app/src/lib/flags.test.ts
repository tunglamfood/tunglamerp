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
  it("treats a lone morning punch as the clock-in and suggests a finish", () => {
    const flags = run([{ date: "2026-06-02", punches: ["07:06"] }]);
    const f = flags.find((x) => x.date === "2026-06-02")!;
    expect(f.kind).toBe("SINGLE_PUNCH");
    expect(f.suggestFirst).toBe("07:06");
    expect(f.suggestLast).toBe("19:00");
    expect(f.message).toContain("scanned once");
  });

  it("treats a lone evening punch as the clock-out and suggests a start", () => {
    // Someone whose only scan is at 20:39 did not arrive at 20:39. Suggesting
    // a finish of 19:00 would put the end of the day before its beginning.
    const flags = run([{ date: "2026-06-02", punches: ["20:39"] }]);
    const f = flags.find((x) => x.date === "2026-06-02")!;
    expect(f.suggestFirst).toBe("07:00");
    expect(f.suggestLast).toBe("20:39");
  });

  it("never suggests a finish that falls before the start", () => {
    for (const punch of ["04:37", "07:06", "12:24", "14:00", "19:08", "21:00", "23:45"]) {
      const f = run([{ date: "2026-06-02", punches: [punch] }]).find(
        (x) => x.date === "2026-06-02",
      )!;
      expect(f.suggestFirst! < f.suggestLast!, `${punch} suggested ${f.suggestFirst}-${f.suggestLast}`).toBe(true);
    }
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

  it("flags a missed day for somebody who did scan other days", () => {
    // Scanned on the 3rd but not the 2nd — that single gap is worth a line.
    const flags = run([{ date: "2026-06-03", punches: ["07:00", "19:00"] }]);
    expect(flags.find((x) => x.date === "2026-06-02")!.kind).toBe("NO_SCAN");
  });

  it("counts a day typed in by hand as worked, the same as a scanned one", () => {
    // The scanner is not running properly yet, so months are keyed by hand.
    // A gap beside keyed days is still a gap worth showing.
    const flags = run([
      { date: "2026-06-03", punches: [], firstOverride: "07:00", lastOverride: "19:00" },
    ]);
    expect(flags.find((x) => x.date === "2026-06-03")).toBeUndefined();
    expect(flags.find((x) => x.date === "2026-06-02")!.kind).toBe("NO_SCAN");
  });

  it("does not list every day for somebody who never scanned all month", () => {
    // 25 identical rows would bury the real problems. The whole month is one
    // question, answered by the NEVER_SCANNED flag instead.
    expect(run([])).toHaveLength(0);
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

const WORKING = new Set(["active"]);

describe("whole-month flags", () => {
  it("flags a scanner ID that matches no worker", () => {
    const flags = flagsForUnmatched([{ scannerId: "9999", name: "UNKNOWN PERSON" }]);
    expect(flags[0].kind).toBe("UNKNOWN_WORKER");
    expect(flags[0].code).toBeNull();
    expect(flags[0].message).toContain("9999");
  });

  it("flags an active worker who never scanned all month", () => {
    const flags = flagsForNeverScanned([W], new Set(), WORKING);
    expect(flags[0].kind).toBe("NEVER_SCANNED");
    expect(flags[0].code).toBe("B32");
  });

  it("flags a worker whose made-up status counts as working", () => {
    // The office can invent a status; what matters is whether it is paid.
    const onProbation = { ...W, status: "probation" };
    expect(flagsForNeverScanned([onProbation], new Set(), new Set(["probation"]))).toHaveLength(1);
    expect(flagsForNeverScanned([onProbation], new Set(), WORKING)).toHaveLength(0);
  });

  it("does not flag a worker who has left", () => {
    const flags = flagsForNeverScanned([{ ...W, status: "left" }], new Set(), WORKING);
    expect(flags).toHaveLength(0);
  });

  it("does not flag a worker who did scan", () => {
    expect(flagsForNeverScanned([W], new Set(["B32"]), WORKING)).toHaveLength(0);
  });
});
