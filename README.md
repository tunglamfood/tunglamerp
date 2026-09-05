# TungLam HR System

Turns the CheckTime scanner export into a Million payroll import file.

## Before it will run

The system needs somewhere to store its data. The Supabase project the old app
used no longer exists, so a new one is needed:

1. Go to supabase.com, sign in, and create a new free project.
2. Open **Project Settings → API** and copy the **Project URL** and the
   **service_role / secret** key.
3. Put them in `app/.env.local`:

   ```
   SUPABASE_URL=https://your-new-project.supabase.co
   SUPABASE_SECRET_KEY=your-secret-key
   ```

4. Open the **SQL Editor** in Supabase, paste in everything from
   `app/supabase/schema.sql`, and run it. That creates the four tables.

## Running it

```bash
cd app
npm install     # first time only
npm run dev     # then open http://localhost:3000
```

Sign in with the password in `app/.env.local`.

To load the 85 workers, with the app running:

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
