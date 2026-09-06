// The same payslip figures as a spreadsheet, for the office to keep or send on.
import * as XLSX from "xlsx";
import { isMonthKey, loadMonthView, monthExtras } from "@/lib/month-loader";
import { listWorkers } from "@/lib/store";
import { guard } from "@/lib/route-helpers";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const stop = await guard();
  if (stop) return stop;

  const url = new URL(request.url);
  const month = url.searchParams.get("month") ?? "";
  const only = url.searchParams.get("code")?.trim().toUpperCase();
  if (!isMonthKey(month)) return new Response("Choose a month first.", { status: 400 });

  const [view, extras, workers] = await Promise.all([
    loadMonthView(month),
    monthExtras(month),
    listWorkers(),
  ]);
  const person = new Map(workers.map((w) => [w.code, w]));

  const rows: (string | number)[][] = [
    [
      "Code", "Name", "Site", "Group", "Working days", "Days worked", "OT hours",
      "Rest day hours", "PH days", "PH OT hours", "No-pay leave", "Allowance", "Advance",
    ],
    ...view.totals
      .filter((t) => !only || t.code === only)
      .map((t) => [
        t.code,
        person.get(t.code)?.name ?? "",
        person.get(t.code)?.site ?? "",
        person.get(t.code)?.group ?? "",
        t.workingDays,
        t.basicDays,
        t.otHours,
        t.restDayHours,
        t.phDays,
        t.phOtHours,
        t.nonPayLeave,
        extras.get(t.code)?.allowance ?? 0,
        extras.get(t.code)?.advance ?? 0,
      ]),
  ];

  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet["!cols"] = [
    { wch: 8 }, { wch: 28 }, { wch: 6 }, { wch: 7 },
    ...Array(9).fill({ wch: 13 }),
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, `Payslips ${month}`);
  const file = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

  return new Response(new Uint8Array(file), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="PAYSLIPS_${month}${only ? `_${only}` : ""}.xlsx"`,
    },
  });
}
