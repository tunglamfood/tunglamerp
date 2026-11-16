import { describe, expect, it } from "vitest";
import { normalisePhone, showPhone } from "./phone";

describe("normalisePhone", () => {
  it("turns every way a dealer writes their number into one login", () => {
    for (const raw of ["012-345 6789", "+60 12 345 6789", "60123456789", "0060-12-3456789", "(012) 3456789"]) {
      expect(normalisePhone(raw)).toBe("+60123456789");
    }
  });

  it("keeps foreign numbers that carry their country code", () => {
    expect(normalisePhone("+65 9123 4567")).toBe("+6591234567");
  });

  it("refuses what cannot be a phone number", () => {
    expect(normalisePhone("")).toBeNull();
    expect(normalisePhone(null)).toBeNull();
    expect(normalisePhone("12345")).toBeNull();
    expect(normalisePhone("call the office")).toBeNull();
  });
});

describe("showPhone", () => {
  it("writes Malaysian and Singapore numbers the way people read them", () => {
    expect(showPhone("+60123456789")).toBe("+60 12-345 6789");
    expect(showPhone("+601123456789")).toBe("+60 11-2345 6789");
    expect(showPhone("+6591234567")).toBe("+65 9123 4567");
  });
});
