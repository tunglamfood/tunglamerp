# Exports from Million

The spreadsheets exported out of the Million accounting software. These are the
inputs the system reads — replace a file here with a fresher export and the
importers pick it up.

| File | What it holds |
|---|---|
| `CHECKTIME_InOutReportAll.xlsx` | The In Out Report from the CheckTime scanner |
| `CHECKTIME _WORKER NAME LIST _FORMAT.xls` | Who is enrolled on the scanner, and their scanner number |
| `IT_CUSTOMER LIST.xlsx` | The debtor masterfile — every customer |
| `IT_ITEM DESCRIPTION LIST.xlsx` | Every product SKU |
| `IT_PRODUCT_COST_PENANG_CLEANED.xlsx` | What each Penang dealer pays for each product |
| `MILLION_IMPORT_JULY_2026_ TEMPLATE.xls` | The payroll import layout Million expects back |

Read by `app/scripts/import-sales.mjs`, `app/scripts/import-workers.mjs` and the
tests in `app/src/lib/`.
