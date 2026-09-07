// Loading a month for the screen or the export: the same steps every time, so
// the flag list the office clears is always the list the export checks.
import "server-only";
import { listStatuses, listWorkers, loadExtras, loadMonth } from "./store";
import { listHolidays } from "./store-holidays";
import { holidaySet } from "./month-service";
import { listLeave, listPayItems } from "./store-hr";
import { extrasFromPayItems, mergeExtras, paidLeaveDaysInMonth } from "./month-inputs";
import { PayExtras } from "./types";
import { MonthView, buildMonthView } from "./month-service";

export async function workingStatuses(): Promise<Set<string>> {
  const statuses = await listStatuses();
  return new Set(statuses.filter((s) => s.countsAsWorking).map((s) => s.name));
}

/**
 * The month's public holidays, from the list the office keeps. If that cannot
 * be read, the dates written into the code stand in — a month must never be
 * calculated with no holidays at all, because that would quietly turn a paid
 * holiday into a no-pay day.
 */
export async function holidaysForMonth(monthKey: string): Promise<Set<string>> {
  try {
    const stored = await listHolidays(monthKey.slice(0, 4));
    const inMonth = stored.filter((h) => h.onDate.startsWith(monthKey));
    if (stored.length > 0) return new Set(inMonth.map((h) => h.onDate));
  } catch {
    // Fall through to the built-in list.
  }
  return holidaySet(monthKey);
}

export async function loadMonthView(monthKey: string): Promise<MonthView> {
  const [workers, scans, working, leave, holidays] = await Promise.all([
    listWorkers(),
    loadMonth(monthKey),
    workingStatuses(),
    listLeave(),
    holidaysForMonth(monthKey),
  ]);
  const paidLeave = paidLeaveDaysInMonth(leave, monthKey);
  return buildMonthView(monthKey, workers, scans, [], working, paidLeave, holidays);
}

/**
 * The allowance and advance figures for a month: what the office has recorded
 * on the Allowances & advances screen, with an uploaded spreadsheet filling in
 * only where nothing has been recorded.
 */
export async function monthExtras(monthKey: string): Promise<Map<string, PayExtras>> {
  const [items, uploaded] = await Promise.all([listPayItems(monthKey), loadExtras(monthKey)]);
  return mergeExtras(extrasFromPayItems(items), uploaded);
}

export function isMonthKey(value: string | null | undefined): value is string {
  return !!value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}
