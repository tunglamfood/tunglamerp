// Translation between database rows and the shapes the calculation core uses.
//
// Kept apart from store.ts so it can be tested directly: store.ts carries the
// "server-only" guard, which refuses to load outside a server render.
import { DayInput, Worker } from "./types";

export interface WorkerRow {
  code: string;
  scanner_id: string;
  name: string;
  site: string;
  group: string;
  nationality: string | null;
  status: string;
}

export interface ScanDbRow {
  code: string;
  work_date: string;
  punches: string[];
}

export interface CorrectionDbRow {
  code: string;
  work_date: string;
  first_override: string | null;
  last_override: string | null;
  marked_absent: boolean;
}

export function workerToRow(w: Worker): WorkerRow {
  return {
    code: w.code,
    scanner_id: w.scannerId,
    name: w.name,
    site: w.site,
    group: w.group,
    nationality: w.nationality,
    status: w.status,
  };
}

export function rowToWorker(r: WorkerRow): Worker {
  return {
    code: r.code,
    scannerId: r.scanner_id,
    name: r.name,
    site: r.site as Worker["site"],
    group: r.group as Worker["group"],
    nationality: r.nationality,
    status: r.status as Worker["status"],
  };
}

/** Scans and office corrections describe the same days; this is where they meet. */
export function rowsToDayInputs(
  scans: ScanDbRow[],
  corrections: CorrectionDbRow[],
): Map<string, DayInput[]> {
  const byWorker = new Map<string, Map<string, DayInput>>();
  const slot = (code: string, date: string): DayInput => {
    if (!byWorker.has(code)) byWorker.set(code, new Map());
    const days = byWorker.get(code)!;
    if (!days.has(date)) days.set(date, { date, punches: [] });
    return days.get(date)!;
  };

  for (const s of scans) slot(s.code, s.work_date).punches = s.punches ?? [];
  for (const c of corrections) {
    const day = slot(c.code, c.work_date);
    day.firstOverride = c.first_override;
    day.lastOverride = c.last_override;
    day.markedAbsent = c.marked_absent;
  }

  const out = new Map<string, DayInput[]>();
  for (const [code, days] of byWorker) {
    out.set(code, [...days.values()].sort((a, b) => a.date.localeCompare(b.date)));
  }
  return out;
}
