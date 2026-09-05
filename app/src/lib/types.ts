// Site, group, nationality and status are the factory's own words, not ours.
// A new site can open, groups get renumbered, somebody is hired from a country
// nobody was hired from before — so these are plain text, chosen from what is
// already in use or typed fresh.
export type Site = string;
export type Group = string;
export type WorkerStatus = string;

/**
 * Status is the one label the payroll reads: only people whose status counts as
 * working are calculated and exported. So a status carries that decision with
 * it rather than being guessed from its name.
 */
export interface WorkerStatusOption {
  name: string;
  countsAsWorking: boolean;
  sortOrder: number;
}

export interface Worker {
  code: string; // Million code — the primary key, e.g. "B32"
  scannerId: string; // CheckTime EMP ID, e.g. "2028". "" until enrolled.
  name: string;
  site: Site;
  group: Group;
  nationality: string | null; // "Bangladesh" | "Myanmar" | "Nepal" | "Malaysia" | null
  status: WorkerStatus;
}

export type DayKind = "NORMAL" | "REST" | "PH";

/** One worker, one calendar date, as read from the scanner plus office corrections. */
export interface DayInput {
  date: string; // "2026-06-02"
  punches: string[]; // ["07:06","12:24","20:24"] in scan order; may be empty
  firstOverride?: string | null; // office-keyed start time, wins over punches[0]
  lastOverride?: string | null; // office-keyed finish time, wins over last punch
  markedAbsent?: boolean; // office says: did not work this day
}

export interface DayResult {
  date: string;
  kind: DayKind;
  workedMin: number | null; // null = no usable pair of times
  basicDay: 0 | 1;
  lunchMin: number;
  otMin: number; // normal days only; negative when they left early
  r2Min: number; // 0 or 15 — the second tea break actually taken off
  restMin: number; // Saturday hours
  phDay: 0 | 1; // credited whether worked or not
  phOtMin: number;
}

export interface MonthTotals {
  code: string;
  workingDays: number;
  basicDays: number;
  otHours: number; // decimal hours, 2dp
  restDayHours: number;
  phDays: number;
  phOtHours: number;
  nonPayLeave: number;
  /**
   * What the old spreadsheet would have printed for overtime: nine minutes
   * taken from every basic day, instead of fifteen taken only from days that
   * passed two hours. Shown beside `otHours` so the correction is visible and
   * can be explained to a worker who asks. See the spec, section 4.4.
   */
  otHoursOldSheet: number;
  r2DifferenceHours: number;
}

/** Allowance and advance, from the office's uploaded sheet. */
export interface PayExtras {
  code: string;
  allowance: number;
  advance: number;
}

export type FlagKind =
  | "SINGLE_PUNCH"
  | "TOO_LONG"
  | "TOO_SHORT"
  | "NO_SCAN"
  | "UNKNOWN_WORKER"
  | "NEVER_SCANNED";

export interface Flag {
  kind: FlagKind;
  code: string | null; // null when the scanner ID matches no worker
  name: string;
  date: string | null; // null for whole-month flags
  punches: string[];
  suggestFirst: string | null; // pre-filled correction offered to the office
  suggestLast: string | null;
  message: string; // plain English, shown as-is on screen
}
