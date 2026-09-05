// One worker, one day. Every payroll rule in the business lives in this file
// and nowhere else — if a rule is wrong here, 85 payslips are wrong.
//
// The rules come from Payroll_June_Sample.xlsx, decoded and verified against
// worker UDDIN GEAS (KB B3, June 2026). See the spec, section 5.
import { DayInput, DayKind, DayResult } from "./types";
import { parseIsoDate, parseTime } from "./time";

export const BASIC_MIN = 450; // 7h30 — a basic day
export const LUNCH_MIN = 60; // flat 1 hour, now that the scanner measures it
export const R2_MIN = 15; // second tea break
export const R2_THRESHOLD_MIN = 120; // ...taken only past 2 hours of OT
export const PH_LUNCH_THRESHOLD_MIN = 300; // holidays under 5 hours get no lunch deducted

const MINUTES_IN_DAY = 24 * 60;

export function dayKind(date: string, holidays: Set<string>): DayKind {
  if (holidays.has(date)) return "PH";
  const { year, month, day } = parseIsoDate(date);
  // Saturday is the rest day. Sunday is a normal working day here.
  return new Date(year, month - 1, day).getDay() === 6 ? "REST" : "NORMAL";
}

/**
 * The two times that bound the day. Scans in between are ignored: workers
 * scan at lunch only about half the time, so counting the gap would punish
 * whoever remembered.
 *
 * A lone punch yields a null `last` rather than a zero-length day — an
 * incomplete day must be flagged for the office, never silently valued.
 */
export function dayTimes(day: DayInput): { first: number | null; last: number | null } {
  const scanned = day.punches;
  const first = parseTime(day.firstOverride) ?? (scanned.length > 0 ? parseTime(scanned[0]) : null);
  const last =
    parseTime(day.lastOverride) ??
    (scanned.length > 1 ? parseTime(scanned[scanned.length - 1]) : null);
  return { first, last };
}

export function calcDay(day: DayInput, kind: DayKind): DayResult {
  const result: DayResult = {
    date: day.date,
    kind,
    workedMin: null,
    basicDay: 0,
    lunchMin: 0,
    otMin: 0,
    r2Min: 0,
    restMin: 0,
    // The holiday is credited to the worker whether they worked it or not.
    // In the old spreadsheet this depended on somebody typing into a cell,
    // and one worker was missed for June 2026.
    phDay: kind === "PH" ? 1 : 0,
    phOtMin: 0,
  };

  const { first, last } = dayTimes(day);
  if (day.markedAbsent || first == null || last == null) return result;

  let worked = last - first;
  if (worked < 0) worked += MINUTES_IN_DAY; // clocked out after midnight
  result.workedMin = worked;

  if (kind === "REST") {
    result.restMin = worked; // no basic day, no lunch, no tea break
    return result;
  }

  if (kind === "PH") {
    result.lunchMin = worked >= PH_LUNCH_THRESHOLD_MIN ? LUNCH_MIN : 0;
    result.phOtMin = worked - result.lunchMin;
    return result;
  }

  result.basicDay = 1;
  result.lunchMin = LUNCH_MIN;
  let ot = worked - BASIC_MIN - LUNCH_MIN;
  if (ot > R2_THRESHOLD_MIN) {
    result.r2Min = R2_MIN;
    ot -= R2_MIN;
  }
  result.otMin = ot; // may be negative; it contras against the month
  return result;
}
