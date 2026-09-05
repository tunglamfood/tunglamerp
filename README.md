# TungLam ERP

One system for Tung Lam Food Industries, built one module at a time.

| Module | What it does |
|---|---|
| **Dashboard** | Opens with what needs you today — expiring permits, prices below cost, a month waiting to be checked. |
| **HR** | Monthly pay from the scanner file, workers, allowances & advances, leave, permits, hostel & transport, warnings. |
| **Sales** | Customers, products, what each dealer pays for each product, and sales orders that price themselves. |
| **Assistant** | An Ask button on every screen. Answers from the system's own data, and can add records. |

## HR: what it does

Turns the CheckTime scanner export into a Million payroll import file, and refuses to hand it over until every day adds up.

## The assistant

The **Ask** button in the corner of every screen. It reads the system's own data
to answer questions — "how many workers have no scanner number", "which permits
run out soon", "is anything sold below cost to 433" — and can add records for
you. It cannot delete anything, cannot change many records at once, and cannot
run the payroll export. Anything it saves is listed under its answer.

It needs a key from console.anthropic.com. Paste it after
`ANTHROPIC_API_KEY=` in `app/.env.local` and restart. Everything else works
without it.

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

Open **Monthly pay** and work down the four steps:

1. **Pick the month.** Anything already uploaded for it opens by itself.
2. **Add the scanner file.** In CheckTime, run the In Out Report for the month
   and save it. Drag it in, or press Choose file.
3. **Check the days it could not read.** Each one has a suggested time already
   filled in — accept it, correct it, or mark the day absent.
4. **Download.** Unlocks once step 3 is empty. Bring the file into Million.

**Workers** holds everyone on the payroll. Search by name, code or scanner
number; filter by site, group, status, nationality or whether they are enrolled
on the scanner. Click any row to edit them in the side panel.

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
