import { describe, expect, it } from "vitest";
import { fmtClock, normalizeTime, parseTime, toDec } from "./time";

describe("parseTime", () => {
  it("reads a normal clock time as minutes past midnight", () => {
    expect(parseTime("07:30")).toBe(450);
  });

  it("reads a past-midnight time kept as 24+ hours", () => {
    // The June seed records overnight shifts this way: in 12:00, out 27:27.
    expect(parseTime("27:27")).toBe(27 * 60 + 27);
  });

  it("accepts the dot form the owner types by habit", () => {
    expect(parseTime("11.10")).toBe(670);
  });

  it("accepts four bare digits off a punch card", () => {
    expect(parseTime("2311")).toBe(23 * 60 + 11);
  });

  it("rejects impossible times rather than guessing", () => {
    expect(parseTime("10:75")).toBeNull();
    expect(parseTime("48:00")).toBeNull();
    expect(parseTime("half past four")).toBeNull();
  });

  it("returns null for nothing", () => {
    expect(parseTime(null)).toBeNull();
    expect(parseTime(undefined)).toBeNull();
    expect(parseTime("")).toBeNull();
    expect(parseTime("   ")).toBeNull();
  });
});

describe("normalizeTime", () => {
  it("tidies loose input into HH:MM", () => {
    expect(normalizeTime("7.5")).toBe("07:05");
    expect(normalizeTime("2311")).toBe("23:11");
  });

  it("leaves a past-midnight hour above 24 alone", () => {
    expect(normalizeTime("27:27")).toBe("27:27");
  });
});

describe("fmtClock and toDec", () => {
  it("prints minutes back as a clock time", () => {
    expect(fmtClock(450)).toBe("07:30");
  });

  it("converts minutes to the decimal hours Million Payroll wants", () => {
    expect(toDec(450)).toBe(7.5);
    expect(toDec(9)).toBe(0.15); // the R2 tea break deduction
  });
});
