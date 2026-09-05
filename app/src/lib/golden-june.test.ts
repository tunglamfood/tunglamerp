import { describe, it, expect } from "vitest";
import fixture from "./__fixtures__/june-2026.json";
import { calcDay, dayKind, LUNCH_MIN } from "./day-calc";
import { buildMonthDays, calcMonth, workingDaysInMonth } from "./month-calc";
import { DayInput } from "./types";

const HOLIDAYS = new Set(fixture.holidays);
const iso = (day: number) => `2026-06-${String(day).padStart(2, "0")}`;

type Day = (typeof fixture.workers)[number]["days"][number];

/**
 * Five blocks in the workbook hold no clock times at all, so there is nothing
 * to check against. DIPESH is the notable one: 7.30 is typed against every day
 * with no times, which makes the sheet's own formulas print -364.67 hours of
 * overtime. That is junk, not a result to reproduce.
 */
const testable = fixture.workers.filter((w) => w.days.some((d) => d.in && d.out));

/**
 * True when the sheet's decimal subtraction had to carry — it borrows 100 where
 * a clock borrows 60, so the day comes out 40 minutes too long. See the
 * "borrowing error" block at the foot of this file.
 */
function sheetBorrowed(d: Day): boolean {
  // Read the untouched cell values, not the normalised clock: the owner
  // pre-borrows the clock-out (26.87 for 27:27), which is exactly what avoids
  // the carry, and normalising hides that.
  const minutesOf = (v: number) => Math.round((Math.abs(v) - Math.trunc(Math.abs(v))) * 100);
  return minutesOf(d.rawOut!) < minutesOf(d.rawIn!);
}

/** What the sheet's hours-worked column should have said. */
function trueWorkedMin(d: Day): number {
  return sheetBorrowed(d) ? d.hrsWrkMin! - 40 : d.hrsWrkMin!;
}

const daysWithTimes = (w: (typeof testable)[number]) => w.days.filter((d) => d.in && d.out);
const normalDays = (w: (typeof testable)[number]) =>
  w.days.filter((d) => d.in && d.out && d.basicMin && d.dow !== "SAT" && d.day !== 1);

describe("June 2026 golden master", () => {
  it("has the owner's 85 workers, 80 of them with real data", () => {
    expect(fixture.workers).toHaveLength(85);
    expect(testable.length).toBe(80);
  });

  // Hours worked is the external check this suite rests on: the owner's own
  // clock times, subtracted. Everything else follows from it by the agreed
  // rules. It matches the sheet on all but three days, and those three are the
  // sheet's borrowing error, pinned separately below.
  it.each(testable.map((w) => [w.name, w] as const))(
    "%s — hours worked match the owner's clock times",
    (_name, worker) => {
      for (const d of daysWithTimes(worker)) {
        const date = iso(d.day);
        const got = calcDay({ date, punches: [d.in!, d.out!] }, dayKind(date, HOLIDAYS));
        expect(got.workedMin, `${worker.name} day ${d.day}: hours worked`).toBe(trueWorkedMin(d));
      }
    },
  );

  it.each(testable.map((w) => [w.name, w] as const))(
    "%s — basic days, rest days and the holiday match the owner's sheet",
    (_name, worker) => {
      const byDate = new Map<string, DayInput>();
      for (const d of daysWithTimes(worker)) {
        byDate.set(iso(d.day), { date: iso(d.day), punches: [d.in!, d.out!] });
      }
      const days = buildMonthDays(2026, 6, byDate, HOLIDAYS);
      const totals = calcMonth(
        worker.code ?? worker.name,
        days,
        workingDaysInMonth(2026, 6, HOLIDAYS),
      );

      expect(totals.basicDays, `${worker.name}: basic days`).toBe(normalDays(worker).length);

      // On a Saturday the sheet leaves basic and lunch empty, so its overtime
      // column is simply the hours worked.
      const sheetRestMin = worker.days
        .filter((d) => d.dow === "SAT" && d.in && d.out)
        .reduce((sum, d) => sum + trueWorkedMin(d), 0);
      expect(totals.restDayHours, `${worker.name}: rest day hours`).toBe(
        Math.round((sheetRestMin / 60) * 100) / 100,
      );

      // Every active worker is credited the 1 June holiday. The sheet missed
      // TUN NAING OO; that miss is the bug this system exists to prevent.
      expect(totals.phDays, `${worker.name}: public holiday days`).toBe(1);
      expect(totals.workingDays).toBe(25);
    },
  );

  it.each(testable.map((w) => [w.name, w] as const))(
    "%s — overtime is what the sheet meant, plus the two agreed corrections",
    (_name, worker) => {
      for (const d of normalDays(worker)) {
        const date = iso(d.day);
        const got = calcDay({ date, punches: [d.in!, d.out!] }, dayKind(date, HOLIDAYS));

        // What the sheet's formula was trying to say, before its decimal
        // arithmetic mangled it: worked - basic - the lunch that was keyed.
        const intended = trueWorkedMin(d) - d.basicMin! - d.lunchMin!;
        // Our two approved changes: lunch is a flat hour, and the tea break is
        // 15 minutes on days that pass 2 hours instead of 9 minutes on all.
        const expected = intended + (d.lunchMin! - LUNCH_MIN) - got.r2Min;

        expect(got.otMin, `${worker.name} day ${d.day}: overtime`).toBe(expected);
      }
    },
  );
});

/**
 * The third defect in the old workbook, pinned here so it stays visible.
 *
 * The sheet works in hours-dot-minutes and subtracts them as plain decimals:
 * `14.23 - 7.30 - 1.40`. When the minutes need to carry, decimal borrows 100
 * where clock arithmetic borrows 60, and the day gains a spurious 40 minutes.
 *
 * The owner pre-borrows the clock-out — writing 26.87 in place of 27:27 — which
 * dodges the problem on the hours-worked line. It was missed on three days. The
 * overtime line is a formula result and gets no such treatment, so it drifts
 * every time the lunch or basic minutes force a carry.
 */
describe("the old sheet's borrowing error", () => {
  const hoursLine = testable.flatMap((w) => daysWithTimes(w).filter(sheetBorrowed));

  const overtimeLine: number[] = [];
  for (const w of testable) {
    for (const d of normalDays(w)) {
      const intended = trueWorkedMin(d) - d.basicMin! - d.lunchMin!;
      if (d.otMin !== intended) overtimeLine.push(d.otMin! - intended);
    }
  }

  it("reached the hours-worked line on three days the owner did not pre-borrow", () => {
    expect(hoursLine).toHaveLength(3);
  });

  it("reached the overtime line on 176 of the month's normal working days", () => {
    expect(overtimeLine).toHaveLength(176);
  });

  it("always misses by 40 minutes, in whichever direction the day ran", () => {
    expect(new Set(overtimeLine)).toEqual(new Set([40, -40]));
  });

  it("added 112 hours of overtime across June 2026", () => {
    const minutes = overtimeLine.reduce((sum, m) => sum + m, 0);
    expect(minutes).toBe(6720);
    expect(minutes / 60).toBe(112);
  });
});
