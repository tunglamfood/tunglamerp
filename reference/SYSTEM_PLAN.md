# TungLam HR System — Agreed Plan (2026-08-01)

## Goal
Replace the manual Excel payroll workflow with a custom HR system that follows
the exact calculation rules used in `Payroll_June_Sample.xlsx`.

## Stages
1. **Now — clickable prototype on PC** (Next.js 16, minimalist UI, dummy login,
   data saved in the browser, preloaded with real June 2026 data for 85 workers).
2. **Later — make it real**: Supabase backend storage, real login, go online.
3. **Future — OCR**: scan punch cards, auto-fill clock in/out times.

## Screens (Stage 1)
- Login (dummy — any password works)
- Dashboard (month at a glance)
- Workers (list / add / edit, KB & KL, groups B1–B4)
- Punch Card (the heart — monthly card per worker, auto calculation)
- Advances & Allowances (per worker per month record book)
- Leave records (annual / medical / absence …)
- Month-End Key-In (one-page table for Million Payroll: name, sum details,
  allowance, advance; printable)
- Month setup: pick month → dates auto-filled, Saturdays = OFF, tick public holidays

## Calculation rules (from the Excel, confirmed by owner)
- Times keyed as real clock times; system does proper hours:minutes math
  (no more manual −1hr +60min fixing, no more 1.40 lunch trick).
- Basic day = 7h30m (45h/6-day week law). Lunch = 1h auto on normal days.
- Clock-in convention: owner keys an average-in (e.g. 11.10) once; per-day override allowed.
- OT = worked − 7h30 − lunch. Early back ⇒ negative OT, contra against monthly OT
  (worker still gets the basic day).
- Saturday = Rest Day (RD): hours kept separate. <5h no lunch, ≥5h deduct 1h.
- Public holiday work: kept separate (PH day + PH OT hours). Same 5h lunch rule.
- R2 tea break: deduct 9 min (0.15h) × basic days from monthly OT.
- Monthly SUM DETAILS per worker: BASIC days, OT hrs, RD/SAT hrs, PH days, PH OT hrs.
- **No RM salary calculation** — Million Payroll handles EPF/SOCSO/PCB.
  (Rates for reference only: 65.38/day, OT 13.08, RD & PH-OT 17.43, +RM200 allw, −advance.)

## Tech (owner's choice)
- Next.js 16, TypeScript, Tailwind. Minimalist clean theme.
- Supabase later as backend (data layer written so it can swap in).
- Prototype stores data in browser localStorage.
