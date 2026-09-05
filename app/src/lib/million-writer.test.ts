import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import fs from "node:fs";
import { buildMillionRows, writeMillionXls } from "./million-writer";
import { MILLION_COLUMNS, COL } from "./million-columns";
import { MonthTotals, PayExtras } from "./types";

const TEMPLATE = "c:/Users/USER/OneDrive/Desktop/TungLam/MILLION_IMPORT_JULY_2026_ TEMPLATE.xls";

const totals: MonthTotals = {
  code: "B08",
  workingDays: 27,
  basicDays: 27,
  otHours: 96.63,
  restDayHours: 0,
  phDays: 0,
  phOtHours: 0,
  nonPayLeave: 0,
  otHoursOldSheet: 0,
  r2DifferenceHours: 0,
};
const extras = new Map<string, PayExtras>([
  ["B08", { code: "B08", allowance: 200, advance: 550 }],
]);

describe("MILLION_COLUMNS", () => {
  it("matches the real template header exactly", () => {
    const wb = XLSX.read(fs.readFileSync(TEMPLATE), { type: "buffer" });
    const grid = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[wb.SheetNames[0]], { header: 1 });
    expect(grid[0]).toEqual([...MILLION_COLUMNS]);
  });
});

describe("buildMillionRows", () => {
  it("puts the header first and one row per worker after it", () => {
    const rows = buildMillionRows([totals], extras);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual([...MILLION_COLUMNS]);
    expect(rows[1]).toHaveLength(37);
  });

  it("maps every Stage 1 figure to its Million column", () => {
    const r = buildMillionRows([totals], extras)[1];
    expect(r[COL.EMPLOYEE_NO]).toBe("B08");
    expect(r[COL.WORKING_DAY]).toBe(27);
    expect(r[COL.DAYS_WORKED]).toBe(27);
    expect(r[COL.OVERTIME_1_5X]).toBe(96.63);
    expect(r[COL.ALLOWANCE]).toBe(200);
    expect(r[COL.ADVANCE]).toBe(550);
  });

  it("combines rest day and public holiday hours into the 2x column", () => {
    const r = buildMillionRows([{ ...totals, restDayHours: 10.5, phOtHours: 4.25 }], extras)[1];
    expect(r[COL.OVERTIME_2X]).toBe(14.75);
  });

  it("writes zero for every column Stage 1 does not fill", () => {
    const r = buildMillionRows([totals], extras)[1];
    const filled = new Set<number>(Object.values(COL));
    for (let i = 1; i < 37; i++) {
      if (!filled.has(i)) expect(r[i]).toBe(0);
    }
  });

  it("writes zero allowance and advance for a worker with no entry", () => {
    const r = buildMillionRows([totals], new Map())[1];
    expect(r[COL.ALLOWANCE]).toBe(0);
    expect(r[COL.ADVANCE]).toBe(0);
  });

  it("reproduces the July template's row for B08", () => {
    const wb = XLSX.read(fs.readFileSync(TEMPLATE), { type: "buffer" });
    const grid = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[wb.SheetNames[0]], { header: 1 });
    const templateRow = grid.find((r) => r[0] === "B08")!;
    expect(buildMillionRows([totals], extras)[1]).toEqual(templateRow);
  });
});

describe("writeMillionXls", () => {
  it("writes a true OLE .xls, the same format Million's template uses", () => {
    const buf = writeMillionXls([totals], extras);
    expect(buf.subarray(0, 4).toString("hex")).toBe("d0cf11e0");
  });

  it("round-trips: what Million reads back is what we meant to send", () => {
    const buf = writeMillionXls([totals], extras);
    const wb = XLSX.read(buf, { type: "buffer" });
    const grid = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[wb.SheetNames[0]], { header: 1 });
    expect(grid[0]).toEqual([...MILLION_COLUMNS]);
    expect(grid[1][COL.EMPLOYEE_NO]).toBe("B08");
    expect(grid[1][COL.OVERTIME_1_5X]).toBe(96.63);
    expect(grid[1][COL.ADVANCE]).toBe(550);
  });
});
