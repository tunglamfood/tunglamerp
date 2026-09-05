// Turning the records the office keeps into the numbers a month needs.
//
// Allowances, advances and leave are entered on their own screens all month.
// This is where they meet the attendance calculation, so the Million file
// carries them without anybody re-typing anything.
import { LeaveRecord, PayExtras, PayItem } from "./types";
import { daysInMonth, isoDate } from "./time";

/** Money lines that are added to the pay rather than taken off it. */
export const ADDING_KINDS = new Set(["allowance"]);

/**
 * Every money line for the month, gathered per worker into the two figures
 * Million wants: one allowance column and one advance column. Everything that
 * is not an allowance — advances, levy, hostel, fines — is a deduction, so it
 * lands in the advance column together.
 */
export function extrasFromPayItems(items: PayItem[]): Map<string, PayExtras> {
  const out = new Map<string, PayExtras>();
  for (const item of items) {
    const held = out.get(item.code) ?? { code: item.code, allowance: 0, advance: 0 };
    if (ADDING_KINDS.has(item.kind)) held.allowance += item.amount;
    else held.advance += item.amount;
    out.set(item.code, held);
  }
  for (const e of out.values()) {
    e.allowance = Math.round(e.allowance * 100) / 100;
    e.advance = Math.round(e.advance * 100) / 100;
  }
  return out;
}

/**
 * The office's own records win over a spreadsheet upload — they are the thing
 * that is kept current. An uploaded figure fills in only where nothing has been
 * recorded for that worker.
 */
export function mergeExtras(
  recorded: Map<string, PayExtras>,
  uploaded: Map<string, PayExtras>,
): Map<string, PayExtras> {
  const out = new Map(uploaded);
  for (const [code, e] of recorded) out.set(code, e);
  return out;
}

/** Does a leave record touch this month at all? */
function overlapsMonth(rec: LeaveRecord, monthKey: string): boolean {
  const first = `${monthKey}-01`;
  const { year, month } = { year: Number(monthKey.slice(0, 4)), month: Number(monthKey.slice(5, 7)) };
  const last = isoDate(year, month, daysInMonth(year, month));
  return rec.fromDate <= last && rec.toDate >= first;
}

/**
 * Paid leave days falling inside the month, per worker.
 *
 * A worker on approved paid leave has not worked those days, but they must not
 * be charged as no-pay leave either — so the month calculation subtracts these.
 * Days are counted only where they actually fall, so leave spanning a month end
 * is split between the two months rather than counted twice.
 */
export function paidLeaveDaysInMonth(
  leave: LeaveRecord[],
  monthKey: string,
): Map<string, number> {
  const year = Number(monthKey.slice(0, 4));
  const month = Number(monthKey.slice(5, 7));
  const lastDay = daysInMonth(year, month);
  const out = new Map<string, number>();

  for (const rec of leave) {
    if (!rec.paid || !overlapsMonth(rec, monthKey)) continue;

    let days = 0;
    for (let d = 1; d <= lastDay; d++) {
      const iso = isoDate(year, month, d);
      if (iso >= rec.fromDate && iso <= rec.toDate) days++;
    }
    if (days === 0) continue;

    // A half day is recorded by overriding `days`; honour that when the record
    // sits inside one month.
    const spanned = countSpan(rec);
    const share = spanned > 0 ? (rec.days / spanned) * days : days;
    out.set(rec.code, (out.get(rec.code) ?? 0) + share);
  }

  for (const [code, days] of out) out.set(code, Math.round(days * 100) / 100);
  return out;
}

/** Whole days between the two dates of a leave record, both ends counted. */
function countSpan(rec: LeaveRecord): number {
  const a = Date.parse(`${rec.fromDate}T00:00:00`);
  const b = Date.parse(`${rec.toDate}T00:00:00`);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return 0;
  return Math.round((b - a) / 86_400_000) + 1;
}

/** Unpaid leave days in the month — shown to the office, not deducted twice. */
export function unpaidLeaveDaysInMonth(
  leave: LeaveRecord[],
  monthKey: string,
): Map<string, number> {
  return paidLeaveDaysInMonth(
    leave.filter((l) => !l.paid).map((l) => ({ ...l, paid: true })),
    monthKey,
  );
}
