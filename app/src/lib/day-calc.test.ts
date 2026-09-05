import { describe, it, expect } from "vitest";
import { calcDay, dayKind, dayTimes } from "./day-calc";
import { DayInput } from "./types";

const d = (date: string, punches: string[], extra: Partial<DayInput> = {}): DayInput => ({
  date,
  punches,
  ...extra,
});

describe("dayKind", () => {
  const hols = new Set(["2026-06-01"]);
  it("calls a listed date a public holiday", () => {
    expect(dayKind("2026-06-01", hols)).toBe("PH");
  });
  it("calls Saturday a rest day", () => {
    expect(dayKind("2026-06-06", hols)).toBe("REST"); // 6 June 2026 is a Saturday
  });
  it("calls Sunday a normal working day", () => {
    expect(dayKind("2026-06-07", hols)).toBe("NORMAL"); // Sunday is worked here
  });
  it("prefers holiday over Saturday when both apply", () => {
    expect(dayKind("2026-06-06", new Set(["2026-06-06"]))).toBe("PH");
  });
});

describe("dayTimes", () => {
  it("takes the first and last scan, ignoring the middle", () => {
    expect(dayTimes(d("2026-06-02", ["07:06", "12:24", "20:24"]))).toEqual({
      first: 426,
      last: 1224,
    });
  });
  it("gives no last time for a single punch", () => {
    expect(dayTimes(d("2026-06-02", ["07:06"]))).toEqual({ first: 426, last: null });
  });
  it("lets an office override supply the missing finish time", () => {
    expect(dayTimes(d("2026-06-02", ["07:06"], { lastOverride: "19:00" }))).toEqual({
      first: 426,
      last: 1140,
    });
  });
  it("lets overrides supply both times when nothing was scanned", () => {
    expect(
      dayTimes(d("2026-06-02", [], { firstOverride: "07:00", lastOverride: "19:00" })),
    ).toEqual({ first: 420, last: 1140 });
  });
});

describe("calcDay — normal day", () => {
  it("gives a basic day, an hour of lunch, and the rest as overtime", () => {
    // 07:00 to 19:00 = 720 min. 720 - 450 - 60 = 210 OT, over 2h so 15 min off.
    const r = calcDay(d("2026-06-02", ["07:00", "19:00"]), "NORMAL");
    expect(r.workedMin).toBe(720);
    expect(r.basicDay).toBe(1);
    expect(r.lunchMin).toBe(60);
    expect(r.r2Min).toBe(15);
    expect(r.otMin).toBe(195);
  });

  it("takes no tea break when overtime is exactly 2 hours", () => {
    // 07:00 to 17:30 = 630. 630 - 450 - 60 = 120 exactly — not more than 2h.
    const r = calcDay(d("2026-06-02", ["07:00", "17:30"]), "NORMAL");
    expect(r.otMin).toBe(120);
    expect(r.r2Min).toBe(0);
  });

  it("takes the tea break when overtime is one minute over 2 hours", () => {
    // 07:00 to 17:31 = 631. 631 - 450 - 60 = 121, one minute past the threshold.
    const r = calcDay(d("2026-06-02", ["07:00", "17:31"]), "NORMAL");
    expect(r.r2Min).toBe(15);
    expect(r.otMin).toBe(106); // 121 - 15
  });

  it("gives negative overtime when they leave early, but keeps the basic day", () => {
    // 07:00 to 14:00 = 420. 420 - 450 - 60 = -90.
    const r = calcDay(d("2026-06-02", ["07:00", "14:00"]), "NORMAL");
    expect(r.otMin).toBe(-90);
    expect(r.basicDay).toBe(1);
    expect(r.r2Min).toBe(0);
  });

  it("handles a shift that runs past midnight", () => {
    // 11:10 to 01:59 next day: 119 - 670 = -551, plus 24h = 889 min.
    const r = calcDay(d("2026-06-02", ["11:10", "01:59"]), "NORMAL");
    expect(r.workedMin).toBe(889);
  });

  it("returns nothing usable when only one punch was recorded", () => {
    const r = calcDay(d("2026-06-02", ["07:06"]), "NORMAL");
    expect(r.workedMin).toBeNull();
    expect(r.basicDay).toBe(0);
    expect(r.otMin).toBe(0);
  });

  it("returns nothing when the office marked them absent", () => {
    const r = calcDay(d("2026-06-02", ["07:00", "19:00"], { markedAbsent: true }), "NORMAL");
    expect(r.workedMin).toBeNull();
    expect(r.basicDay).toBe(0);
  });
});

describe("calcDay — Saturday rest day", () => {
  it("counts every hour, with no basic day and no lunch", () => {
    const r = calcDay(d("2026-06-06", ["07:00", "14:23"]), "REST");
    expect(r.restMin).toBe(443);
    expect(r.basicDay).toBe(0);
    expect(r.lunchMin).toBe(0);
    expect(r.otMin).toBe(0);
  });
  it("never applies the tea break, however long the day", () => {
    const r = calcDay(d("2026-06-06", ["07:00", "20:00"]), "REST");
    expect(r.r2Min).toBe(0);
    expect(r.restMin).toBe(780);
  });
});

describe("calcDay — public holiday", () => {
  it("credits the holiday even when nobody worked it", () => {
    const r = calcDay(d("2026-06-01", []), "PH");
    expect(r.phDay).toBe(1);
    expect(r.phOtMin).toBe(0);
    expect(r.workedMin).toBeNull();
  });
  it("takes no lunch off a holiday under 5 hours", () => {
    // 11:15 to 14:35 = 200 min, under 300.
    const r = calcDay(d("2026-06-01", ["11:15", "14:35"]), "PH");
    expect(r.lunchMin).toBe(0);
    expect(r.phOtMin).toBe(200);
  });
  it("takes an hour off a holiday of exactly 5 hours", () => {
    const r = calcDay(d("2026-06-01", ["07:00", "12:00"]), "PH");
    expect(r.lunchMin).toBe(60);
    expect(r.phOtMin).toBe(240);
  });
  it("never applies the tea break", () => {
    const r = calcDay(d("2026-06-01", ["11:10", "20:53"]), "PH");
    expect(r.r2Min).toBe(0);
    expect(r.phOtMin).toBe(523); // 583 worked - 60 lunch
  });
});
