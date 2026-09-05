// A worker's month. Builds a result for every calendar date — not only the
// dates that were scanned — because a public holiday and an absence both need
// to be counted on days where nothing was recorded.
import { DayInput, DayResult, MonthTotals } from "./types";
import { calcDay, dayKind } from "./day-calc";
import { daysInMonth, isoDate, toDec } from "./time";

/**
 * The old spreadsheet's tea break: 0.15 of an hour — nine minutes, not the
 * fifteen the owner intended — taken from every basic day. Kept only so the
 * summary can show the old figure beside the correct one.
 */
const OLD_SHEET_R2_HOURS_PER_DAY = 0.15;

export function workingDaysInMonth(year: number, month: number, holidays: Set<string>): number {
  let count = 0;
  for (let day = 1; day <= daysInMonth(year, month); day++) {
    const iso = isoDate(year, month, day);
    if (holidays.has(iso)) continue; // holiday
    if (new Date(year, month - 1, day).getDay() === 6) continue; // Saturday
    count++;
  }
  return count;
}

export function buildMonthDays(
  year: number,
  month: number,
  byDate: Map<string, DayInput>,
  holidays: Set<string>,
): DayResult[] {
  const out: DayResult[] = [];
  for (let day = 1; day <= daysInMonth(year, month); day++) {
    const iso = isoDate(year, month, day);
    const input = byDate.get(iso) ?? { date: iso, punches: [] };
    out.push(calcDay(input, dayKind(iso, holidays)));
  }
  return out;
}

export function calcMonth(
  code: string,
  days: DayResult[],
  workingDays: number,
  paidLeaveDays = 0,
): MonthTotals {
  let basicDays = 0;
  let otMin = 0;
  let r2Min = 0;
  let restMin = 0;
  let phDays = 0;
  let phOtMin = 0;

  for (const day of days) {
    basicDays += day.basicDay;
    otMin += day.otMin;
    r2Min += day.r2Min;
    restMin += day.restMin;
    phDays += day.phDay;
    phOtMin += day.phOtMin;
  }

  const otHours = toDec(otMin);
  // Add the tea break back on, then take off what the old sheet would have.
  const otHoursOldSheet =
    Math.round(((otMin + r2Min) / 60 - basicDays * OLD_SHEET_R2_HOURS_PER_DAY) * 100) / 100;

  return {
    code,
    workingDays,
    basicDays,
    otHours,
    restDayHours: toDec(restMin),
    phDays,
    phOtHours: toDec(phOtMin),
    nonPayLeave: Math.max(0, workingDays - basicDays - paidLeaveDays),
    otHoursOldSheet,
    r2DifferenceHours: Math.round((otHoursOldSheet - otHours) * 100) / 100,
  };
}
