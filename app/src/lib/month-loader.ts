// Loading a month for the screen or the export: the same steps every time, so
// the flag list the office clears is always the list the export checks.
import "server-only";
import { listWorkers, loadMonth } from "./store";
import { MonthView, buildMonthView } from "./month-service";

export async function loadMonthView(monthKey: string): Promise<MonthView> {
  const [workers, scans] = await Promise.all([listWorkers(), loadMonth(monthKey)]);
  return buildMonthView(monthKey, workers, scans);
}

export function isMonthKey(value: string | null | undefined): value is string {
  return !!value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}
