// The shape the month screen works in, and the one question both the server
// page and the client picker need to ask about it. Plain module, no "use
// client" — the server has to be able to call this.
import { Flag, MonthTotals, PayExtras, Worker } from "./types";

export interface MonthView {
  totals: MonthTotals[];
  flags: Flag[];
  workers: Worker[];
  extras: Record<string, PayExtras>;
  read?: { rowsInFile: number; rowsForMonth: number; matched: number; unmatched: number };
}

/**
 * Has anything actually been uploaded for this month?
 *
 * Flags alone do not answer it: a month with no data at all still raises a
 * "never scanned" flag for every active worker, which would make an untouched
 * month look uploaded. Only days somebody really scanned count — a worked day,
 * or one of the three flags that can only arise from a real scan.
 */
export function hasAnything(v: MonthView | null): boolean {
  if (!v) return false;
  if (v.totals.some((t) => t.basicDays > 0 || t.restDayHours > 0 || t.phOtHours > 0)) return true;
  return v.flags.some(
    (f) => f.kind === "SINGLE_PUNCH" || f.kind === "TOO_LONG" || f.kind === "TOO_SHORT",
  );
}
