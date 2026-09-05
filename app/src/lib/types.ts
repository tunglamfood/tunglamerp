export type Site = "KB" | "KL";
export type Group = "B1" | "B2" | "B3" | "B4";
export type WorkerStatus = "active" | "left" | "balik-cuti";

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
