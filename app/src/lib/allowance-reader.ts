// The office's allowance and advance sheet. Stage 1 only; Stage 2 replaces this
// upload with records kept in the system.
//
// Columns are found by name, case-insensitively, so the office can keep its own
// column order and does not have to match a rigid template.
import * as XLSX from "xlsx";
import { PayExtras } from "./types";

function toNumber(raw: unknown): number {
  if (raw == null || raw === "") return 0;
  const n = Number(String(raw).replace(/[,\s]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

export function readAllowances(buffer: ArrayBuffer | Buffer): PayExtras[] {
  const wb = XLSX.read(buffer, { type: "buffer", raw: true });
  const grid = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[wb.SheetNames[0]], {
    header: 1,
    defval: null,
  });
  if (grid.length === 0) throw new Error("That allowance file is empty.");

  const header = grid[0].map((c) => String(c ?? "").trim().toUpperCase());
  const codeCol = header.indexOf("CODE");
  if (codeCol < 0) {
    throw new Error(
      "That allowance file has no CODE column. It needs a CODE column holding each worker's Million code, plus ALLOWANCE and ADVANCE columns.",
    );
  }
  const allowanceCol = header.indexOf("ALLOWANCE");
  const advanceCol = header.indexOf("ADVANCE");

  const out: PayExtras[] = [];
  for (const row of grid.slice(1)) {
    if (!Array.isArray(row)) continue;
    const code = String(row[codeCol] ?? "").trim();
    if (!code) continue;
    out.push({
      code,
      allowance: allowanceCol < 0 ? 0 : toNumber(row[allowanceCol]),
      advance: advanceCol < 0 ? 0 : toNumber(row[advanceCol]),
    });
  }
  return out;
}
