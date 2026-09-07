// Ties the pieces together for one month: scans in, totals and a review list out.
//
// Pure — no database, no files — so the whole payday loop can be tested without
// either.
import { holidaysFor } from "./holidays";
import { isoDate, parseMonthKey } from "./time";
import { buildMonthDays, calcMonth, workingDaysInMonth } from "./month-calc";
import { flagsForNeverScanned, flagsForUnmatched, flagsForWorker } from "./flags";
import { DayInput, Flag, MonthTotals, Worker } from "./types";

export interface MonthView {
  totals: MonthTotals[];
  flags: Flag[];
  workers: Worker[];
}

/**
 * The holiday calendar stores day numbers; every calculation keys on ISO dates.
 * This is the one place that conversion happens.
 */
export function holidaySet(monthKey: string): Set<string> {
  const { year, month } = parseMonthKey(monthKey);
  return new Set(holidaysFor(monthKey).map((h) => isoDate(year, month, h.day)));
}

/**
 * Statuses whose people are paid this month. Passed in rather than assumed:
 * the office can invent a status, and the one thing it must say when it does
 * is whether those people get paid.
 */
export const DEFAULT_WORKING = new Set(["active"]);

export function buildMonthView(
  monthKey: string,
  workers: Worker[],
  scans: Map<string, DayInput[]>,
  unmatched: { scannerId: string; name: string }[] = [],
  working: Set<string> = DEFAULT_WORKING,
  /** Approved paid leave, per worker. Those days are not worked, but neither
   *  are they no-pay leave, so they come off the no-pay figure. */
  paidLeave: Map<string, number> = new Map(),
  /** The month's public holidays. Defaults to the built-in calendar. */
  holidays: Set<string> = holidaySet(monthKey),
): MonthView {
  const { year, month } = parseMonthKey(monthKey);
  const workingDays = workingDaysInMonth(year, month, holidays);

  const active = workers.filter((w) => working.has(w.status));
  const totals: MonthTotals[] = [];
  const flags: Flag[] = [];

  for (const worker of active) {
    // The store hands back a sorted array per worker; both buildMonthDays and
    // flagsForWorker key on the date, so reshape once and pass the same map to
    // both — otherwise the flags could describe a different day set than the
    // totals, and nobody would see it.
    const byDate = new Map((scans.get(worker.code) ?? []).map((d) => [d.date, d]));
    const days = buildMonthDays(year, month, byDate, holidays);

    totals.push(calcMonth(worker.code, days, workingDays, paidLeave.get(worker.code) ?? 0));
    flags.push(...flagsForWorker(worker, days, byDate));
  }

  flags.push(...flagsForUnmatched(unmatched));
  flags.push(...flagsForNeverScanned(workers, new Set(scans.keys()), working));

  totals.sort((a, b) => a.code.localeCompare(b.code));
  return { totals, flags, workers };
}
