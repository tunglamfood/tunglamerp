// The whole payday loop, on the factory's own scanner file, with no database:
// read the export, match each scan to a worker, calculate the month, and write
// the file Million imports.
import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import fs from "node:fs";
import { readCheckTime } from "./checktime-reader";
import { buildMonthView } from "./month-service";
import { writeMillionXls } from "./million-writer";
import { MILLION_COLUMNS, COL } from "./million-columns";
import { DayInput, Worker } from "./types";
import { rowsToDayInputs } from "./store-mapping";

const SCANS = "c:/Users/USER/OneDrive/Desktop/TungLam/CHECKTIME_InOutReportAll.xlsx";
const KEYIN =
  "c:/Users/USER/OneDrive/Desktop/TungLam/TungLamHRSystem/MillionPayroll_KeyIn_June2026.xlsx";

/** October 2025 is the month with the most scan data in the trial export. */
const MONTH = "2025-10";

function sheetGrid(path: string): unknown[][] {
  const wb = XLSX.read(fs.readFileSync(path), { type: "buffer", raw: true });
  return XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[wb.SheetNames[0]], {
    header: 1,
    defval: null,
  });
}

/** The 85 real workers, from the one sheet that carries the Million code. */
function realWorkers(): Worker[] {
  const grid = sheetGrid(KEYIN);
  const header = grid.findIndex((r) => Array.isArray(r) && String(r[1] ?? "").trim() === "CODE");
  const out: Worker[] = [];
  for (const row of grid.slice(header + 1)) {
    if (!Array.isArray(row)) continue;
    const code = String(row[1] ?? "").trim();
    const name = String(row[2] ?? "").trim();
    if (!code || !name) continue;
    const [site, group] = String(row[3] ?? "").trim().split(/\s+/);
    out.push({
      code,
      scannerId: "",
      name,
      site: site === "KL" ? "KL" : "KB",
      group: /^B[1-4]$/.test(group ?? "") ? (group as Worker["group"]) : "B1",
      nationality: null,
      status: "active",
    });
  }
  return out;
}

describe("the payday loop, end to end", () => {
  const workers = realWorkers();
  const rows = readCheckTime(fs.readFileSync(SCANS)).filter((r) => r.date.startsWith(MONTH));

  // Give the first workers a scanner ID matching the IDs actually in the file,
  // so the matching step has something real to do.
  const scannerIds = [...new Set(rows.map((r) => r.scannerId))].sort();
  const enrolled = workers.map((w, i) => ({ ...w, scannerId: scannerIds[i] ?? "" }));
  const byScannerId = new Map(enrolled.filter((w) => w.scannerId).map((w) => [w.scannerId, w]));

  const scans: Map<string, DayInput[]> = rowsToDayInputs(
    rows
      .filter((r) => byScannerId.has(r.scannerId))
      .map((r) => ({
        code: byScannerId.get(r.scannerId)!.code,
        work_date: r.date,
        punches: r.punches,
      })),
    [],
  );

  it("reads the month out of the real scanner export", () => {
    expect(rows.length).toBe(947);
    expect(scannerIds.length).toBe(51);
  });

  it("matches every scan to a worker", () => {
    expect(scans.size).toBe(51);
  });

  it("produces totals for all 85 workers and a review list for the office", () => {
    const view = buildMonthView(MONTH, enrolled, scans);
    expect(view.totals).toHaveLength(85);
    // This is trial data — roughly half its rows have a single punch — so the
    // office has plenty to check. The point is that it is all surfaced.
    expect(view.flags.length).toBeGreaterThan(0);
    expect(view.flags.some((f) => f.kind === "SINGLE_PUNCH")).toBe(true);
    expect(view.flags.some((f) => f.kind === "NEVER_SCANNED")).toBe(true);
  });

  it("credits October's public holiday to nobody, because there is not one", () => {
    const view = buildMonthView(MONTH, enrolled, scans);
    // October 2025 has no company holiday, and 2025 is not in the calendar at
    // all — so no PH day is credited and the working days are the month less
    // its Saturdays.
    expect(view.totals[0].phDays).toBe(0);
    expect(view.totals[0].workingDays).toBe(27); // 31 days - 4 Saturdays
  });

  it("writes a Million file Excel can open, one row per worker", () => {
    const view = buildMonthView(MONTH, enrolled, scans);
    const file = writeMillionXls(view.totals, new Map());

    expect(file.subarray(0, 4).toString("hex")).toBe("d0cf11e0"); // a real .xls

    const back = XLSX.read(file, { type: "buffer" });
    const grid = XLSX.utils.sheet_to_json<unknown[]>(back.Sheets[back.SheetNames[0]], {
      header: 1,
    });
    expect(grid[0]).toEqual([...MILLION_COLUMNS]);
    expect(grid).toHaveLength(86); // header + 85 workers
    for (const row of grid.slice(1)) {
      expect(typeof row[COL.EMPLOYEE_NO]).toBe("string");
      expect(row).toHaveLength(37);
    }
  });

  it("gives a worker who really worked a full month sensible figures", () => {
    const view = buildMonthView(MONTH, enrolled, scans);
    const busiest = [...view.totals].sort((a, b) => b.basicDays - a.basicDays)[0];
    expect(busiest.basicDays).toBeGreaterThan(0);
    expect(busiest.basicDays).toBeLessThanOrEqual(busiest.workingDays);
    expect(busiest.nonPayLeave).toBe(busiest.workingDays - busiest.basicDays);
  });
});
