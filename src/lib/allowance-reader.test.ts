import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { readAllowances } from "./allowance-reader";

function sheet(aoa: unknown[][]): Buffer {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), "Sheet1");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

describe("readAllowances", () => {
  it("reads code, allowance and advance", () => {
    const buf = sheet([
      ["CODE", "ALLOWANCE", "ADVANCE"],
      ["B08", 200, 550],
      ["M04", 100, 50],
    ]);
    expect(readAllowances(buf)).toEqual([
      { code: "B08", allowance: 200, advance: 550 },
      { code: "M04", allowance: 100, advance: 50 },
    ]);
  });

  it("does not care about column order or letter case", () => {
    const buf = sheet([
      ["advance", "code", "allowance"],
      [550, "B08", 200],
    ]);
    expect(readAllowances(buf)).toEqual([{ code: "B08", allowance: 200, advance: 550 }]);
  });

  it("treats a blank amount as zero", () => {
    const buf = sheet([
      ["CODE", "ALLOWANCE", "ADVANCE"],
      ["B08", null, 550],
    ]);
    expect(readAllowances(buf)[0].allowance).toBe(0);
  });

  it("reads amounts the office typed with a thousands separator", () => {
    const buf = sheet([
      ["CODE", "ALLOWANCE", "ADVANCE"],
      ["B22", 200, "1,420"],
    ]);
    expect(readAllowances(buf)[0].advance).toBe(1420);
  });

  it("skips rows with no code", () => {
    const buf = sheet([
      ["CODE", "ALLOWANCE", "ADVANCE"],
      ["", 200, 550],
      ["B08", 100, 0],
    ]);
    expect(readAllowances(buf)).toHaveLength(1);
  });

  it("says plainly what is wrong when the CODE column is missing", () => {
    const buf = sheet([
      ["NAME", "ALLOWANCE"],
      ["Someone", 200],
    ]);
    expect(() => readAllowances(buf)).toThrow(/CODE/);
  });
});
