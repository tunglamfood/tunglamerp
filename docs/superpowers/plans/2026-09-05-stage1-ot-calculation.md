# TungLam HR Stage 1 — OT Calculation & Million Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The office uploads the CheckTime scanner export, corrects the days the system flags, and downloads a Million import file that is correct by construction.

**Architecture:** A pure calculation core (`day-calc`, `month-calc`, `flags`, `million-writer`) with no I/O, tested directly against 85 workers of known June 2026 results. Around it, thin readers for the three spreadsheet formats, a Supabase store, and a six-screen Next.js app. The core never imports the app; the app never re-implements a rule.

**Tech Stack:** Next.js 16 · TypeScript · Tailwind 4 · Supabase · Vitest · SheetJS (`xlsx@0.18.5`)

**Spec:** `TungLamHR/docs/superpowers/specs/2026-09-05-hr-ot-calculation-design.md`

## Global Constraints

- All time arithmetic in **whole minutes**. Convert to decimal hours only at output.
- `BASIC_MIN = 450` · `LUNCH_MIN = 60` · `R2_MIN = 15` · `R2_THRESHOLD_MIN = 120` · `PH_LUNCH_THRESHOLD_MIN = 300`
- **Never read the scanner's `Total Hours` column.** It is wrong. Compute from first and last punch.
- Saturday is the rest day. **Sunday is a normal working day.**
- The R2 deduction applies to **normal days only** — never Saturday, never public holiday.
- Every active worker is credited each public holiday whether they worked it or not.
- Worker records are keyed on the **Million code** (`B32`, `M04`, `N19`), with `scannerId` stored alongside.
- Million output must be **true OLE `.xls`** (`bookType: "biff8"`) with all 37 header strings byte-identical to `MILLION_IMPORT_JULY_2026_ TEMPLATE.xls`.
- Files under `TungLamHRSystem/` are **read-only reference**. Never modify them.
- Source data lives at `c:/Users/USER/OneDrive/Desktop/TungLam/`. Project root is `TungLamHR/app/`.

---

### Task 1: Project scaffold, lifted utilities, and types

Stands up the app, carries across the four proven files from the old app, and defines every shape later tasks consume.

**Files:**
- Create: `TungLamHR/app/` (Next.js project)
- Create: `TungLamHR/app/src/lib/types.ts`
- Copy: `TungLamHRSystem/hr-app/src/lib/time.ts` → `TungLamHR/app/src/lib/time.ts`
- Copy: `TungLamHRSystem/hr-app/src/lib/holidays.ts` → `TungLamHR/app/src/lib/holidays.ts`
- Copy: `TungLamHRSystem/hr-app/src/lib/session.ts` → `TungLamHR/app/src/lib/session.ts`
- Copy: `TungLamHRSystem/hr-app/src/lib/supabase-server.ts` → `TungLamHR/app/src/lib/supabase-server.ts`
- Copy: `TungLamHRSystem/hr-app/src/components/ui.tsx` → `TungLamHR/app/src/components/ui.tsx`
- Copy: `TungLamHRSystem/hr-app/.env.local` → `TungLamHR/app/.env.local`
- Create: `TungLamHR/app/vitest.config.ts`
- Test: `TungLamHR/app/src/lib/time.test.ts` (copied from old app)

**Interfaces:**
- Consumes: nothing
- Produces: all types below; `parseTime(s): number|null`, `fmtClock(min): string`, `fmtHM(min): string`, `toDec(min): number`, `daysInMonth(y,m): number`, `dayOfWeek(y,m,d): number`, `monthKey(y,m): string`, `parseMonthKey(k): {year,month}`; `holidaysFor(monthKey): CompanyHoliday[]`

- [ ] **Step 1: Create the Next.js project**

```bash
cd "c:/Users/USER/OneDrive/Desktop/TungLam/TungLamHR"
npx --yes create-next-app@latest app --typescript --tailwind --eslint --app --src-dir --no-turbopack --import-alias "@/*" --use-npm
cd app
npm install xlsx@0.18.5 @supabase/supabase-js server-only
npm install -D vitest
```

The git repository already exists one level up at `TungLamHR/`, holding the spec
and this plan. Do not run `git init` inside `app/` — a nested repository would
hide the code from the history that documents it.

- [ ] **Step 2: Copy the four proven library files and the UI kit across**

```bash
OLD="c:/Users/USER/OneDrive/Desktop/TungLam/TungLamHRSystem/hr-app"
cp "$OLD/src/lib/time.ts"            src/lib/time.ts
cp "$OLD/src/lib/time.test.ts"       src/lib/time.test.ts
cp "$OLD/src/lib/holidays.ts"        src/lib/holidays.ts
cp "$OLD/src/lib/session.ts"         src/lib/session.ts
cp "$OLD/src/lib/session.test.ts"    src/lib/session.test.ts
cp "$OLD/src/lib/supabase-server.ts" src/lib/supabase-server.ts
cp "$OLD/src/components/ui.tsx"      src/components/ui.tsx
cp "$OLD/.env.local"                 .env.local
```

- [ ] **Step 3: Add the vitest config**

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: { environment: "node", include: ["src/**/*.test.ts"] },
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
});
```

Add to `package.json` scripts: `"test": "vitest run"`, `"test:watch": "vitest"`.

- [ ] **Step 4: Add `isoDate` to `src/lib/time.ts`**

The lifted `time.ts` works on `(year, month, day)` triples; the calculation core keys days by ISO date string. Append:

```ts
/** (2026, 6, 2) -> "2026-06-02". Local calendar date, never UTC. */
export function isoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** "2026-06-02" -> { year: 2026, month: 6, day: 2 } */
export function parseIsoDate(iso: string): { year: number; month: number; day: number } {
  const [year, month, day] = iso.split("-").map(Number);
  return { year, month, day };
}
```

- [ ] **Step 5: Write `src/lib/types.ts`**

```ts
export type Site = "KB" | "KL";
export type Group = "B1" | "B2" | "B3" | "B4";
export type WorkerStatus = "active" | "left" | "balik-cuti";

export interface Worker {
  code: string;               // Million code — the primary key, e.g. "B32"
  scannerId: string;          // CheckTime EMP ID, e.g. "2028". "" until enrolled.
  name: string;
  site: Site;
  group: Group;
  nationality: string | null; // "Bangladesh" | "Myanmar" | "Nepal" | "Malaysia" | null
  status: WorkerStatus;
}

export type DayKind = "NORMAL" | "REST" | "PH";

/** One worker, one calendar date, as read from the scanner plus office corrections. */
export interface DayInput {
  date: string;               // "2026-06-02"
  punches: string[];          // ["07:06","12:24","20:24"] in scan order; may be empty
  firstOverride?: string | null;  // office-keyed start time, wins over punches[0]
  lastOverride?: string | null;   // office-keyed finish time, wins over last punch
  markedAbsent?: boolean;         // office says: did not work this day
}

export interface DayResult {
  date: string;
  kind: DayKind;
  workedMin: number | null;   // null = no usable pair of times
  basicDay: 0 | 1;
  lunchMin: number;
  otMin: number;              // normal days only; negative when they left early
  r2Min: number;              // 0 or 15 — the second tea break actually taken off
  restMin: number;            // Saturday hours
  phDay: 0 | 1;               // credited whether worked or not
  phOtMin: number;
}

export interface MonthTotals {
  code: string;
  workingDays: number;
  basicDays: number;
  otHours: number;            // decimal hours, 2dp
  restDayHours: number;
  phDays: number;
  phOtHours: number;
  nonPayLeave: number;
}

/** Allowance and advance, from the office's uploaded sheet. */
export interface PayExtras {
  code: string;
  allowance: number;
  advance: number;
}

export type FlagKind =
  | "SINGLE_PUNCH" | "TOO_LONG" | "TOO_SHORT"
  | "NO_SCAN" | "UNKNOWN_WORKER" | "NEVER_SCANNED";

export interface Flag {
  kind: FlagKind;
  code: string | null;        // null when the scanner ID matches no worker
  name: string;
  date: string | null;        // null for whole-month flags
  punches: string[];
  suggestFirst: string | null; // pre-filled correction offered to the office
  suggestLast: string | null;
  message: string;             // plain English, shown as-is on screen
}
```

- [ ] **Step 6: Run the lifted tests**

Run: `npm test`
Expected: PASS — `time.test.ts` and `session.test.ts` both green.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: scaffold Stage 1 app with lifted time, holiday, session and UI utilities"
```

---

### Task 2: `day-calc` — one day, every rule

The single most important file in the system. Pure function, no I/O.

**Files:**
- Create: `TungLamHR/app/src/lib/day-calc.ts`
- Test: `TungLamHR/app/src/lib/day-calc.test.ts`

**Interfaces:**
- Consumes: `DayInput`, `DayResult`, `DayKind` from `types.ts`; `parseTime`, `parseIsoDate` from `time.ts`
- Produces:
  - `BASIC_MIN`, `LUNCH_MIN`, `R2_MIN`, `R2_THRESHOLD_MIN`, `PH_LUNCH_THRESHOLD_MIN` — number constants
  - `dayKind(date: string, holidays: Set<string>): DayKind`
  - `dayTimes(day: DayInput): { first: number | null; last: number | null }`
  - `calcDay(day: DayInput, kind: DayKind): DayResult`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/day-calc.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { calcDay, dayKind, dayTimes } from "./day-calc";
import { DayInput } from "./types";

const d = (date: string, punches: string[], extra: Partial<DayInput> = {}): DayInput =>
  ({ date, punches, ...extra });

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
    expect(dayTimes(d("2026-06-02", ["07:06", "12:24", "20:24"])))
      .toEqual({ first: 426, last: 1224 });
  });
  it("gives no last time for a single punch", () => {
    expect(dayTimes(d("2026-06-02", ["07:06"])))
      .toEqual({ first: 426, last: null });
  });
  it("lets an office override supply the missing finish time", () => {
    expect(dayTimes(d("2026-06-02", ["07:06"], { lastOverride: "19:00" })))
      .toEqual({ first: 426, last: 1140 });
  });
  it("lets overrides supply both times when nothing was scanned", () => {
    expect(dayTimes(d("2026-06-02", [], { firstOverride: "07:00", lastOverride: "19:00" })))
      .toEqual({ first: 420, last: 1140 });
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/day-calc.test.ts`
Expected: FAIL — `Failed to resolve import "./day-calc"`

- [ ] **Step 3: Write the implementation**

Create `src/lib/day-calc.ts`:

```ts
// One worker, one day. Every payroll rule in the business lives in this file
// and nowhere else — if a rule is wrong here, 85 payslips are wrong.
//
// The rules come from Payroll_June_Sample.xlsx, decoded and verified against
// worker UDDIN GEAS (KB B3, June 2026). See the spec, section 5.
import { DayInput, DayKind, DayResult } from "./types";
import { parseIsoDate, parseTime } from "./time";

export const BASIC_MIN = 450;              // 7h30 — a basic day
export const LUNCH_MIN = 60;               // flat 1 hour, now that the scanner measures it
export const R2_MIN = 15;                  // second tea break
export const R2_THRESHOLD_MIN = 120;       // ...taken only past 2 hours of OT
export const PH_LUNCH_THRESHOLD_MIN = 300; // holidays under 5 hours get no lunch deducted

const MINUTES_IN_DAY = 24 * 60;

export function dayKind(date: string, holidays: Set<string>): DayKind {
  if (holidays.has(date)) return "PH";
  const { year, month, day } = parseIsoDate(date);
  // Saturday is the rest day. Sunday is a normal working day here.
  return new Date(year, month - 1, day).getDay() === 6 ? "REST" : "NORMAL";
}

/**
 * The two times that bound the day. Scans in between are ignored: workers
 * scan at lunch only about half the time, so counting the gap would punish
 * whoever remembered.
 *
 * A lone punch yields a null `last` rather than a zero-length day — an
 * incomplete day must be flagged for the office, never silently valued.
 */
export function dayTimes(day: DayInput): { first: number | null; last: number | null } {
  const scanned = day.punches;
  const first = parseTime(day.firstOverride) ?? (scanned.length > 0 ? parseTime(scanned[0]) : null);
  const last =
    parseTime(day.lastOverride) ??
    (scanned.length > 1 ? parseTime(scanned[scanned.length - 1]) : null);
  return { first, last };
}

export function calcDay(day: DayInput, kind: DayKind): DayResult {
  const result: DayResult = {
    date: day.date,
    kind,
    workedMin: null,
    basicDay: 0,
    lunchMin: 0,
    otMin: 0,
    r2Min: 0,
    restMin: 0,
    // The holiday is credited to the worker whether they worked it or not.
    // In the old spreadsheet this depended on somebody typing into a cell,
    // and one worker was missed for June 2026.
    phDay: kind === "PH" ? 1 : 0,
    phOtMin: 0,
  };

  const { first, last } = dayTimes(day);
  if (day.markedAbsent || first == null || last == null) return result;

  let worked = last - first;
  if (worked < 0) worked += MINUTES_IN_DAY; // clocked out after midnight
  result.workedMin = worked;

  if (kind === "REST") {
    result.restMin = worked; // no basic day, no lunch, no tea break
    return result;
  }

  if (kind === "PH") {
    result.lunchMin = worked >= PH_LUNCH_THRESHOLD_MIN ? LUNCH_MIN : 0;
    result.phOtMin = worked - result.lunchMin;
    return result;
  }

  result.basicDay = 1;
  result.lunchMin = LUNCH_MIN;
  let ot = worked - BASIC_MIN - LUNCH_MIN;
  if (ot > R2_THRESHOLD_MIN) {
    result.r2Min = R2_MIN;
    ot -= R2_MIN;
  }
  result.otMin = ot; // may be negative; it contras against the month
  return result;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/day-calc.test.ts`
Expected: PASS — 20 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/day-calc.ts src/lib/day-calc.test.ts
git commit -m "feat: day calculation with verified TungLam payroll rules"
```

---

### Task 3: `month-calc` — monthly totals

**Files:**
- Create: `TungLamHR/app/src/lib/month-calc.ts`
- Test: `TungLamHR/app/src/lib/month-calc.test.ts`

**Interfaces:**
- Consumes: `DayResult`, `MonthTotals`, `DayInput` from `types.ts`; `calcDay`, `dayKind` from `day-calc.ts`; `daysInMonth`, `isoDate`, `toDec` from `time.ts`
- Produces:
  - `workingDaysInMonth(year: number, month: number, holidays: Set<string>): number`
  - `buildMonthDays(year: number, month: number, byDate: Map<string, DayInput>, holidays: Set<string>): DayResult[]`
  - `calcMonth(code: string, days: DayResult[], workingDays: number, paidLeaveDays?: number): MonthTotals`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/month-calc.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildMonthDays, calcMonth, workingDaysInMonth } from "./month-calc";
import { DayInput } from "./types";

const JUNE_HOLIDAYS = new Set(["2026-06-01"]);

describe("workingDaysInMonth", () => {
  it("takes out Saturdays and public holidays", () => {
    // June 2026: 30 days, Saturdays on 6/13/20/27, holiday on the 1st.
    expect(workingDaysInMonth(2026, 6, JUNE_HOLIDAYS)).toBe(25);
  });
  it("matches the 27 days the July 2026 Million file used", () => {
    // July 2026: 31 days, 4 Saturdays, no holiday.
    expect(workingDaysInMonth(2026, 7, new Set())).toBe(27);
  });
  it("does not subtract a holiday twice when it falls on a Saturday", () => {
    expect(workingDaysInMonth(2026, 6, new Set(["2026-06-06"]))).toBe(26);
  });
});

describe("buildMonthDays", () => {
  it("produces a result for every date in the month, scanned or not", () => {
    const days = buildMonthDays(2026, 6, new Map(), JUNE_HOLIDAYS);
    expect(days).toHaveLength(30);
    expect(days[0].date).toBe("2026-06-01");
    expect(days[29].date).toBe("2026-06-30");
  });
  it("credits the public holiday even with no scans at all", () => {
    const days = buildMonthDays(2026, 6, new Map(), JUNE_HOLIDAYS);
    expect(days[0].phDay).toBe(1);
  });
  it("uses the scans it was given", () => {
    const byDate = new Map<string, DayInput>([
      ["2026-06-02", { date: "2026-06-02", punches: ["07:00", "19:00"] }],
    ]);
    const days = buildMonthDays(2026, 6, byDate, JUNE_HOLIDAYS);
    expect(days[1].workedMin).toBe(720);
    expect(days[1].basicDay).toBe(1);
  });
});

describe("calcMonth", () => {
  it("adds up a full month and converts to decimal hours", () => {
    const byDate = new Map<string, DayInput>();
    // Work 07:00-19:00 on every non-Saturday, non-holiday day.
    for (let d = 2; d <= 30; d++) {
      const iso = `2026-06-${String(d).padStart(2, "0")}`;
      if ([6, 13, 20, 27].includes(d)) continue;
      byDate.set(iso, { date: iso, punches: ["07:00", "19:00"] });
    }
    const days = buildMonthDays(2026, 6, byDate, JUNE_HOLIDAYS);
    const t = calcMonth("B32", days, workingDaysInMonth(2026, 6, JUNE_HOLIDAYS));
    expect(t.basicDays).toBe(25);
    expect(t.workingDays).toBe(25);
    expect(t.nonPayLeave).toBe(0);
    expect(t.phDays).toBe(1);
    expect(t.otHours).toBe(81.25); // 25 days x 195 min = 4875 min
  });

  it("counts unworked working days as non-pay leave", () => {
    const days = buildMonthDays(2026, 6, new Map(), JUNE_HOLIDAYS);
    const t = calcMonth("B32", days, 25);
    expect(t.basicDays).toBe(0);
    expect(t.nonPayLeave).toBe(25);
  });

  it("does not charge non-pay leave for days taken as paid leave", () => {
    const days = buildMonthDays(2026, 6, new Map(), JUNE_HOLIDAYS);
    const t = calcMonth("B32", days, 25, 25);
    expect(t.nonPayLeave).toBe(0);
  });

  it("never reports negative non-pay leave", () => {
    const days = buildMonthDays(2026, 6, new Map(), JUNE_HOLIDAYS);
    const t = calcMonth("B32", days, 25, 40);
    expect(t.nonPayLeave).toBe(0);
  });

  it("lets an early-finish day contra against the month's overtime", () => {
    const byDate = new Map<string, DayInput>([
      ["2026-06-02", { date: "2026-06-02", punches: ["07:00", "19:00"] }], // +195
      ["2026-06-03", { date: "2026-06-03", punches: ["07:00", "14:00"] }], // -90
    ]);
    const days = buildMonthDays(2026, 6, byDate, JUNE_HOLIDAYS);
    const t = calcMonth("B32", days, 25);
    expect(t.otHours).toBe(1.75); // 105 minutes
    expect(t.basicDays).toBe(2);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/month-calc.test.ts`
Expected: FAIL — `Failed to resolve import "./month-calc"`

- [ ] **Step 3: Write the implementation**

Create `src/lib/month-calc.ts`:

```ts
// A worker's month. Builds a result for every calendar date — not only the
// dates that were scanned — because a public holiday and an absence both need
// to be counted on days where nothing was recorded.
import { DayInput, DayResult, MonthTotals } from "./types";
import { calcDay, dayKind } from "./day-calc";
import { daysInMonth, isoDate, toDec } from "./time";

export function workingDaysInMonth(year: number, month: number, holidays: Set<string>): number {
  let count = 0;
  for (let day = 1; day <= daysInMonth(year, month); day++) {
    const iso = isoDate(year, month, day);
    if (holidays.has(iso)) continue;                       // holiday
    if (new Date(year, month - 1, day).getDay() === 6) continue; // Saturday
    count++;
  }
  return count;
}

export function buildMonthDays(
  year: number,
  month: number,
  byDate: Map<string, DayInput>,
  holidays: Set<string>,
): DayResult[] {
  const out: DayResult[] = [];
  for (let day = 1; day <= daysInMonth(year, month); day++) {
    const iso = isoDate(year, month, day);
    const input = byDate.get(iso) ?? { date: iso, punches: [] };
    out.push(calcDay(input, dayKind(iso, holidays)));
  }
  return out;
}

export function calcMonth(
  code: string,
  days: DayResult[],
  workingDays: number,
  paidLeaveDays = 0,
): MonthTotals {
  let basicDays = 0;
  let otMin = 0;
  let restMin = 0;
  let phDays = 0;
  let phOtMin = 0;

  for (const day of days) {
    basicDays += day.basicDay;
    otMin += day.otMin;
    restMin += day.restMin;
    phDays += day.phDay;
    phOtMin += day.phOtMin;
  }

  return {
    code,
    workingDays,
    basicDays,
    otHours: toDec(otMin),
    restDayHours: toDec(restMin),
    phDays,
    phOtHours: toDec(phOtMin),
    nonPayLeave: Math.max(0, workingDays - basicDays - paidLeaveDays),
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/month-calc.test.ts`
Expected: PASS — 11 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/month-calc.ts src/lib/month-calc.test.ts
git commit -m "feat: monthly totals with working days, non-pay leave and OT contra"
```

---

### Task 4: `flags` — the review list

Nothing incomplete may reach the export. This produces the list the office clears.

**Files:**
- Create: `TungLamHR/app/src/lib/flags.ts`
- Test: `TungLamHR/app/src/lib/flags.test.ts`

**Interfaces:**
- Consumes: `DayInput`, `DayResult`, `Flag`, `Worker` from `types.ts`
- Produces:
  - `TOO_LONG_MIN`, `TOO_SHORT_MIN`, `DEFAULT_FINISH` — constants
  - `flagsForWorker(worker: Worker, days: DayResult[], byDate: Map<string, DayInput>, defaultFinish?: string): Flag[]`
  - `flagsForUnmatched(scannerIds: { scannerId: string; name: string }[]): Flag[]`
  - `flagsForNeverScanned(workers: Worker[], seenCodes: Set<string>): Flag[]`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/flags.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { flagsForWorker, flagsForNeverScanned, flagsForUnmatched } from "./flags";
import { buildMonthDays } from "./month-calc";
import { DayInput, Worker } from "./types";

const HOL = new Set(["2026-06-01"]);
const W: Worker = {
  code: "B32", scannerId: "2028", name: "ISLAM MD NORUL",
  site: "KB", group: "B4", nationality: "Bangladesh", status: "active",
};

function run(entries: DayInput[]) {
  const byDate = new Map(entries.map((e) => [e.date, e]));
  const days = buildMonthDays(2026, 6, byDate, HOL);
  return flagsForWorker(W, days, byDate);
}

describe("flagsForWorker", () => {
  it("flags a day with only one punch and suggests the standard finish time", () => {
    const flags = run([{ date: "2026-06-02", punches: ["07:06"] }]);
    const f = flags.find((x) => x.date === "2026-06-02")!;
    expect(f.kind).toBe("SINGLE_PUNCH");
    expect(f.suggestFirst).toBe("07:06");
    expect(f.suggestLast).toBe("19:00");
    expect(f.message).toContain("scanned once");
  });

  it("flags a day over 16 hours", () => {
    const flags = run([{ date: "2026-06-02", punches: ["04:00", "21:00"] }]);
    expect(flags.find((x) => x.date === "2026-06-02")!.kind).toBe("TOO_LONG");
  });

  it("flags a working day under 2 hours", () => {
    const flags = run([{ date: "2026-06-02", punches: ["07:00", "08:30"] }]);
    expect(flags.find((x) => x.date === "2026-06-02")!.kind).toBe("TOO_SHORT");
  });

  it("does not flag a short Saturday", () => {
    // 6 June 2026 is a Saturday. Short rest-day work is normal.
    const flags = run([{ date: "2026-06-06", punches: ["07:00", "08:30"] }]);
    expect(flags.some((x) => x.date === "2026-06-06")).toBe(false);
  });

  it("flags a working day with no scan at all", () => {
    const flags = run([]);
    const f = flags.find((x) => x.date === "2026-06-02")!;
    expect(f.kind).toBe("NO_SCAN");
  });

  it("does not flag an unworked Saturday or public holiday", () => {
    const flags = run([]);
    expect(flags.some((x) => x.date === "2026-06-01")).toBe(false); // holiday
    expect(flags.some((x) => x.date === "2026-06-06")).toBe(false); // Saturday
  });

  it("raises nothing once the office has marked the day absent", () => {
    const flags = run([{ date: "2026-06-02", punches: [], markedAbsent: true }]);
    expect(flags.some((x) => x.date === "2026-06-02")).toBe(false);
  });

  it("raises nothing once the office has supplied the missing time", () => {
    const flags = run([{ date: "2026-06-02", punches: ["07:06"], lastOverride: "19:12" }]);
    expect(flags.some((x) => x.date === "2026-06-02")).toBe(false);
  });
});

describe("whole-month flags", () => {
  it("flags a scanner ID that matches no worker", () => {
    const flags = flagsForUnmatched([{ scannerId: "9999", name: "UNKNOWN PERSON" }]);
    expect(flags[0].kind).toBe("UNKNOWN_WORKER");
    expect(flags[0].code).toBeNull();
    expect(flags[0].message).toContain("9999");
  });

  it("flags an active worker who never scanned all month", () => {
    const flags = flagsForNeverScanned([W], new Set());
    expect(flags[0].kind).toBe("NEVER_SCANNED");
    expect(flags[0].code).toBe("B32");
  });

  it("does not flag a worker who has left", () => {
    const flags = flagsForNeverScanned([{ ...W, status: "left" }], new Set());
    expect(flags).toHaveLength(0);
  });

  it("does not flag a worker who did scan", () => {
    expect(flagsForNeverScanned([W], new Set(["B32"]))).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/flags.test.ts`
Expected: FAIL — `Failed to resolve import "./flags"`

- [ ] **Step 3: Write the implementation**

Create `src/lib/flags.ts`:

```ts
// Everything the office must look at before a Million file may be produced.
//
// Half the trial scan data had a single punch. A system that quietly valued
// those days would be worse than the spreadsheet it replaces, so nothing
// incomplete is ever given a number — it is put on this list instead.
import { DayInput, DayResult, Flag, Worker } from "./types";

export const TOO_LONG_MIN = 16 * 60;
export const TOO_SHORT_MIN = 2 * 60;
/** Offered as the pre-filled finish time when someone forgot to scan out. */
export const DEFAULT_FINISH = "19:00";

function flag(partial: Omit<Flag, "punches"> & { punches?: string[] }): Flag {
  return { punches: [], ...partial };
}

export function flagsForWorker(
  worker: Worker,
  days: DayResult[],
  byDate: Map<string, DayInput>,
  defaultFinish: string = DEFAULT_FINISH,
): Flag[] {
  const out: Flag[] = [];

  for (const day of days) {
    const input = byDate.get(day.date);
    if (input?.markedAbsent) continue;      // the office has already ruled on it
    if (day.workedMin != null) {
      // A complete day — only its length can be suspicious, and only on a
      // normal day. Short Saturdays and short holidays are ordinary.
      if (day.workedMin > TOO_LONG_MIN) {
        out.push(flag({
          kind: "TOO_LONG", code: worker.code, name: worker.name, date: day.date,
          punches: input?.punches ?? [],
          suggestFirst: null, suggestLast: null,
          message: `${worker.name} shows over 16 hours on this day. Almost certainly a missed scan-out — please check both times.`,
        }));
      } else if (day.kind === "NORMAL" && day.workedMin < TOO_SHORT_MIN) {
        out.push(flag({
          kind: "TOO_SHORT", code: worker.code, name: worker.name, date: day.date,
          punches: input?.punches ?? [],
          suggestFirst: null, suggestLast: null,
          message: `${worker.name} shows under 2 hours on a working day. Please check both times.`,
        }));
      }
      continue;
    }

    // Incomplete. Saturdays and holidays that nobody worked are not problems.
    if (day.kind !== "NORMAL") continue;

    const punches = input?.punches ?? [];
    if (punches.length === 1) {
      out.push(flag({
        kind: "SINGLE_PUNCH", code: worker.code, name: worker.name, date: day.date,
        punches,
        suggestFirst: punches[0],
        suggestLast: defaultFinish,
        message: `${worker.name} scanned once on this day, so we cannot tell how long they worked. Accept the suggested finish time or correct it.`,
      }));
    } else {
      out.push(flag({
        kind: "NO_SCAN", code: worker.code, name: worker.name, date: day.date,
        punches,
        suggestFirst: null, suggestLast: null,
        message: `${worker.name} has no scan on this working day. Mark them absent, or key the times in.`,
      }));
    }
  }

  return out;
}

export function flagsForUnmatched(rows: { scannerId: string; name: string }[]): Flag[] {
  return rows.map((r) =>
    flag({
      kind: "UNKNOWN_WORKER", code: null, name: r.name, date: null,
      suggestFirst: null, suggestLast: null,
      message: `Scanner ID ${r.scannerId} (${r.name}) is not in your worker list. Add the worker, or ignore these rows.`,
    }),
  );
}

export function flagsForNeverScanned(workers: Worker[], seenCodes: Set<string>): Flag[] {
  return workers
    .filter((w) => w.status === "active" && !seenCodes.has(w.code))
    .map((w) =>
      flag({
        kind: "NEVER_SCANNED", code: w.code, name: w.name, date: null,
        suggestFirst: null, suggestLast: null,
        message: `${w.name} (${w.code}) did not scan at all this month. Mark them as left or balik cuti if they have gone.`,
      }),
    );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/flags.test.ts`
Expected: PASS — 12 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/flags.ts src/lib/flags.test.ts
git commit -m "feat: review flags that block export until the office clears them"
```

---

### Task 5: `checktime-reader` — read the scanner export

**Files:**
- Create: `TungLamHR/app/src/lib/checktime-reader.ts`
- Test: `TungLamHR/app/src/lib/checktime-reader.test.ts`

**Interfaces:**
- Consumes: `xlsx` only — this reader is deliberately free of the calculation core
- Produces:
  - `interface ScanRow { scannerId: string; name: string; date: string; punches: string[] }`
  - `readCheckTime(buffer: ArrayBuffer | Buffer): ScanRow[]`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/checktime-reader.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import fs from "node:fs";
import { readCheckTime } from "./checktime-reader";

const REAL = "c:/Users/USER/OneDrive/Desktop/TungLam/CHECKTIME_InOutReportAll.xlsx";

/** Build a miniature CheckTime export with the same shape as the real one. */
function fakeExport(dataRows: unknown[][]): Buffer {
  const header = [
    "EMP ID", null, "Name", null, null, "Department", null, "Date",
    "Check In 1", "Check Out 1", "Check In 2", "Check Out 2", "Check In 3", "Check Out 3",
    "Check In 4", "Check Out 4", "Check In 5", "Check Out 5", "Check In 6", "Check Out 6",
    "Check In 7", "Check Out 7", "Check In 8", "Check Out 8", "Check In 9", "Check Out 9",
    "Check In 10", "Check Out 10", null, "Total Hours", "Location",
  ];
  const aoa = [["In Out Report"], [], [], [], [], [], header, ...dataRows];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), "InOutReportAll");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}

const row = (id: string, name: string, date: string, ...punches: (string | null)[]) => {
  const r: (string | null)[] = [id, null, name, null, null, "Tung Lam", null, date];
  for (let i = 0; i < 20; i++) r.push(punches[i] ?? null);
  r.push(null, "00:00", "xface100-0181");
  return r;
};

describe("readCheckTime", () => {
  it("turns a scan row into a worker, a date and its punches", () => {
    const rows = readCheckTime(fakeExport([row("2028", "ISLAM MD NORUL", "02/06/2026", "07:06", "20:24")]));
    expect(rows).toEqual([
      { scannerId: "2028", name: "ISLAM MD NORUL", date: "2026-06-02", punches: ["07:06", "20:24"] },
    ]);
  });

  it("converts the scanner's day-first dates to ISO", () => {
    const rows = readCheckTime(fakeExport([row("2028", "X", "14/08/2026", "07:00", "19:00")]));
    expect(rows[0].date).toBe("2026-08-14");
  });

  it("keeps every punch in scan order, including the middle ones", () => {
    const rows = readCheckTime(fakeExport([row("81", "X", "14/09/2025", "07:23", "12:24", "20:24")]));
    expect(rows[0].punches).toEqual(["07:23", "12:24", "20:24"]);
  });

  it("keeps a single punch rather than dropping the row", () => {
    const rows = readCheckTime(fakeExport([row("18", "X", "08/09/2025", "17:08")]));
    expect(rows[0].punches).toEqual(["17:08"]);
  });

  it("pads scanner IDs so 18 and 0018 are the same worker", () => {
    const rows = readCheckTime(fakeExport([row("0018", "X", "08/09/2025", "07:00", "19:00")]));
    expect(rows[0].scannerId).toBe("18");
  });

  it("skips rows with no employee ID", () => {
    expect(readCheckTime(fakeExport([row("", "", "", null)]))).toHaveLength(0);
  });

  it("reads the real 2,100-row export from the factory", () => {
    const rows = readCheckTime(fs.readFileSync(REAL));
    expect(rows.length).toBe(2100);
    expect(new Set(rows.map((r) => r.scannerId)).size).toBe(56);
    // The scanner's own Total Hours said 05:01 for this day. We keep all three
    // punches so the real span, 07:23 to 20:24, can be worked out.
    const sep14 = rows.find((r) => r.scannerId === "81" && r.date === "2025-09-14");
    expect(sep14!.punches).toEqual(["07:23", "12:24", "20:24"]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/checktime-reader.test.ts`
Expected: FAIL — `Failed to resolve import "./checktime-reader"`

- [ ] **Step 3: Write the implementation**

Create `src/lib/checktime-reader.ts`:

```ts
// Reads the CheckTime "In Out Report" export.
//
// Two things about this file are load-bearing:
//   1. Its `Total Hours` column is WRONG — it pairs punch 1 with punch 2 and
//      throws the rest away, reporting 5 hours for a 13-hour day. It is never
//      read here.
//   2. The header sits on row 7, and several columns between the labelled ones
//      are blank spacers, so columns are found by name rather than by position.
import * as XLSX from "xlsx";

export interface ScanRow {
  scannerId: string;
  name: string;
  date: string;      // ISO, "2026-06-02"
  punches: string[]; // "HH:MM", in scan order
}

const HEADER_SEARCH_LIMIT = 20;

/** "02/06/2026" (day first, as the scanner writes it) -> "2026-06-02". */
function toIso(raw: unknown): string | null {
  const s = String(raw ?? "").trim();
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const [, day, month, year] = m;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function cleanTime(raw: unknown): string | null {
  const s = String(raw ?? "").trim();
  return /^\d{1,2}:\d{2}$/.test(s) ? s.padStart(5, "0") : null;
}

export function readCheckTime(buffer: ArrayBuffer | Buffer): ScanRow[] {
  const wb = XLSX.read(buffer, { type: "buffer", raw: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const grid = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null });

  const headerIndex = grid.findIndex(
    (r, i) => i < HEADER_SEARCH_LIMIT && Array.isArray(r) && r.some((c) => String(c).trim() === "Check In 1"),
  );
  if (headerIndex < 0) {
    throw new Error(
      "This does not look like a CheckTime In Out Report — no 'Check In 1' column was found.",
    );
  }

  const header = grid[headerIndex].map((c) => String(c ?? "").trim());
  const col = (name: string) => header.indexOf(name);
  const idCol = col("EMP ID");
  const nameCol = col("Name");
  const dateCol = col("Date");
  const punchCols: number[] = [];
  for (let n = 1; n <= 10; n++) {
    for (const label of [`Check In ${n}`, `Check Out ${n}`]) {
      const c = col(label);
      if (c >= 0) punchCols.push(c);
    }
  }

  const out: ScanRow[] = [];
  for (const row of grid.slice(headerIndex + 1)) {
    if (!Array.isArray(row)) continue;
    const rawId = String(row[idCol] ?? "").trim();
    if (!rawId) continue;
    const date = toIso(row[dateCol]);
    if (!date) continue;

    const punches: string[] = [];
    for (const c of punchCols) {
      const t = cleanTime(row[c]);
      if (t) punches.push(t);
    }

    out.push({
      // "0018" and "18" are the same person to the scanner; make them the same
      // person here too, so matching against the worker list cannot miss.
      scannerId: String(Number(rawId)),
      name: String(row[nameCol] ?? "").trim(),
      date,
      punches,
    });
  }
  return out;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/checktime-reader.test.ts`
Expected: PASS — 7 tests, including the real 2,100-row file.

- [ ] **Step 5: Commit**

```bash
git add src/lib/checktime-reader.ts src/lib/checktime-reader.test.ts
git commit -m "feat: read CheckTime scanner export, ignoring its broken Total Hours column"
```

---

### Task 6: `allowance-reader` and `million-writer`

Both sit on the Million side of the system, share the column list, and are reviewed as one deliverable.

**Files:**
- Create: `TungLamHR/app/src/lib/million-columns.ts`
- Create: `TungLamHR/app/src/lib/allowance-reader.ts`
- Create: `TungLamHR/app/src/lib/million-writer.ts`
- Test: `TungLamHR/app/src/lib/million-writer.test.ts`
- Test: `TungLamHR/app/src/lib/allowance-reader.test.ts`

**Interfaces:**
- Consumes: `MonthTotals`, `PayExtras` from `types.ts`; `xlsx`
- Produces:
  - `MILLION_COLUMNS: readonly string[]` (37 entries, exact template strings)
  - `readAllowances(buffer: ArrayBuffer | Buffer): PayExtras[]`
  - `buildMillionRows(totals: MonthTotals[], extras: Map<string, PayExtras>): (string | number)[][]`
  - `writeMillionXls(totals: MonthTotals[], extras: Map<string, PayExtras>): Buffer`

- [ ] **Step 1: Write `src/lib/million-columns.ts`**

These strings are copied verbatim from `MILLION_IMPORT_JULY_2026_ TEMPLATE.xls` row 1. Million matches on them; a single changed character breaks the import.

```ts
/** Row 1 of the Million import file, exactly as the template writes it. */
export const MILLION_COLUMNS = [
  "Employee No.", "Public Holiday", "Working Day", "DAYS WORKED", "Hours of Worked",
  "Lateness", "Early Departure", "No Pay Hour", "OT From Date", "OT To Date",
  "Overtime 1 (1x)", "OVERTIME 2 (1.5x)", "OVERTIME 3 (2x)", "Overtime 4 (3x)",
  "Overtime 5 (Rest day)", "Overtime 6 (PH)", "Absence", "Annual Leave",
  "Compassionate Leave", "Examination Leave", "Hospital Leave", "Line Shutdown Leave",
  "Medical Leave", "Marriage Leave", "Maternity Leave", "NON-PAY LEAVE", "Out of Bound",
  "Paternity Leave", "ALLOWANCE", "Attnd Allowance", "Food Allowance", "Travel Allowance",
  "Absent Deduction Fine", "Advance Cash", "Advance RHB", "ADVANCE", "Zakat",
] as const;

/** The seven columns Stage 1 fills. Everything else is written as 0. */
export const COL = {
  EMPLOYEE_NO: 0,
  PUBLIC_HOLIDAY: 1,
  WORKING_DAY: 2,
  DAYS_WORKED: 3,
  OVERTIME_1_5X: 11,
  OVERTIME_2X: 12,
  NON_PAY_LEAVE: 25,
  ALLOWANCE: 28,
  ADVANCE: 35,
} as const;
```

- [ ] **Step 2: Write the failing tests**

Create `src/lib/million-writer.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import fs from "node:fs";
import { buildMillionRows, writeMillionXls } from "./million-writer";
import { MILLION_COLUMNS, COL } from "./million-columns";
import { MonthTotals, PayExtras } from "./types";

const TEMPLATE = "c:/Users/USER/OneDrive/Desktop/TungLam/MILLION_IMPORT_JULY_2026_ TEMPLATE.xls";

const totals: MonthTotals = {
  code: "B08", workingDays: 27, basicDays: 27, otHours: 96.63,
  restDayHours: 0, phDays: 0, phOtHours: 0, nonPayLeave: 0,
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
    const r = buildMillionRows(
      [{ ...totals, restDayHours: 10.5, phOtHours: 4.25 }], extras,
    )[1];
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
```

Create `src/lib/allowance-reader.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { readAllowances } from "./allowance-reader";

function sheet(aoa: unknown[][]): Buffer {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), "Sheet1");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}

describe("readAllowances", () => {
  it("reads code, allowance and advance", () => {
    const buf = sheet([["CODE", "ALLOWANCE", "ADVANCE"], ["B08", 200, 550], ["M04", 100, 50]]);
    expect(readAllowances(buf)).toEqual([
      { code: "B08", allowance: 200, advance: 550 },
      { code: "M04", allowance: 100, advance: 50 },
    ]);
  });

  it("does not care about column order or letter case", () => {
    const buf = sheet([["advance", "code", "allowance"], [550, "B08", 200]]);
    expect(readAllowances(buf)).toEqual([{ code: "B08", allowance: 200, advance: 550 }]);
  });

  it("treats a blank amount as zero", () => {
    const buf = sheet([["CODE", "ALLOWANCE", "ADVANCE"], ["B08", null, 550]]);
    expect(readAllowances(buf)[0].allowance).toBe(0);
  });

  it("skips rows with no code", () => {
    const buf = sheet([["CODE", "ALLOWANCE", "ADVANCE"], ["", 200, 550], ["B08", 100, 0]]);
    expect(readAllowances(buf)).toHaveLength(1);
  });

  it("says plainly what is wrong when the CODE column is missing", () => {
    const buf = sheet([["NAME", "ALLOWANCE"], ["Someone", 200]]);
    expect(() => readAllowances(buf)).toThrow(/CODE/);
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run src/lib/million-writer.test.ts src/lib/allowance-reader.test.ts`
Expected: FAIL — both imports unresolved.

- [ ] **Step 4: Write `src/lib/allowance-reader.ts`**

```ts
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
```

- [ ] **Step 5: Write `src/lib/million-writer.ts`**

```ts
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
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(buildMillionRows(totals, extras)), "Sheet1");
  return XLSX.write(wb, { type: "buffer", bookType: "biff8" }) as Buffer;
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run src/lib/million-writer.test.ts src/lib/allowance-reader.test.ts`
Expected: PASS — 12 tests, including the byte-format check and the B08 row reproduction.

- [ ] **Step 7: Commit**

```bash
git add src/lib/million-columns.ts src/lib/million-writer.ts src/lib/million-writer.test.ts src/lib/allowance-reader.ts src/lib/allowance-reader.test.ts
git commit -m "feat: read allowance sheet and write true .xls Million import file"
```

---

### Task 7: Golden-master test against all 85 workers of June 2026

The acceptance test for the whole engine. Extracts every worker's June punch times from the owner's spreadsheet and proves the new rules reproduce it — including, precisely, the two places the new rules deliberately differ.

**Files:**
- Create: `TungLamHR/app/scripts/extract-june-fixture.mjs`
- Create: `TungLamHR/app/src/lib/__fixtures__/june-2026.json` (generated)
- Test: `TungLamHR/app/src/lib/golden-june.test.ts`

**Interfaces:**
- Consumes: `calcDay`, `dayKind` from `day-calc.ts`; `buildMonthDays`, `calcMonth`, `workingDaysInMonth` from `month-calc.ts`
- Produces: the fixture file; no runtime exports.

**Why the expected values are not simply the spreadsheet's:** the new rules differ from the sheet in exactly two ways, both approved. Lunch is a flat hour where the sheet used a hand-keyed 1h or 1h40, and the tea break is 15 minutes on qualifying days where the sheet took 9 minutes on all days. So each day is asserted as:

```
ourDayOT  ==  sheetDayOT + (sheetLunchMin - 60) - ourR2Min
```

Everything else — hours worked, basic days, rest-day hours, holiday credit — must match the sheet exactly. Any mismatch there is a real bug.

- [ ] **Step 1: Write the fixture extractor**

Create `scripts/extract-june-fixture.mjs`:

```js
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
  while (minutes >= 60) { hours += 1; minutes -= 60; }
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
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

const wb = XLSX.readFile(SRC, { cellFormula: false });
const workers = [];

for (const sheetName of wb.SheetNames) {
  if (sheetName === "Sheet2") continue;
  const grid = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: null, blankrows: true });
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
        in: hmToClock(row[c + 2]),
        out: hmToClock(row[c + 5] ?? row[c + 3]),
        hrsWrkMin: hmToMinutes(row[c + 6]),
        basicMin: hmToMinutes(row[c + 7]),
        lunchMin: hmToMinutes(row[c + 8]),
        otMin: hmToMinutes(row[c + 9]),
        remark: row[c + 12] == null ? null : String(row[c + 12]).trim(),
      });
    }

    workers.push({ sheet: sheetName, code: code == null ? null : String(code).trim(), name: String(name).trim(), days });
  }
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify({ month: "2026-06", holidays: ["2026-06-01"], workers }, null, 2));
console.log(`Wrote ${workers.length} workers to ${OUT}`);
```

- [ ] **Step 2: Generate the fixture**

Run: `node scripts/extract-june-fixture.mjs`
Expected: `Wrote 85 workers to .../june-2026.json`

- [ ] **Step 3: Write the golden-master test**

Create `src/lib/golden-june.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import fixture from "./__fixtures__/june-2026.json";
import { calcDay, dayKind, LUNCH_MIN } from "./day-calc";
import { buildMonthDays, calcMonth, workingDaysInMonth } from "./month-calc";
import { DayInput } from "./types";

const HOLIDAYS = new Set(fixture.holidays);
const iso = (day: number) => `2026-06-${String(day).padStart(2, "0")}`;

/** Workers whose blocks hold no clock times at all — nothing to check against. */
const EMPTY = new Set(["SHOHEL", "RITESH", "RAMESH", "MUKHIYA BIN SHAMBHU"]);
/**
 * DIPESH's block has 7.30 typed against every day but no clock times, so the
 * sheet's own formulas produce -364.67 hours of overtime. It is junk, not a
 * result to reproduce.
 */
const BROKEN = new Set(["DIPESH"]);

const testable = fixture.workers.filter(
  (w) => !EMPTY.has(w.name) && !BROKEN.has(w.name) && w.days.some((d) => d.in && d.out),
);

describe("June 2026 golden master", () => {
  it("has the owner's 85 workers, 80 of them with real data", () => {
    expect(fixture.workers).toHaveLength(85);
    // Five blocks hold no clock times at all: DIPESH, SHOHEL, RITESH, RAMESH
    // and MUKHIYA BIN SHAMBHU. Verified against the workbook.
    expect(testable.length).toBe(80);
  });

  it.each(testable.map((w) => [w.name, w] as const))(
    "%s — every day matches the owner's sheet",
    (_name, worker) => {
      for (const d of worker.days) {
        if (!d.in || !d.out) continue;
        const date = iso(d.day);
        const input: DayInput = { date, punches: [d.in, d.out] };
        const got = calcDay(input, dayKind(date, HOLIDAYS));

        // Hours worked is pure arithmetic on the owner's own times.
        expect(got.workedMin, `${worker.name} day ${d.day}: hours worked`).toBe(d.hrsWrkMin);

        if (got.kind === "REST") {
          expect(got.restMin, `${worker.name} day ${d.day}: rest day hours`).toBe(d.otMin);
          expect(got.basicDay).toBe(0);
          continue;
        }

        if (got.kind === "PH") {
          // Deliberate difference: flat 1h lunch, and only past 5 hours worked.
          const expected = d.hrsWrkMin! - got.lunchMin;
          expect(got.phOtMin, `${worker.name} day ${d.day}: PH overtime`).toBe(expected);
          continue;
        }

        expect(got.basicDay, `${worker.name} day ${d.day}: basic day`).toBe(d.basicMin ? 1 : 0);
        if (!d.basicMin) continue;

        // The two approved rule changes, stated as arithmetic:
        //   flat 1h lunch instead of the hand-keyed 1h/1h40, and
        //   15 min of tea break on qualifying days instead of 9 min on all.
        const expectedOt = d.otMin! + (d.lunchMin! - LUNCH_MIN) - got.r2Min;
        expect(got.otMin, `${worker.name} day ${d.day}: overtime`).toBe(expectedOt);
      }
    },
  );

  it.each(testable.map((w) => [w.name, w] as const))(
    "%s — monthly totals match the owner's sheet",
    (_name, worker) => {
      const byDate = new Map<string, DayInput>();
      for (const d of worker.days) {
        if (d.in && d.out) byDate.set(iso(d.day), { date: iso(d.day), punches: [d.in, d.out] });
      }
      const days = buildMonthDays(2026, 6, byDate, HOLIDAYS);
      const totals = calcMonth(worker.code ?? worker.name, days, workingDaysInMonth(2026, 6, HOLIDAYS));

      const sheetBasicDays = worker.days.filter(
        (d) => d.basicMin && d.dow !== "SAT" && d.day !== 1,
      ).length;
      expect(totals.basicDays, `${worker.name}: basic days`).toBe(sheetBasicDays);

      const sheetRestMin = worker.days
        .filter((d) => d.dow === "SAT")
        .reduce((sum, d) => sum + (d.otMin ?? 0), 0);
      expect(totals.restDayHours, `${worker.name}: rest day hours`)
        .toBe(Math.round((sheetRestMin / 60) * 100) / 100);

      // Every active worker is credited the 1 June holiday. The sheet missed
      // TUN NAING OO; that miss is the bug this system exists to prevent.
      expect(totals.phDays, `${worker.name}: public holiday days`).toBe(1);
      expect(totals.workingDays).toBe(25);
    },
  );
});
```

- [ ] **Step 4: Run the golden master**

Run: `npx vitest run src/lib/golden-june.test.ts`
Expected: PASS — 160 assertions across 80 workers.

If any worker fails, the calculation is wrong, not the fixture. Read the named worker and day out of the failure message and compare against `Payroll_June_Sample.xlsx` before changing anything.

- [ ] **Step 5: Run the whole suite**

Run: `npm test`
Expected: PASS — every test from Tasks 1–7.

- [ ] **Step 6: Commit**

```bash
git add scripts/extract-june-fixture.mjs src/lib/__fixtures__/june-2026.json src/lib/golden-june.test.ts
git commit -m "test: golden master proving the engine against 79 real workers of June 2026"
```

---

### Task 8: Supabase schema and store

**Files:**
- Create: `TungLamHR/app/supabase/schema.sql`
- Create: `TungLamHR/app/src/lib/store.ts`
- Test: `TungLamHR/app/src/lib/store.test.ts`

**Interfaces:**
- Consumes: `Worker`, `DayInput`, `PayExtras` from `types.ts`; `serverSupabase` from `supabase-server.ts`
- Produces:
  - `listWorkers(): Promise<Worker[]>`
  - `upsertWorker(w: Worker): Promise<void>`
  - `deleteWorker(code: string): Promise<void>`
  - `interface ScanDbRow { code: string; work_date: string; punches: string[] }`
  - `saveMonthScans(monthKey: string, rows: ScanDbRow[]): Promise<void>`
  - `saveCorrection(monthKey: string, code: string, date: string, patch: Pick<DayInput, "firstOverride" | "lastOverride" | "markedAbsent">): Promise<void>`
  - `loadMonth(monthKey: string): Promise<Map<string, DayInput[]>>` — scans and corrections already merged, keyed by worker code
  - `saveExtras(monthKey: string, extras: PayExtras[]): Promise<void>`
  - `loadExtras(monthKey: string): Promise<Map<string, PayExtras>>`
  - `rowToWorker`, `workerToRow`, `rowsToDayInputs` — pure, exported for testing

- [ ] **Step 1: Write the schema**

Create `supabase/schema.sql`:

```sql
-- TungLam HR, Stage 1. Run this once in the Supabase SQL editor.
-- Every table is reached only through the server, using the secret key, so
-- row level security is left on with no public policy: nothing in the browser
-- can read wages directly.

create table if not exists workers (
  code         text primary key,          -- Million code, e.g. 'B32'
  scanner_id   text not null default '',  -- CheckTime EMP ID
  name         text not null,
  site         text not null check (site in ('KB','KL')),
  "group"      text not null check ("group" in ('B1','B2','B3','B4')),
  nationality  text,
  status       text not null default 'active'
               check (status in ('active','left','balik-cuti')),
  updated_at   timestamptz not null default now()
);
create index if not exists workers_scanner_id_idx on workers (scanner_id);

create table if not exists month_scans (
  month_key  text not null,               -- '2026-06'
  code       text not null references workers(code) on delete cascade,
  work_date  date not null,
  punches    text[] not null default '{}',
  primary key (month_key, code, work_date)
);

create table if not exists month_corrections (
  month_key      text not null,
  code           text not null references workers(code) on delete cascade,
  work_date      date not null,
  first_override text,
  last_override  text,
  marked_absent  boolean not null default false,
  updated_at     timestamptz not null default now(),
  primary key (month_key, code, work_date)
);

create table if not exists month_extras (
  month_key text not null,
  code      text not null references workers(code) on delete cascade,
  allowance numeric not null default 0,
  advance   numeric not null default 0,
  primary key (month_key, code)
);

alter table workers            enable row level security;
alter table month_scans        enable row level security;
alter table month_corrections  enable row level security;
alter table month_extras       enable row level security;
```

- [ ] **Step 2: Write the failing test**

`store.ts` talks to a real database, so the test covers the pure translation between database rows and application types — the part that can silently drift.

Create `src/lib/store.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { rowToWorker, workerToRow, rowsToDayInputs } from "./store";

describe("rowToWorker / workerToRow", () => {
  it("round-trips a worker through the database shape", () => {
    const w = {
      code: "B32", scannerId: "2028", name: "ISLAM MD NORUL",
      site: "KB" as const, group: "B4" as const,
      nationality: "Bangladesh", status: "active" as const,
    };
    expect(rowToWorker(workerToRow(w))).toEqual(w);
  });

  it("reads the quoted group column, which is a reserved word in SQL", () => {
    expect(workerToRow({
      code: "M04", scannerId: "", name: "THAN WAI PHYO", site: "KL",
      group: "B2", nationality: null, status: "left",
    })).toMatchObject({ group: "B2", scanner_id: "" });
  });
});

describe("rowsToDayInputs", () => {
  it("merges scans with the office's corrections for the same day", () => {
    const inputs = rowsToDayInputs(
      [{ code: "B32", work_date: "2026-06-02", punches: ["07:06"] }],
      [{ code: "B32", work_date: "2026-06-02", first_override: null, last_override: "19:12", marked_absent: false }],
    );
    expect(inputs.get("B32")).toEqual([
      { date: "2026-06-02", punches: ["07:06"], firstOverride: null, lastOverride: "19:12", markedAbsent: false },
    ]);
  });

  it("keeps a correction for a day that was never scanned", () => {
    const inputs = rowsToDayInputs(
      [],
      [{ code: "B32", work_date: "2026-06-03", first_override: "07:00", last_override: "19:00", marked_absent: false }],
    );
    expect(inputs.get("B32")![0]).toMatchObject({ date: "2026-06-03", punches: [], firstOverride: "07:00" });
  });

  it("groups by worker", () => {
    const inputs = rowsToDayInputs(
      [
        { code: "B32", work_date: "2026-06-02", punches: ["07:00", "19:00"] },
        { code: "M04", work_date: "2026-06-02", punches: ["07:10", "18:00"] },
      ],
      [],
    );
    expect([...inputs.keys()].sort()).toEqual(["B32", "M04"]);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/lib/store.test.ts`
Expected: FAIL — `Failed to resolve import "./store"`

- [ ] **Step 4: Write `src/lib/store.ts`**

Implement the nine functions listed under **Interfaces** above, plus the three pure helpers the test imports:

```ts
import "server-only";
import { serverSupabase } from "./supabase-server";
import { DayInput, PayExtras, Worker } from "./types";

export interface WorkerRow {
  code: string; scanner_id: string; name: string; site: string;
  group: string; nationality: string | null; status: string;
}

export function workerToRow(w: Worker): WorkerRow {
  return {
    code: w.code, scanner_id: w.scannerId, name: w.name, site: w.site,
    group: w.group, nationality: w.nationality, status: w.status,
  };
}

export function rowToWorker(r: WorkerRow): Worker {
  return {
    code: r.code, scannerId: r.scanner_id, name: r.name,
    site: r.site as Worker["site"], group: r.group as Worker["group"],
    nationality: r.nationality, status: r.status as Worker["status"],
  };
}

export interface ScanDbRow { code: string; work_date: string; punches: string[] }
export interface CorrectionDbRow {
  code: string; work_date: string;
  first_override: string | null; last_override: string | null; marked_absent: boolean;
}

/** Scans and office corrections describe the same days; this is where they meet. */
export function rowsToDayInputs(
  scans: ScanDbRow[],
  corrections: CorrectionDbRow[],
): Map<string, DayInput[]> {
  const byWorker = new Map<string, Map<string, DayInput>>();
  const slot = (code: string, date: string): DayInput => {
    if (!byWorker.has(code)) byWorker.set(code, new Map());
    const days = byWorker.get(code)!;
    if (!days.has(date)) days.set(date, { date, punches: [] });
    return days.get(date)!;
  };

  for (const s of scans) slot(s.code, s.work_date).punches = s.punches ?? [];
  for (const c of corrections) {
    const day = slot(c.code, c.work_date);
    day.firstOverride = c.first_override;
    day.lastOverride = c.last_override;
    day.markedAbsent = c.marked_absent;
  }

  const out = new Map<string, DayInput[]>();
  for (const [code, days] of byWorker) {
    out.set(code, [...days.values()].sort((a, b) => a.date.localeCompare(b.date)));
  }
  return out;
}
```

Then the database functions, in the same file:

```ts
/** Every failure here reaches the office as a sentence, not a stack trace. */
function fail(what: string, error: { message: string } | null): void {
  if (error) throw new Error(`${what}: ${error.message}`);
}

export async function listWorkers(): Promise<Worker[]> {
  const { data, error } = await serverSupabase()
    .from("workers").select("*").order("code");
  fail("Could not load the worker list", error);
  return (data ?? []).map(rowToWorker);
}

export async function upsertWorker(w: Worker): Promise<void> {
  const { error } = await serverSupabase()
    .from("workers").upsert(workerToRow(w), { onConflict: "code" });
  fail(`Could not save ${w.name}`, error);
}

export async function deleteWorker(code: string): Promise<void> {
  const { error } = await serverSupabase().from("workers").delete().eq("code", code);
  fail(`Could not remove worker ${code}`, error);
}

/**
 * Replaces the month's scans for the workers in this upload.
 *
 * Deleting first means a re-upload of a corrected export overwrites rather than
 * doubling up — the office will re-upload, and doubled punches would be
 * invisible in the totals.
 */
export async function saveMonthScans(monthKey: string, rows: ScanDbRow[]): Promise<void> {
  const db = serverSupabase();
  const codes = [...new Set(rows.map((r) => r.code))];
  if (codes.length > 0) {
    const { error } = await db
      .from("month_scans").delete().eq("month_key", monthKey).in("code", codes);
    fail("Could not clear the previous upload", error);
  }
  if (rows.length === 0) return;
  const { error } = await db
    .from("month_scans")
    .insert(rows.map((r) => ({ month_key: monthKey, ...r })));
  fail("Could not save the scan data", error);
}

export async function saveCorrection(
  monthKey: string,
  code: string,
  date: string,
  patch: Pick<DayInput, "firstOverride" | "lastOverride" | "markedAbsent">,
): Promise<void> {
  const { error } = await serverSupabase().from("month_corrections").upsert(
    {
      month_key: monthKey, code, work_date: date,
      first_override: patch.firstOverride ?? null,
      last_override: patch.lastOverride ?? null,
      marked_absent: patch.markedAbsent ?? false,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "month_key,code,work_date" },
  );
  fail("Could not save that correction", error);
}

/** Scans and corrections for a month, already merged per worker. */
export async function loadMonth(monthKey: string): Promise<Map<string, DayInput[]>> {
  const db = serverSupabase();
  const [scans, corrections] = await Promise.all([
    db.from("month_scans").select("code, work_date, punches").eq("month_key", monthKey),
    db.from("month_corrections")
      .select("code, work_date, first_override, last_override, marked_absent")
      .eq("month_key", monthKey),
  ]);
  fail("Could not load this month's scans", scans.error);
  fail("Could not load this month's corrections", corrections.error);
  return rowsToDayInputs(
    (scans.data ?? []) as ScanDbRow[],
    (corrections.data ?? []) as CorrectionDbRow[],
  );
}

export async function saveExtras(monthKey: string, extras: PayExtras[]): Promise<void> {
  if (extras.length === 0) return;
  const { error } = await serverSupabase().from("month_extras").upsert(
    extras.map((e) => ({
      month_key: monthKey, code: e.code, allowance: e.allowance, advance: e.advance,
    })),
    { onConflict: "month_key,code" },
  );
  fail("Could not save the allowance and advance figures", error);
}

export async function loadExtras(monthKey: string): Promise<Map<string, PayExtras>> {
  const { data, error } = await serverSupabase()
    .from("month_extras").select("code, allowance, advance").eq("month_key", monthKey);
  fail("Could not load the allowance and advance figures", error);
  return new Map(
    (data ?? []).map((r) => [
      r.code,
      { code: r.code, allowance: Number(r.allowance), advance: Number(r.advance) },
    ]),
  );
}
```

Note the two `loadMonthScans` / `loadCorrections` entries in the Interfaces block above are served by the single `loadMonth`, which merges them — separating them would only invite a caller to use one without the other and value a day the office has already corrected.

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/lib/store.test.ts`
Expected: PASS — 6 tests.

- [ ] **Step 6: Apply the schema and check the connection**

Paste `supabase/schema.sql` into the Supabase SQL editor and run it. Confirm the four tables appear under Table Editor.

- [ ] **Step 7: Commit**

```bash
git add supabase/schema.sql src/lib/store.ts src/lib/store.test.ts
git commit -m "feat: Supabase schema and store for workers, scans, corrections and extras"
```

---

### Task 9: Login and app shell

**Files:**
- Create: `TungLamHR/app/src/app/login/page.tsx`
- Create: `TungLamHR/app/src/app/api/login/route.ts`
- Create: `TungLamHR/app/src/app/api/logout/route.ts`
- Create: `TungLamHR/app/src/proxy.ts`
- Create: `TungLamHR/app/src/app/(app)/layout.tsx`
- Modify: `TungLamHR/app/src/app/globals.css`
- Modify: `TungLamHR/app/src/app/layout.tsx`
- Reference: `TungLamHRSystem/hr-app/src/app/login/page.tsx`, `.../api/login/route.ts`, `.../api/logout/route.ts`, `.../proxy.ts`, `.../globals.css`

**Interfaces:**
- Consumes: `signSession`, `verifySession`, `timingSafeEqual`, `SESSION_COOKIE` from `session.ts`
- Produces: a `(app)` route group that only a signed session may enter, with a nav bar linking Workers and Month.

- [ ] **Step 1: Copy the four auth files and the stylesheet across**

```bash
OLD="c:/Users/USER/OneDrive/Desktop/TungLam/TungLamHRSystem/hr-app"
mkdir -p src/app/login src/app/api/login src/app/api/logout "src/app/(app)"
cp "$OLD/src/app/login/page.tsx"       src/app/login/page.tsx
cp "$OLD/src/app/api/login/route.ts"   src/app/api/login/route.ts
cp "$OLD/src/app/api/logout/route.ts"  src/app/api/logout/route.ts
cp "$OLD/src/proxy.ts"                 src/proxy.ts
cp "$OLD/src/app/globals.css"          src/app/globals.css
```

- [ ] **Step 2: Write the `(app)` layout**

Create `src/app/(app)/layout.tsx` — a server component that calls `requireSession()` and `redirect("/login")` when it returns false, then renders a header with the company name, links to `/workers` and `/month`, and a Sign out button posting to `/api/logout`.

- [ ] **Step 3: Check the door is locked**

Run: `npm run dev`, then visit `http://localhost:3000/workers` in a private window.
Expected: redirected to `/login`. After entering the password from `.env.local`, `/workers` opens.

- [ ] **Step 4: Run the suite**

Run: `npm test`
Expected: PASS — including the lifted `session.test.ts`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: password login and signed-in app shell"
```

---

### Task 10: Workers screen

**Files:**
- Create: `TungLamHR/app/src/app/(app)/workers/page.tsx`
- Create: `TungLamHR/app/src/app/api/workers/route.ts`
- Create: `TungLamHR/app/scripts/import-workers.mjs`

**Interfaces:**
- Consumes: `listWorkers`, `upsertWorker`, `deleteWorker` from `store.ts`; `Card`, `PageHeader`, `Btn`, `Chip` from `components/ui.tsx`
- Produces: a working worker list; the route `GET /api/workers` (list) and `POST /api/workers` (upsert), both calling `requireSession()` first.

- [ ] **Step 1: Write the seed script**

Create `scripts/import-workers.mjs`, which reads `MillionPayroll_KeyIn_June2026.xlsx` (columns `CODE`, `NAME`, `GROUP` — where `GROUP` holds values like `KB B1`, split into site and group) and `CHECKTIME _WORKER NAME LIST _FORMAT.xls` (for `scannerId`, matched on name), then `POST`s each worker to `/api/workers`. Nationality is derived from the code prefix: `B` → Bangladesh, `M` → Myanmar, `N` → Nepal.

Note: the worker-list file is named `.xls` but is really an `.xlsx`. SheetJS detects this from the content, so no special handling is needed.

- [ ] **Step 2: Write the API route**

`GET` returns `listWorkers()`. `POST` validates the body has a non-empty `code`, `name`, a `site` of `KB`/`KL` and a `group` of `B1`–`B4`, then calls `upsertWorker`. Both call `requireSession()` and return 401 when it is false.

- [ ] **Step 3: Write the screen**

A table of all workers: code, name, site, group, scanner ID, nationality, status. A search box filtering on code and name. An "Add worker" button and an edit row. Status shown as a `Chip` — `teal` for active, `gray` for left, `amber` for balik cuti.

- [ ] **Step 4: Seed and check**

Run: `npm run dev`, then in another terminal `node scripts/import-workers.mjs`
Expected: 85 workers listed at `http://localhost:3000/workers`, with codes B08…N35 and the correct site and group against each.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: workers screen with 85-worker seed from the June key-in sheet"
```

---

### Task 11: Upload, review and export

The payday loop end to end. Split from Task 10 because a reviewer could accept the worker list and still reject the upload flow.

**Files:**
- Create: `TungLamHR/app/src/app/(app)/month/page.tsx`
- Create: `TungLamHR/app/src/app/api/month/upload/route.ts`
- Create: `TungLamHR/app/src/app/api/month/correct/route.ts`
- Create: `TungLamHR/app/src/app/api/month/export/route.ts`
- Create: `TungLamHR/app/src/lib/month-service.ts`
- Test: `TungLamHR/app/src/lib/month-service.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 2–8
- Produces:
  - `interface MonthView { totals: MonthTotals[]; flags: Flag[]; workers: Worker[] }`
  - `holidaySet(monthKey: string): Set<string>` — `holidaysFor` returns `{ day, name }` records, but every calculation function keys on ISO dates. Convert once, here, and nowhere else.
  - `buildMonthView(monthKey: string, workers: Worker[], scans: Map<string, DayInput[]>, extras: Map<string, PayExtras>): MonthView`

- [ ] **Step 1: Write the failing test**

Create `src/lib/month-service.test.ts`, covering: a scanner ID matched to its worker by `scannerId`; a scanner ID matching nobody producing exactly one `UNKNOWN_WORKER` flag; an active worker with no scans producing a `NEVER_SCANNED` flag; and totals produced for every active worker even when they have no scans at all (so the public holiday is still credited).

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/month-service.test.ts`
Expected: FAIL — `Failed to resolve import "./month-service"`

- [ ] **Step 3: Write `src/lib/month-service.ts`**

`buildMonthView` resolves the holiday set with `holidaysFor(monthKey)`, computes `workingDaysInMonth` once, then for each active worker: looks up their `DayInput[]` by code, reshapes it into the `Map<string, DayInput>` keyed by date that `buildMonthDays` and `flagsForWorker` both expect, and calls `buildMonthDays`, `calcMonth` and `flagsForWorker`, collecting the results.

```ts
// The store hands back a sorted array per worker; both buildMonthDays and
// flagsForWorker key on the date, so reshape once and pass the same map to both.
const byDate = new Map((scans.get(worker.code) ?? []).map((d) => [d.date, d]));
``` It appends `flagsForUnmatched` for scanner IDs with no worker and `flagsForNeverScanned` for active workers with no scans. Totals are sorted by code so the Million file always comes out in the same order.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/month-service.test.ts`
Expected: PASS

- [ ] **Step 5: Write the three API routes**

`POST /api/month/upload` takes `monthKey` plus one or two files, runs `readCheckTime` and `readAllowances`, matches each `ScanRow.scannerId` to a worker, saves through `saveMonthScans` and `saveExtras`, and returns the `MonthView`.

`POST /api/month/correct` takes `monthKey`, `code`, `date` and the patch, calls `saveCorrection`, and returns the recomputed `MonthView` so the flag count on screen updates immediately.

`GET /api/month/export?month=2026-06` rebuilds the view and refuses while anything is outstanding. This gate is the whole reason the system is trustworthy, so it is written out in full:

```ts
export async function GET(request: Request): Promise<Response> {
  if (!(await requireSession())) return new Response("Please sign in.", { status: 401 });

  const monthKey = new URL(request.url).searchParams.get("month") ?? "";
  if (!/^\d{4}-\d{2}$/.test(monthKey)) {
    return new Response("Choose a month first.", { status: 400 });
  }

  const [workers, scans, extras] = await Promise.all([
    listWorkers(), loadMonth(monthKey), loadExtras(monthKey),
  ]);
  const view = buildMonthView(monthKey, workers, scans, extras);

  // Nothing incomplete may reach Million. The office clears the list first.
  if (view.flags.length > 0) {
    return new Response(
      `There ${view.flags.length === 1 ? "is 1 day" : `are ${view.flags.length} days`} still to check. ` +
        `Fix those on the Check & fix list, then download again.`,
      { status: 409 },
    );
  }

  const file = writeMillionXls(view.totals, extras);
  return new Response(new Uint8Array(file), {
    headers: {
      "Content-Type": "application/vnd.ms-excel",
      "Content-Disposition": `attachment; filename="MILLION_IMPORT_${monthKey}.xls"`,
    },
  });
}
```

The upload and correct routes call `requireSession()` the same way and return 401 when it is false.

- [ ] **Step 6: Write the screen**

One page at `/month` with three parts:

1. **Upload** — month picker, two file inputs (scanner file required, allowance file optional), and an upload button.
2. **Check & fix** — the flag list. Each row shows the worker, the date, what was scanned, the plain-English message, and the pre-filled suggestion in two time boxes with Accept and Mark absent buttons. A running count sits at the top: *"7 days still to check."*
3. **Month summary** — a table of every worker with basic days, OT, rest day, PH, PH OT, allowance and advance. Numbers use `tabular-nums`. Clicking a worker expands their day-by-day working. The Download button is disabled while any flag remains, with the reason shown beside it.

- [ ] **Step 7: Run the payday loop against the real file**

Run: `npm run dev`, open `/month`, pick August 2026, upload `CHECKTIME_InOutReportAll.xlsx`.
Expected: the file is accepted, the flag list is populated (the trial data will produce many single-punch flags), the summary table fills, and Download stays disabled until the list is cleared.

- [ ] **Step 8: Run the whole suite**

Run: `npm test`
Expected: PASS — every test in the project.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: month upload, flag review and Million export"
```

---

### Task 12: Show the old figure beside the new one

Agreed with the owner: for the first months, the summary must show what the old spreadsheet would have said next to the correct figure, so the tea-break difference is visible and can be explained to workers.

**Files:**
- Modify: `TungLamHR/app/src/lib/month-calc.ts`
- Modify: `TungLamHR/app/src/lib/types.ts`
- Modify: `TungLamHR/app/src/app/(app)/month/page.tsx`
- Test: `TungLamHR/app/src/lib/month-calc.test.ts`

**Interfaces:**
- Consumes: `DayResult`, `MonthTotals`
- Produces: `MonthTotals` gains `otHoursOldSheet: number` and `r2DifferenceHours: number`

- [ ] **Step 1: Write the failing test**

Append to `src/lib/month-calc.test.ts`:

```ts
describe("comparison against the old spreadsheet", () => {
  it("reports what the old sheet's 9-minutes-every-day rule would have given", () => {
    const byDate = new Map<string, DayInput>();
    for (let d = 2; d <= 30; d++) {
      const iso = `2026-06-${String(d).padStart(2, "0")}`;
      if ([6, 13, 20, 27].includes(d)) continue;
      byDate.set(iso, { date: iso, punches: ["07:00", "19:00"] });
    }
    const days = buildMonthDays(2026, 6, byDate, JUNE_HOLIDAYS);
    const t = calcMonth("B32", days, 25);

    // Ours: 25 days x (210 - 15) = 4875 min = 81.25 h
    expect(t.otHours).toBe(81.25);
    // Old sheet: 25 days x 210 min, less 25 x 0.15 h = 87.5 - 3.75 = 83.75 h
    expect(t.otHoursOldSheet).toBe(83.75);
    expect(t.r2DifferenceHours).toBe(2.5);
  });

  it("reports no difference when nobody passed 2 hours of overtime", () => {
    const byDate = new Map<string, DayInput>([
      ["2026-06-02", { date: "2026-06-02", punches: ["07:00", "17:00"] }], // 600 - 450 - 60 = 90 min OT
    ]);
    const days = buildMonthDays(2026, 6, byDate, JUNE_HOLIDAYS);
    const t = calcMonth("B32", days, 25);
    expect(t.otHours).toBe(1.5);
    expect(t.otHoursOldSheet).toBe(1.35); // 90 min less 0.15 h
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/month-calc.test.ts`
Expected: FAIL — `otHoursOldSheet` is undefined.

- [ ] **Step 3: Extend `calcMonth`**

Add the two fields to `MonthTotals` in `types.ts`, then inside `calcMonth` accumulate the pre-deduction overtime and compute:

```ts
// What the old spreadsheet would have printed: the tea break as 0.15 of an
// hour (nine minutes) taken from every basic day, rather than fifteen minutes
// taken only from days that passed two hours of overtime. See spec 4.4.
const OLD_SHEET_R2_HOURS_PER_DAY = 0.15;
const otMinBeforeR2 = otMin + r2Min;
const otHoursOldSheet =
  Math.round((otMinBeforeR2 / 60 - basicDays * OLD_SHEET_R2_HOURS_PER_DAY) * 100) / 100;
```

with `r2DifferenceHours = Math.round((otHoursOldSheet - otHours) * 100) / 100`.

- [ ] **Step 4: Fix the two `MonthTotals` literals this breaks**

Adding required fields to `MonthTotals` breaks every hand-written literal of that type. There are two, both in tests:

- `src/lib/million-writer.test.ts` — the `const totals: MonthTotals = { ... }` near the top
- `src/lib/month-service.test.ts` — any literal built there in Task 11

Add `otHoursOldSheet: 0, r2DifferenceHours: 0` to each. The writer ignores both fields, so no assertion changes.

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/lib/month-calc.test.ts`
Expected: PASS

- [ ] **Step 6: Show it on the summary**

Add an "Old sheet" column to the month summary table, greyed, with a one-line note above the table: *"The Old sheet column is what the previous spreadsheet would have paid. The difference is the tea break correction."* Show the month's total difference in ringgit beside it, at RM13.08 an hour.

- [ ] **Step 7: Run the whole suite**

Run: `npm test`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: show the old spreadsheet's overtime beside the corrected figure"
```

---

## Definition of done for Stage 1

- [ ] `npm test` passes, including the golden master over 80 real workers.
- [ ] `CHECKTIME_InOutReportAll.xlsx` uploads and produces a flag list and a summary.
- [ ] Export is refused, in plain English, while any flag is outstanding.
- [ ] The downloaded file opens in Excel as `.xls` with all 37 Million headers intact.
- [ ] All 85 workers are in the system with the correct code, site and group.
- [ ] The old spreadsheet's overtime figure is shown beside the corrected one.
