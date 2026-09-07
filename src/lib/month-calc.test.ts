import { describe, it, expect } from "vitest";
import { buildMonthDays, calcMonth, workingDaysInMonth } from "./month-calc";
import { DayInput } from "./types";

const JUNE_HOLIDAYS = new Set(["2026-06-01"]);

describe("workingDaysInMonth", () => {
  it("takes out Saturdays and public holidays", () => {
    // June 2026: 30 days, Saturdays on 6/13/20/27, holiday on the 1st.
    expect(workingDaysInMonth(2026, 6, JUNE_HOLIDAYS)).toBe(25);
  });
  it("matches the 27 days the July 2026 Million file used", () => {
    // July 2026: 31 days, 4 Saturdays, no holiday.
    expect(workingDaysInMonth(2026, 7, new Set())).toBe(27);
  });
  it("does not subtract a holiday twice when it falls on a Saturday", () => {
    expect(workingDaysInMonth(2026, 6, new Set(["2026-06-06"]))).toBe(26);
  });
});

describe("buildMonthDays", () => {
  it("produces a result for every date in the month, scanned or not", () => {
    const days = buildMonthDays(2026, 6, new Map(), JUNE_HOLIDAYS);
    expect(days).toHaveLength(30);
    expect(days[0].date).toBe("2026-06-01");
    expect(days[29].date).toBe("2026-06-30");
  });
  it("credits the public holiday even with no scans at all", () => {
    const days = buildMonthDays(2026, 6, new Map(), JUNE_HOLIDAYS);
    expect(days[0].phDay).toBe(1);
  });
  it("uses the scans it was given", () => {
    const byDate = new Map<string, DayInput>([
      ["2026-06-02", { date: "2026-06-02", punches: ["07:00", "19:00"] }],
    ]);
    const days = buildMonthDays(2026, 6, byDate, JUNE_HOLIDAYS);
    expect(days[1].workedMin).toBe(720);
    expect(days[1].basicDay).toBe(1);
  });
});

describe("calcMonth", () => {
  it("adds up a full month and converts to decimal hours", () => {
    const byDate = new Map<string, DayInput>();
    // Work 07:00-19:00 on every non-Saturday, non-holiday day.
    for (let d = 2; d <= 30; d++) {
      const iso = `2026-06-${String(d).padStart(2, "0")}`;
      if ([6, 13, 20, 27].includes(d)) continue;
      byDate.set(iso, { date: iso, punches: ["07:00", "19:00"] });
    }
    const days = buildMonthDays(2026, 6, byDate, JUNE_HOLIDAYS);
    const t = calcMonth("B32", days, workingDaysInMonth(2026, 6, JUNE_HOLIDAYS));
    expect(t.basicDays).toBe(25);
    expect(t.workingDays).toBe(25);
    expect(t.nonPayLeave).toBe(0);
    expect(t.phDays).toBe(1);
    expect(t.otHours).toBe(81.25); // 25 days x 195 min = 4875 min
  });

  it("counts unworked working days as non-pay leave", () => {
    const days = buildMonthDays(2026, 6, new Map(), JUNE_HOLIDAYS);
    const t = calcMonth("B32", days, 25);
    expect(t.basicDays).toBe(0);
    expect(t.nonPayLeave).toBe(25);
  });

  it("does not charge non-pay leave for days taken as paid leave", () => {
    const days = buildMonthDays(2026, 6, new Map(), JUNE_HOLIDAYS);
    const t = calcMonth("B32", days, 25, 25);
    expect(t.nonPayLeave).toBe(0);
  });

  it("never reports negative non-pay leave", () => {
    const days = buildMonthDays(2026, 6, new Map(), JUNE_HOLIDAYS);
    const t = calcMonth("B32", days, 25, 40);
    expect(t.nonPayLeave).toBe(0);
  });

  it("lets an early-finish day contra against the month's overtime", () => {
    const byDate = new Map<string, DayInput>([
      ["2026-06-02", { date: "2026-06-02", punches: ["07:00", "19:00"] }], // +195
      ["2026-06-03", { date: "2026-06-03", punches: ["07:00", "14:00"] }], // -90
    ]);
    const days = buildMonthDays(2026, 6, byDate, JUNE_HOLIDAYS);
    const t = calcMonth("B32", days, 25);
    expect(t.otHours).toBe(1.75); // 105 minutes
    expect(t.basicDays).toBe(2);
  });
});

describe("comparison against the old spreadsheet", () => {
  it("reports what the old sheet's 9-minutes-every-day rule would have given", () => {
    const byDate = new Map<string, DayInput>();
    for (let d = 2; d <= 30; d++) {
      const iso = `2026-06-${String(d).padStart(2, "0")}`;
      if ([6, 13, 20, 27].includes(d)) continue;
      byDate.set(iso, { date: iso, punches: ["07:00", "19:00"] });
    }
    const days = buildMonthDays(2026, 6, byDate, JUNE_HOLIDAYS);
    const t = calcMonth("B32", days, 25);

    // Ours: 25 days x (210 - 15) = 4875 min = 81.25 h
    expect(t.otHours).toBe(81.25);
    // Old sheet: 25 days x 210 min, less 25 x 0.15 h = 87.5 - 3.75 = 83.75 h
    expect(t.otHoursOldSheet).toBe(83.75);
    expect(t.r2DifferenceHours).toBe(2.5);
  });

  it("reports no difference when nobody passed 2 hours of overtime", () => {
    const byDate = new Map<string, DayInput>([
      ["2026-06-02", { date: "2026-06-02", punches: ["07:00", "17:00"] }], // 600 - 450 - 60 = 90 min OT
    ]);
    const days = buildMonthDays(2026, 6, byDate, JUNE_HOLIDAYS);
    const t = calcMonth("B32", days, 25);
    expect(t.otHours).toBe(1.5);
    expect(t.otHoursOldSheet).toBe(1.35); // 90 min less 0.15 h
  });
});
