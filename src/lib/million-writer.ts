// Produces the file Million imports.
//
// Written as true OLE .xls (biff8) because that is the format of the template
// Million was configured against. The header strings must survive untouched;
// Million matches its fields on them.
import * as XLSX from "xlsx";
import { MonthTotals, PayExtras } from "./types";
import { COL, MILLION_COLUMNS } from "./million-columns";

export function buildMillionRows(
  totals: MonthTotals[],
  extras: Map<string, PayExtras>,
): (string | number)[][] {
  const rows: (string | number)[][] = [[...MILLION_COLUMNS]];

  for (const t of totals) {
    const row: (string | number)[] = new Array(MILLION_COLUMNS.length).fill(0);
    const extra = extras.get(t.code);

    row[COL.EMPLOYEE_NO] = t.code;
    row[COL.PUBLIC_HOLIDAY] = t.phDays;
    row[COL.WORKING_DAY] = t.workingDays;
    row[COL.DAYS_WORKED] = t.basicDays;
    row[COL.OVERTIME_1_5X] = t.otHours;
    // Rest day and public holiday overtime are both paid at 2x, and the owner
    // keys them into one column.
    row[COL.OVERTIME_2X] = Math.round((t.restDayHours + t.phOtHours) * 100) / 100;
    row[COL.NON_PAY_LEAVE] = t.nonPayLeave;
    row[COL.ALLOWANCE] = extra?.allowance ?? 0;
    row[COL.ADVANCE] = extra?.advance ?? 0;

    rows.push(row);
  }
  return rows;
}

export function writeMillionXls(
  totals: MonthTotals[],
  extras: Map<string, PayExtras>,
): Buffer {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet(buildMillionRows(totals, extras)),
    "Sheet1",
  );
  return XLSX.write(wb, { type: "buffer", bookType: "biff8" }) as Buffer;
}
