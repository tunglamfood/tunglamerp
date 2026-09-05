# TungLam HR System

Turns the CheckTime scanner export into a Million payroll import file.

## The database

Already set up and running — Supabase project `tunglamfood's Project`, tables
`hr_workers`, `hr_month_scans`, `hr_month_corrections`, `hr_month_extras`. The
`hr_` prefix keeps them clear of the previous app's tables, which are still
there and still empty.

**If it ever stops working:** free Supabase projects go to sleep after a stretch
of no use, and the web address stops answering. Sign in at supabase.com, open the
project, and press Restore. It takes about ten minutes to wake up.

## Running it

```bash
cd app
npm install     # first time only
npm run dev     # then open http://localhost:3000
```

Sign in with the password in `app/.env.local`.

All 85 workers are already loaded. To reload them from the June key-in sheet:

```bash
node scripts/import-workers.mjs
```

## Using it each month

1. **Month** → pick the month → choose the CheckTime file → *Read the file*.
2. **Check & fix** → every problem day is listed with a suggested time. Accept
   or correct each one, or mark the day absent.
3. **Download Million file** → unlocks once the list is clear.

## Checking it still works

```bash
cd app
npm test        # 358 tests, including all 85 workers of June 2026
```

## Where things are

| | |
|---|---|
| The payroll rules | `app/src/lib/day-calc.ts` — every rule lives here and nowhere else |
| Monthly totals | `app/src/lib/month-calc.ts` |
| The review list | `app/src/lib/flags.ts` |
| Reading the scanner file | `app/src/lib/checktime-reader.ts` |
| Writing the Million file | `app/src/lib/million-writer.ts` |
| Public holidays | `app/src/lib/holidays.ts` |
| The design and the reasoning | `docs/superpowers/specs/` |

The old app is untouched at `../TungLamHRSystem/hr-app` as a backup.
