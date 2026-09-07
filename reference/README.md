# Reference

Not read by the running system. This is the paper trail the payroll rules were
built from — kept so any figure can be traced back to what the office actually
did.

| File | Why it is here |
|---|---|
| `Payroll_June_Sample.xlsx` | The owner's own June sheet. Every rule in `app/src/lib/day-calc.ts` came from it, and all 85 workers are tested against it. |
| `MillionPayroll_KeyIn_June2026.xlsx` | What was keyed into Million for June — the worker codes and names. |
| `Payroll_June_Dashboard.html` | The first look at June's figures. |
| `TUNG LAM PUBLIC HOLIDAY 2026.pdf` | The company's own 2026 holiday list. All 11 days were checked against it, date and weekday. |
| `punchcard1-6.jpeg` | Photographs of the paper punch cards the office filled in by hand. |
| `SYSTEM_PLAN.md` | The plan agreed on 2026-08-01, before any of this was built. |

Two files here are read by the tests and the worker importer:
`Payroll_June_Sample.xlsx` and `MillionPayroll_KeyIn_June2026.xlsx`.
