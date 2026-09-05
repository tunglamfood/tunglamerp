// Time helpers. Times are stored as "HH:MM" strings; hours may exceed 24
// for past-midnight clock-outs (e.g. "27:27" = 3:27 AM next day).

export function parseTime(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const s = raw.trim().replace(",", ".");
  if (!s) return null;
  let h: number, m: number;
  const sep = s.match(/^(\d{1,2})[:.](\d{1,2})$/);
  if (sep) {
    h = parseInt(sep[1], 10);
    m = parseInt(sep[2], 10);
  } else if (/^\d{3,4}$/.test(s)) {
    // "2311" -> 23:11
    h = parseInt(s.slice(0, s.length - 2), 10);
    m = parseInt(s.slice(-2), 10);
  } else if (/^\d{1,2}$/.test(s)) {
    h = parseInt(s, 10);
    m = 0;
  } else {
    return null;
  }
  if (isNaN(h) || isNaN(m) || m > 59 || h > 47) return null;
  return h * 60 + m;
}

export function normalizeTime(raw: string | null | undefined): string | null {
  const min = parseTime(raw);
  if (min == null) return null;
  return fmtClock(min);
}

export function fmtClock(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Duration in minutes -> "73:29" (hours:minutes, sign-aware). */
export function fmtHM(min: number): string {
  const neg = min < 0;
  const a = Math.abs(Math.round(min));
  const h = Math.floor(a / 60);
  const m = a % 60;
  return `${neg ? "-" : ""}${h}:${String(m).padStart(2, "0")}`;
}

/** Duration in minutes -> decimal hours, 2 dp (what gets keyed into Million Payroll). */
export function toDec(min: number): number {
  return Math.round((min / 60) * 100) / 100;
}

export function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function parseMonthKey(key: string): { year: number; month: number } {
  const [y, m] = key.split("-").map(Number);
  return { year: y, month: m };
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export const DOW = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

export function dayOfWeek(year: number, month: number, day: number): number {
  return new Date(year, month - 1, day).getDay();
}

export function monthLabel(key: string): string {
  const { year, month } = parseMonthKey(key);
  const names = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  return `${names[month - 1]} ${year}`;
}

/** (2026, 6, 2) -> "2026-06-02". Local calendar date, never UTC. */
export function isoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** "2026-06-02" -> { year: 2026, month: 6, day: 2 } */
export function parseIsoDate(iso: string): { year: number; month: number; day: number } {
  const [year, month, day] = iso.split("-").map(Number);
  return { year, month, day };
}
