# TungLam HR System — Design (Stage 1: OT Calculation & Million Export)

Date: 2026-09-05
Status: Approved by owner, ready for implementation plan

---

## 1. Goal

Replace the manual Excel payroll workflow. The office drops the CheckTime scanner
export into the system; the system calculates each worker's basic days, overtime,
rest-day hours, public-holiday days and public-holiday overtime, then produces the
import file for Million accounting software, which generates the payslips.

The full HR system (all four stages) is the destination. **Stage 1 is this spec.**

## 2. Stages

| Stage | Contents |
|---|---|
| **1 (this spec)** | Workers · Attendance & OT calculation · Million export |
| 2 | Advances & allowances · Leave · Levy and other deductions |
| 3 | Documents & permits with expiry warnings · Hostel & transport |
| 4 | Warnings & discipline · Resignation and final pay · History & reports |

Each later stage builds on Stage 1 without restructuring it.

## 3. Source data (analysed 2026-09-05)

| File | Contents | Size |
|---|---|---|
| `CHECKTIME_InOutReportAll.xlsx` | Scanner punches: EMP ID, Name, Department, Date, Check In/Out 1-10, Total Hours, Location | 2,100 rows, 56 workers, Oct 2025-Aug 2026 |
| `CHECKTIME _WORKER NAME LIST _FORMAT.xls` | Scanner enrolment list (actually xlsx despite the extension) | 75 workers |
| `MILLION_IMPORT_JULY_2026_ TEMPLATE.xls` | Million import layout, 37 columns (true BIFF .xls) | 83 workers |
| `Payroll_June_Sample.xlsx` | The existing manual calculation. 8 tabs = 2 sites x 4 groups, 3 workers per block | 85 workers |
| `MillionPayroll_KeyIn_June2026.xlsx` | June bridge sheet — carries the Million code for every worker | 85 workers |
| `TUNG LAM PUBLIC HOLIDAY 2026.pdf` | Gazetted holidays for 2026 | — |

### Known data problems

1. **The scanner's `Total Hours` column is wrong.** It pairs punch 1 with punch 2
   and discards the rest. Example: 14/09/2025, worker 0081, punches 07:23 / 12:24
   / 20:24, reported as 05:01. **Never read this column.**
2. **Roughly half the scan rows have a single punch** (1,001 of 2,100). The scanner
   was only being trialled during this period.
3. **Headcount does not reconcile**: 75 enrolled, 56 ever scanned, 83 in Million,
   85 on the payroll sheet.
4. **Employee codes do not match today.** Scanner uses `0018`, `2028`; Million uses
   `B08`, `M04`, `N04`. The owner is re-configuring the scanner so its IDs match
   the Million codes. The system therefore keys on the Million code and stores the
   scanner ID alongside it, so a mismatch can still be reconciled.

Code prefixes encode nationality: **B** = Bangladesh, **M** = Myanmar, **N** = Nepal.

## 4. The existing Excel, decoded

Verified by recomputing worker UDDIN GEAS (KB B3) from raw cells and matching the
sheet exactly: 25 basic days, 143.65 OT hours, 12.1833 rest-day hours.

### 4.1 The hours-dot-minutes convention

Times are written `H.MM`, not as decimals: `10.10` is 10:10, `25.59` is 01:59 next
day, `7.30` is seven and a half hours, `1.40` is one hour forty minutes. Values are
**pre-borrowed** so plain subtraction never needs to carry — `26.60` is written in
place of `27.00`.

**This convention is abandoned.** The new system stores real times and does real
minute arithmetic throughout.

### 4.2 Daily formula in the sheet

```
HRS WRK = (OUT - IN)               G = SUM(D-C)+(F-E)
OT      = HRS WRK - BASIC - LUNCH  J = SUM((G-H)-I)
IN HRS  = whole hours of OT        K
IN MIN  = (OT - IN HRS) * 100      L = SUM(J-K)*100
```

### 4.3 Monthly formula in the sheet

```
BASIC  = COUNT of days with 7.30 filled, excluding Saturdays and the PH row
OT     = (sum IN HRS + sum IN MIN/60) - (BASIC * 0.15)
SAT    = sum of Saturday IN HRS + IN MIN/60
PH     = COUNT of the PH row
PH OT  = the PH row's IN HRS + IN MIN/60
```

The public holiday row is hard-coded to row 9 (1 June). If a holiday falls on any
other date the formulas silently produce the wrong answer.

### 4.4 Defect found in the existing sheet — the R2 tea break

The owner's rule: **on a normal day where OT exceeds 2 hours, deduct 15 minutes
from that day's OT** for the second rest break.

The sheet instead computes `BASIC_DAYS * 0.15` and subtracts it from a true decimal
hours figure. Because `0.15` of an hour is **9 minutes**, not 15, and because it
multiplies by *every* basic day rather than only qualifying days, the sheet
under-deducts.

Measured across June 2026 (81 workers with data, 2,000 basic days, of which only 37
had 2 hours OT or less):

| | Hours |
|---|---|
| Deducted by the sheet | ~190 |
| Should have been deducted | ~381 |
| Shortfall | **~191 hrs, about RM2,495/month, about RM30,000/year** |

Four blocks (B35, N12, N16, N25) use `0.25`, which is the correct figure for 15
minutes. Those four had been fixed; the fix never propagated to the rest.

**Decision: the new system implements the owner's real rule.** For the first month
the summary screen shows the old-sheet figure alongside the correct one so the
difference is visible and explainable to workers.

### 4.5 Second defect — a public holiday day missed

Of the 81 workers with June data, 79 were credited the 1 June public holiday.
**TUN NAING OO (M13) worked 24 basic days that month and was credited none.**
Nothing in his record explains the omission; it appears to be a keying slip worth
about RM65.38 to him. (The other worker without a PH day, DIPESH / N25, sits in a
block with no clock times at all and produces junk throughout.)

The new system credits the public holiday to every active worker automatically, so
this cannot happen again. See rule 5.5.

### 4.6 Pay rates (reference only — Million computes pay)

Basic RM65.38/day · OT RM13.08/hr · Rest day and PH OT RM17.43/hr · PH day
RM65.38 · allowance added · advance deducted.

RM65.38 / 7.5 hrs = RM8.72/hr. x1.5 = RM13.08. x2 = RM17.43. These confirm the
Million column mapping in section 6.

## 5. Calculation rules (authoritative)

All arithmetic in whole minutes. Display converts to decimal hours at the end.

### 5.1 Establishing the day's hours

```
hours_worked = last scan of that date - first scan of that date
```

Intermediate punches are ignored. If the last scan is earlier than the first, add
24 hours (the shift crossed midnight).

### 5.2 Day types

| Type | Determined by |
|---|---|
| Public holiday | Date appears in the stored holiday calendar |
| Rest day | Saturday |
| Normal | Everything else, **including Sunday** |

### 5.3 Normal day

```
BASIC_MIN = 450          (7h30)
LUNCH_MIN = 60           (flat 1 hour, always)

basic_day = 1
ot_min    = hours_worked - 450 - 60
if ot_min > 120:  ot_min -= 15      # R2 second tea break
```

`ot_min` may be negative when a worker leaves early. Negative OT carries into the
monthly total. **The worker still keeps the full basic day.**

The R2 test is applied to the day's OT **before** the deduction — a day with 2h10m
OT qualifies and becomes 1h55m.

### 5.4 Saturday (rest day)

```
basic_day    = 0
lunch        = 0
rest_day_min = hours_worked        # every minute counts
```

No R2 deduction.

### 5.5 Public holiday

```
ph_day    = 1
lunch     = 60 if hours_worked >= 300 else 0     # 5-hour threshold
ph_ot_min = hours_worked - lunch
```

No R2 deduction.

**Every active worker is credited the public holiday**, whether they worked it or
not — a public holiday that is not worked still counts as `ph_day = 1` with zero
PH OT. This is automatic and cannot be skipped, which is what went wrong in the
June sheet (section 4.5). A worker whose status is `left` or `balik cuti` for the
whole month is not credited.

### 5.6 Monthly totals

```
working_days   = days in month - Saturdays - public holidays
basic_days     = count of normal days worked
ot_hours       = sum of normal-day ot_min / 60
rest_day_hours = sum of rest_day_min / 60
ph_days        = count of public holidays
ph_ot_hours    = sum of ph_ot_min / 60
non_pay_leave  = working_days - basic_days      (less any recorded paid leave)
```

### 5.7 Flags raised for office review

Nothing incomplete reaches the export. Every flag below blocks export until
resolved or explicitly dismissed:

| Flag | Trigger | Suggested fix offered |
|---|---|---|
| Single punch | Exactly one scan on a date | Standard finish time, pre-filled |
| Impossibly long | `hours_worked` over 16h | Review both times |
| Impossibly short | `hours_worked` under 2h on a normal day | Review both times |
| No scan | Normal day with no scan at all | Mark absent, or key the times |
| Unknown worker | Scanner ID not in the worker list | Add worker, or ignore row |
| Never scanned | Worker in list with no scans all month | Mark left / balik cuti |

## 6. Million export mapping

Only 7 of the 37 columns carry data; the rest are written as `0`. Verified against
`MILLION_IMPORT_JULY_2026_ TEMPLATE.xls`, where
`DAYS WORKED = Working Day - NON-PAY LEAVE` holds for all 79 populated rows.

| Million column | Source |
|---|---|
| `Employee No.` | Worker's Million code |
| `Public Holiday` | `ph_days` |
| `Working Day` | `working_days` |
| `DAYS WORKED` | `basic_days` |
| `OVERTIME 2 (1.5x)` | `ot_hours` |
| `OVERTIME 3 (2x)` | `rest_day_hours + ph_ot_hours` |
| `NON-PAY LEAVE` | `non_pay_leave` |
| `ALLOWANCE` | From the office allowance/advance upload |
| `ADVANCE` | From the office allowance/advance upload |
| all other 28 columns | `0` |

Output is a `.xls` file matching the template's column order and header row exactly,
so Million's importer accepts it without adjustment.

In Stage 1 allowance and advance arrive as a second uploaded spreadsheet (owner's
choice). Stage 2 replaces that upload with records held in the system.

## 7. Screens (Stage 1)

| Screen | Purpose |
|---|---|
| Login | Single office password |
| Workers | The 85 workers: Million code, name, site (KB/KL), group (B1-B4), scanner ID, nationality, status (active / left / balik cuti). Add and edit. |
| New month | Choose month, upload CheckTime file, upload allowance and advance file. Reports what was found. |
| Check & fix | Every flagged day in one list with a pre-filled suggestion. Outstanding count always visible. Export stays locked until the list is clear. |
| Month summary | All workers with basic days, OT, rest day, PH, PH OT, allowance, advance. Click a worker for their day-by-day working. |
| Export | Download the Million import file. |

## 8. Structure

Small, independently testable units:

| Unit | Responsibility | Depends on |
|---|---|---|
| `checktime-reader` | CheckTime spreadsheet to a list of (worker, date, punches). Handles the mislabelled `.xls` that is really `.xlsx`. Never reads `Total Hours`. | nothing |
| `allowance-reader` | Allowance and advance spreadsheet to per-worker amounts | nothing |
| `day-calc` | One day's punches plus day type to basic day, OT, rest-day and PH figures | nothing |
| `month-calc` | A month of days to monthly totals per worker | `day-calc` |
| `flags` | A month of days to the review list | `day-calc` |
| `million-writer` | Monthly totals to the Million `.xls` file | nothing |
| `holidays` | The 2026 calendar; day-type lookup | nothing |
| `store` | Workers, holidays, months, corrections — Supabase | nothing |

`day-calc`, `month-calc` and `million-writer` are pure calculation with no storage
or file access, so they can be tested directly against known answers.

## 9. Proving it is correct

1. **Golden-master test.** The June sample has 85 workers with known results. Feed
   those exact clock times into `day-calc` / `month-calc` and assert basic days,
   rest-day hours, PH days and PH OT match for every worker. OT is asserted against
   the sheet's figure **plus** the R2 correction, since the sheet's OT is known to
   be wrong.
2. **Reader test.** Run the real `CHECKTIME_InOutReportAll.xlsx` through
   `checktime-reader` and confirm 2,100 rows and 56 workers, with the known
   single-punch rows flagged.
3. **Writer test.** Generate a Million file and compare its header row and column
   order against the July template.
4. **Rule tests.** One test per rule in section 5, including the awkward cases:
   negative OT, midnight crossing, exactly 2h00 OT (no deduction), 2h01
   (deduction), a 4h59m public holiday (no lunch) and 5h00 (lunch).

## 10. Decisions on record

| Question | Decision |
|---|---|
| Which module first | HR OT calculation |
| Missing punch | Show it; office corrects on screen with a pre-filled suggestion |
| Allowance, advance, leave in Stage 1 | Second uploaded spreadsheet |
| Million `Overtime 3 (2x)` | Rest day **and** public holiday hours combined |
| Working Day | Days in month minus Saturdays minus public holidays |
| R2 tea break | 15 min, normal days only, only when that day's OT exceeds 2 hours |
| R2 on Saturday / public holiday | Never |
| Lunch | Flat 1 hour on normal days; on public holidays only when 5 hours or more worked; never on Saturday |
| Old app | Left untouched as a backup; proven rules and login lifted across |
| System scope | Full HR system, built in four stages |

## 11. Open items (do not block Stage 1)

- Owner is re-configuring the scanner so its employee IDs match the Million codes.
  Until that is done, the worker record holds both.
- Holiday dates for 2026 to be read from the supplied PDF and confirmed on screen
  before the first live run.
- The standard finish time used for the pre-filled single-punch suggestion to be
  confirmed by the office.
