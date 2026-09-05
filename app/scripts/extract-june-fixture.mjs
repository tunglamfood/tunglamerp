// Pulls June 2026 out of the owner's payroll workbook into a test fixture.
//
// The workbook writes times as hours-dot-minutes, PRE-BORROWED so that plain
// decimal subtraction never has to carry: 26.87 means 26h87m, i.e. 27:27, i.e.
// 03:27 the next morning. Minutes above 59 are normalised back here.
import * as XLSX from "xlsx";
import fs from "node:fs";
import path from "node:path";

const SRC = "c:/Users/USER/OneDrive/Desktop/TungLam/TungLamHRSystem/Payroll_June_Sample.xlsx";
const OUT = path.join(process.cwd(), "src/lib/__fixtures__/june-2026.json");

/** 26.87 -> "27:27". Returns null for blanks. */
function hmToClock(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  let hours = Math.trunc(n);
  let minutes = Math.round((Math.abs(n) - Math.abs(hours)) * 100);
  while (minutes >= 60) {
    hours += 1;
    minutes -= 60;
  }
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function numOrNull(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** 7.30 -> 450 minutes. 1.40 -> 100 minutes. */
function hmToMinutes(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const sign = n < 0 ? -1 : 1;
  const abs = Math.abs(n);
  const hours = Math.trunc(abs);
  const minutes = Math.round((abs - hours) * 100);
  return sign * (hours * 60 + minutes);
}

// Read the bytes ourselves rather than XLSX.readFile — the ESM build has no
// filesystem access unless set_fs is called.
const wb = XLSX.read(fs.readFileSync(SRC), { type: "buffer", cellFormula: false });

const workers = [];

for (const sheetName of wb.SheetNames) {
  if (sheetName === "Sheet2") continue;
  const grid = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], {
    header: 1,
    defval: null,
    blankrows: true,
  });
  const headerRow = grid[1] ?? [];

  // Worker blocks are found by the "NAME :" label in row 2 (index 1).
  const starts = [];
  headerRow.forEach((cell, i) => {
    if (typeof cell === "string" && cell.trim().startsWith("NAME")) starts.push(i);
  });

  for (const c of starts) {
    const name = headerRow[c + 2];
    const code = headerRow[c + 6];
    if (!name) continue;

    const days = [];
    // Rows 9..38 of the sheet are days 1..30 (indices 8..37).
    for (let r = 8; r <= 37; r++) {
      const row = grid[r] ?? [];
      const day = r - 7;
      days.push({
        day,
        dow: String(row[c] ?? "").trim(),
        // The sheet has two in/out pairs per day: C/D and E/F, summed as
        // (D-C)+(F-E). Normal days are keyed into C and F; Saturdays are keyed
        // into E and F. Either way the clock-in is the first value present and
        // the clock-out is the last.
        in: hmToClock(row[c + 2] ?? row[c + 4]),
        out: hmToClock(row[c + 5] ?? row[c + 3]),
        // The untouched cell values, kept so a test can tell whether Excel's
        // decimal subtraction had to carry. The owner pre-borrows the clock-out
        // (26.87 for 27:27) to dodge that, which the normalised clock hides.
        rawIn: numOrNull(row[c + 2] ?? row[c + 4]),
        rawOut: numOrNull(row[c + 5] ?? row[c + 3]),
        hrsWrkMin: hmToMinutes(row[c + 6]),
        basicMin: hmToMinutes(row[c + 7]),
        lunchMin: hmToMinutes(row[c + 8]),
        otMin: hmToMinutes(row[c + 9]),
        remark: row[c + 12] == null ? null : String(row[c + 12]).trim(),
      });
    }

    workers.push({
      sheet: sheetName,
      code: code == null ? null : String(code).trim(),
      name: String(name).trim(),
      days,
    });
  }
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(
  OUT,
  JSON.stringify({ month: "2026-06", holidays: ["2026-06-01"], workers }, null, 2),
);
console.log(`Wrote ${workers.length} workers to ${OUT}`);
