import { describe, it, expect } from "vitest";
import { explain, fail } from "./db-error";

describe("explain", () => {
  it("turns the clock-ahead error into the fix for it", () => {
    const out = explain("JWT issued at future");
    expect(out).toContain("clock");
    expect(out).toContain("ahead");
    expect(out).toContain("Sync now");
    // The raw jargon must not survive into what the office reads.
    expect(out).not.toContain("JWT");
  });

  it("tells the clock-behind error apart from the clock-ahead one", () => {
    expect(explain("JWT expired")).toContain("behind");
    expect(explain("JWT issued at future")).toContain("ahead");
  });

  it("recognises the error however it is capitalised", () => {
    expect(explain("jwt issued at future")).toContain("clock");
    expect(explain("JWT ISSUED AT FUTURE")).toContain("clock");
  });

  it("names the ten-minute restore for a sleeping database", () => {
    const out = explain("Project is paused");
    expect(out).toContain("asleep");
    expect(out).toContain("Restore");
  });

  it("treats being offline as its own thing", () => {
    for (const raw of ["fetch failed", "getaddrinfo ENOTFOUND db.example.co", "ECONNREFUSED"]) {
      expect(explain(raw)).toContain("Could not reach the database");
    }
  });

  it("says where the key lives when it is wrong", () => {
    expect(explain("Invalid API key")).toContain("SUPABASE_SECRET_KEY");
  });

  it("keeps the original wording for a missing table, which is a real detail", () => {
    const out = explain('relation "public.hr_workers" does not exist');
    expect(out).toContain("has not been created");
    expect(out).toContain("hr_workers");
  });

  it("passes an unrecognised message through untouched", () => {
    // A real message we have not seen is more use than "something went wrong".
    const odd = "duplicate key value violates unique constraint";
    expect(explain(odd)).toBe(odd);
  });
});

describe("fail", () => {
  it("does nothing when there is no error", () => {
    expect(() => fail("Could not load the workers", null)).not.toThrow();
  });

  it("says what was being done as well as what went wrong", () => {
    expect(() => fail("Could not load the money lines", { message: "JWT issued at future" }))
      .toThrow(/Could not load the money lines: This computer's clock/);
  });
});
