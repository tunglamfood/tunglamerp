// Takes the CheckTime export (and optionally the allowance sheet), matches each
// scan to a worker, and stores the month.
import { requireSession } from "@/lib/supabase-server";
import { listWorkers, saveExtras, saveMonthScans } from "@/lib/store";
import { readCheckTime } from "@/lib/checktime-reader";
import { readAllowances } from "@/lib/allowance-reader";
import { buildMonthView } from "@/lib/month-service";
import { listLeave } from "@/lib/store-hr";
import { paidLeaveDaysInMonth } from "@/lib/month-inputs";
import { loadMonth } from "@/lib/store";
import { isMonthKey, monthExtras, workingStatuses } from "@/lib/month-loader";
import { ScanDbRow } from "@/lib/store-mapping";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  if (!(await requireSession())) {
    return Response.json({ error: "Please sign in again." }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "Could not read the upload." }, { status: 400 });
  }

  const monthKey = String(form.get("month") ?? "");
  if (!isMonthKey(monthKey)) {
    return Response.json({ error: "Choose a month first." }, { status: 400 });
  }

  const scanFile = form.get("scans");
  if (!(scanFile instanceof File) || scanFile.size === 0) {
    return Response.json({ error: "Choose the CheckTime file to upload." }, { status: 400 });
  }

  try {
    const [workers, working] = await Promise.all([listWorkers(), workingStatuses()]);
    // The scanner may report "0018" where the list holds "18".
    const byScannerId = new Map(
      workers.filter((w) => w.scannerId).map((w) => [String(Number(w.scannerId)), w]),
    );

    const rows = readCheckTime(Buffer.from(await scanFile.arrayBuffer()));
    const forMonth = rows.filter((r) => r.date.startsWith(monthKey));

    const scanRows: ScanDbRow[] = [];
    const unmatched = new Map<string, string>();
    for (const row of forMonth) {
      const worker = byScannerId.get(row.scannerId);
      if (!worker) {
        unmatched.set(row.scannerId, row.name);
        continue;
      }
      scanRows.push({ code: worker.code, work_date: row.date, punches: row.punches });
    }

    await saveMonthScans(monthKey, scanRows);

    const allowanceFile = form.get("allowances");
    if (allowanceFile instanceof File && allowanceFile.size > 0) {
      await saveExtras(monthKey, readAllowances(Buffer.from(await allowanceFile.arrayBuffer())));
    }

    const [scans, extras, leave] = await Promise.all([
      loadMonth(monthKey),
      monthExtras(monthKey),
      listLeave(),
    ]);
    const view = buildMonthView(
      monthKey,
      workers,
      scans,
      [...unmatched].map(([scannerId, name]) => ({ scannerId, name })),
      working,
      paidLeaveDaysInMonth(leave, monthKey),
    );

    return Response.json({
      ...view,
      extras: Object.fromEntries(extras),
      read: {
        rowsInFile: rows.length,
        rowsForMonth: forMonth.length,
        matched: scanRows.length,
        unmatched: unmatched.size,
      },
    });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}
