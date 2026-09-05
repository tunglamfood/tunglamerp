import { describe, it, expect } from "vitest";
import { daysUntil, expiryLevel, expiryWords } from "./expiry";

const TODAY = "2026-09-05";

describe("daysUntil", () => {
  it("counts forward and back", () => {
    expect(daysUntil("2026-09-05", TODAY)).toBe(0);
    expect(daysUntil("2026-09-15", TODAY)).toBe(10);
    expect(daysUntil("2026-08-26", TODAY)).toBe(-10);
  });
  it("gives nothing for a missing date", () => {
    expect(daysUntil(null, TODAY)).toBeNull();
  });
});

describe("expiryLevel", () => {
  it("sorts a document into how worried to be", () => {
    expect(expiryLevel("2026-08-01", TODAY)).toBe("expired");
    expect(expiryLevel("2026-09-20", TODAY)).toBe("urgent");   // within 30 days
    expect(expiryLevel("2026-11-01", TODAY)).toBe("soon");     // within 90
    expect(expiryLevel("2027-06-01", TODAY)).toBe("fine");
    expect(expiryLevel(null, TODAY)).toBe("none");
  });
  it("treats the boundaries as the safer side", () => {
    expect(expiryLevel("2026-10-05", TODAY)).toBe("urgent");   // exactly 30
    expect(expiryLevel("2026-12-04", TODAY)).toBe("soon");     // exactly 90
  });
});

describe("expiryWords", () => {
  it("says it the way the office would", () => {
    expect(expiryWords("2026-09-05", TODAY)).toBe("expires today");
    expect(expiryWords("2026-09-06", TODAY)).toBe("expires tomorrow");
    expect(expiryWords("2026-09-25", TODAY)).toBe("20 days left");
    expect(expiryWords("2026-08-30", TODAY)).toBe("6 days overdue");
    expect(expiryWords("2027-03-05", TODAY)).toBe("about 6 months left");
    expect(expiryWords(null, TODAY)).toBe("no date recorded");
  });
});
