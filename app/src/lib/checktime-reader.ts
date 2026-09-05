// Reads the CheckTime "In Out Report" export.
//
// Two things about this file are load-bearing:
//   1. Its `Total Hours` column is WRONG — it pairs punch 1 with punch 2 and
//      throws the rest away, reporting 5 hours for a 13-hour day. It is never
//      read here.
//   2. The header sits on row 7, and several columns between the labelled ones
//      are blank spacers, so columns are found by name rather than by position.
import * as XLSX from "xlsx";

export interface ScanRow {
  scannerId: string;
  name: string;
  date: string; // ISO, "2026-06-02"
  punches: string[]; // "HH:MM", in scan order
}

const HEADER_SEARCH_LIMIT = 20;

/** "02/06/2026" (day first, as the scanner writes it) -> "2026-06-02". */
function toIso(raw: unknown): string | null {
  const s = String(raw ?? "").trim();
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const [, day, month, year] = m;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function cleanTime(raw: unknown): string | null {
  const s = String(raw ?? "").trim();
  return /^\d{1,2}:\d{2}$/.test(s) ? s.padStart(5, "0") : null;
}

export function readCheckTime(buffer: ArrayBuffer | Buffer): ScanRow[] {
  const wb = XLSX.read(buffer, { type: "buffer", raw: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const grid = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null });

  const headerIndex = grid.findIndex(
    (r, i) =>
      i < HEADER_SEARCH_LIMIT &&
      Array.isArray(r) &&
      r.some((c) => String(c).trim() === "Check In 1"),
  );
  if (headerIndex < 0) {
    throw new Error(
      "This does not look like a CheckTime In Out Report — no 'Check In 1' column was found.",
    );
  }

  const header = grid[headerIndex].map((c) => String(c ?? "").trim());
  const col = (name: string) => header.indexOf(name);
  const idCol = col("EMP ID");
  const nameCol = col("Name");
  const dateCol = col("Date");
  const punchCols: number[] = [];
  for (let n = 1; n <= 10; n++) {
    for (const label of [`Check In ${n}`, `Check Out ${n}`]) {
      const c = col(label);
      if (c >= 0) punchCols.push(c);
    }
  }

  const out: ScanRow[] = [];
  for (const row of grid.slice(headerIndex + 1)) {
    if (!Array.isArray(row)) continue;
    const rawId = String(row[idCol] ?? "").trim();
    if (!rawId) continue;
    const date = toIso(row[dateCol]);
    if (!date) continue;

    const punches: string[] = [];
    for (const c of punchCols) {
      const t = cleanTime(row[c]);
      if (t) punches.push(t);
    }

    out.push({
      // "0018" and "18" are the same person to the scanner; make them the same
      // person here too, so matching against the worker list cannot miss.
      scannerId: String(Number(rawId)),
      name: String(row[nameCol] ?? "").trim(),
      date,
      punches,
    });
  }
  return out;
}
