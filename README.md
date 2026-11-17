# TungLam ERP

One system for Tung Lam Food Industries, built one module at a time.

| Module | What it does |
|---|---|
| **Dashboard** | Opens with what needs you today — expiring permits, prices below cost, a month waiting to be checked. |
| **HR** | Monthly pay from the scanner file, workers, allowances & advances, leave, permits, hostel & transport, warnings. |
| **Sales** | Customers, products, what each dealer pays for each product, and sales orders that price themselves. |
| **Dealer portal** | Who may order online at tunglamfood.my/portal, how the item codes are shown there as products with variants, and which dealers each sales rep orders for. Portal orders arrive in Sales orders as "New from portal". |
| **Assistant** | An Ask button on every screen. Answers from the system's own data, and can add records. |

## HR: what it does

Turns the CheckTime scanner export into a Million payroll import file, and refuses to hand it over until every day adds up.

## The assistant

The **Ask** button in the corner of every screen. It reads the system's own data
to answer questions — "how many workers have no scanner number", "which permits
run out soon", "is anything sold below cost to 433" — and can add records for
you. It cannot delete anything, cannot change many records at once, and cannot
run the payroll export. Anything it saves is listed under its answer.

It uses the `OPENAI_API_KEY` already in `.env.local`. Two models to pick
from in the panel: **5.4 mini** by default, which is quicker and cheaper and
enough for most questions, and **5.2** for something that needs more thought.
No temperature or other sampling setting is applied — the model's own defaults
are left alone.

## The dealer portal

Dealers and sales reps order at **tunglamfood.my/portal** (the website repo, `tunglamfood/tunglamwebsite`). Their orders land in this system's own `sales_orders` table, with status `submitted` and source `portal` or `rep`.

The website reaches this database on its server only, with its own secret key named `tunglamfood_portal`. Delete that key in Supabase to cut the website off. It calls these database functions:

- `sales_price_for`: the dealer's price, then their group's price, then the list price
- `portal_catalog`
- `portal_place_order`, which prices the order on the server
- `portal_cancel_order`
- `sales_next_order_no`, which this system also uses so the two never take the same number

The changes are in `supabase/migrations/20261116_dealer_portal.sql` and `20261117_portal_phase2_3.sql` (credit terms, on hold, AutoCount export marks, announcements, usual items, SMS codes). The first catalogue and the demo logins are in `supabase/seed/`.

### Credit, announcements and AutoCount

- **Customers → payment terms, credit limit, currency, on hold.**
  - Terms are shown to the dealer at checkout.
  - The credit limit is for the office only.
  - A dealer on hold can still order on the portal, but the order arrives as **On hold (credit)** to confirm or cancel.
- **Sales → Dealer portal → Announcements.** Notices for the portal's home page, in EN/BM/中文, with optional dates.
- **Sales orders → Export for AutoCount.** An Excel file of confirmed and delivered orders in a date range, one row per line.
  - Exported orders are marked so they are never exported twice.
  - The column names are in `src/lib/autocount.ts`; match them to the AutoCount import template before the first real import.

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
npm install     # first time only
npm run dev     # then open http://localhost:3000
```

Everyone signs in with their own username and password. Logins, and what each person can open
(HR & payroll, Sales & dealers, Website content, Staff logins), are managed under Admin → Staff logins.
A new login or a reset gives a one-time password that must be changed at first sign-in.
The same logins sign in to tunglamfood.my/admin (those with "Website content").
How it works: `src/lib/areas.ts` (which path belongs to which area), `src/proxy.ts` and `guard(area)` in every
data route, `currentUser()` in `src/lib/supabase-server.ts` (re-reads `erp_users` on every request),
migration `supabase/migrations/20261118_staff_logins_leads.sql`. `.env.local` needs `SESSION_SECRET`;
`APP_PASSWORD` is no longer used.

All 85 workers are already loaded. To reload them from the June key-in sheet:

```bash
node scripts/import-workers.mjs
```

## Using it each month

Open **Monthly pay** and work down the four steps:

1. **Pick the month.** Anything already uploaded for it opens by itself.
2. **Add the scanner file.** In CheckTime, run the In Out Report for the month
   and save it. Drag it in, or press Choose file.
3. **Check the days it could not read.** Someone who scanned once keeps the
   end they did scan; the other end is left blank and shaded, because batches
   finish at different times and a guess would be wrong for most of them. Type
   the missing time in, or mark the day absent. Save stays greyed out until
   both ends are there.
4. **Download.** Unlocks once step 3 is empty. Bring the file into Million.

**Workers** holds everyone on the payroll. Search by name, code or scanner
number; filter by site, group, status, nationality or whether they are enrolled
on the scanner. Click any row to edit them in the side panel.

## Checking it still works

```bash
npm test        # 425 tests, including all 85 workers of June 2026
```

## Where things are

| | |
|---|---|
| The payroll rules | `src/lib/day-calc.ts` — every rule lives here and nowhere else |
| Monthly totals | `src/lib/month-calc.ts` |
| The review list | `src/lib/flags.ts` |
| Reading the scanner file | `src/lib/checktime-reader.ts` |
| Writing the Million file | `src/lib/million-writer.ts` |
| Public holidays | `src/lib/holidays.ts` |
| The design and the reasoning | `docs/superpowers/specs/` |
| The spreadsheets out of Million | `data/` |
| What the rules were built from | `reference/` |

The website is the project root, so it deploys with no folder setting to get
wrong. `data/` and `reference/` sit beside it and are found by a path relative
to each file, so the whole folder can be moved or copied and still work.

The old card-scanning app is no longer kept as a folder. Its full history is on
the `old-card-scanner-app` branch of this repository:

```bash
git switch old-card-scanner-app     # look at it
git switch main                     # come back
```

## Order SMS to dealers (off by default)

When the office confirms, delivers, cancels or changes a portal order, the dealer's portal
phones (up to three) can get a one-line SMS through OneWay SMS. Every SMS costs money, so it
only runs when **all** of these are set in Vercel for this app:

- `ORDER_SMS=on`
- `ONEWAYSMS_API_USERNAME`, `ONEWAYSMS_API_PASSWORD` (the same OneWay account as the portal's sign-in codes)
- optional `ONEWAYSMS_SENDER_ID`

The texts are in `src/lib/sms.ts`.

## Production planning

Production → Daily plan turns every order for a delivery date into what each line makes the night before:
packs and cartons convert into the product inside them, plus the buffer %, plus any manual extra, minus stock
carried over, at least the minimum run, rounded up to whole batches. Recipes give the raw materials, with
"before production" items (soaking soybeans) first. Notes flag 初一 / 十五, the Chinese New Year season and
public holidays. Lock the plan when soaking starts; later orders show as a difference. After production,
record what was made: the lot number (YYMMDD-LINE-ITEM) and EXP date fill themselves in, and Production →
Trace a lot lists the dealers who received it. Set products up under Production → Recipes & setup.
The maths is in `src/lib/production.ts` (tested); staff need the "Production" area.

## Packing and delivery

Production → Routes: one route per lorry run (driver, lorry), with its dealers in stop order.
Production → Packing & delivery: one delivery day by route and stop, what to pack per dealer in the units they
ordered (a chain's sheet is split into its outlets), a Packed tick per order, the lorry load, printable trip
sheets (one page per route, with a driver signature line), and "Mark route delivered" after the trip, which
moves confirmed orders to Delivered with history for the dealer (and an SMS when ORDER_SMS is on).
The grouping is in `src/lib/packing.ts` (tested).
