// Printable payslips for a month.
//
// Not a PDF library — the browser already makes very good PDFs, and asking it
// to means the office can look at the page first, change the month, and print
// only what they want. Ctrl+P, then Save as PDF.
import Link from "next/link";
import { isMonthKey, loadMonthView, monthExtras } from "@/lib/month-loader";
import { listWorkers } from "@/lib/store";
import { monthLabel } from "@/lib/time";
import { Notice } from "@/components/ui";
import { PrintButton } from "@/components/print-button";

export const dynamic = "force-dynamic";

/** Rates the payslip prints for reference. Million works out the real pay. */
const RATE = { basic: 65.38, ot: 13.08, restDay: 17.43, phOt: 17.43 };

const money = (n: number) =>
  n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default async function PayslipsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; code?: string }>;
}) {
  const params = await searchParams;
  const now = new Date();
  const month =
    params.month && isMonthKey(params.month)
      ? params.month
      : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const only = params.code?.trim().toUpperCase();

  let problem: string | null = null;
  let rows: {
    code: string;
    name: string;
    site: string;
    group: string;
    workingDays: number;
    basicDays: number;
    otHours: number;
    restDayHours: number;
    phDays: number;
    phOtHours: number;
    nonPayLeave: number;
    allowance: number;
    advance: number;
  }[] = [];

  try {
    const [view, extras, workers] = await Promise.all([
      loadMonthView(month),
      monthExtras(month),
      listWorkers(),
    ]);
    const person = new Map(workers.map((w) => [w.code, w]));
    rows = view.totals
      .filter((t) => !only || t.code === only)
      .map((t) => ({
        code: t.code,
        name: person.get(t.code)?.name ?? t.code,
        site: person.get(t.code)?.site ?? "",
        group: person.get(t.code)?.group ?? "",
        workingDays: t.workingDays,
        basicDays: t.basicDays,
        otHours: t.otHours,
        restDayHours: t.restDayHours,
        phDays: t.phDays,
        phOtHours: t.phOtHours,
        nonPayLeave: t.nonPayLeave,
        allowance: extras.get(t.code)?.allowance ?? 0,
        advance: extras.get(t.code)?.advance ?? 0,
      }));
  } catch (e) {
    problem = (e as Error).message;
  }

  if (problem) {
    return <Notice tone="bad">Could not build the payslips. {problem}</Notice>;
  }

  return (
    <>
      <div className="no-print mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-faint">
            Report
          </div>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight">
            Payslips &mdash; {monthLabel(month)}
          </h1>
          <p className="mt-1 text-sm text-mute">
            {only ? `One payslip: ${only}.` : `${rows.length} payslips.`} Print this page and
            choose <strong>Save as PDF</strong> to keep or send them.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/api/reports/payslips?month=${month}${only ? `&code=${only}` : ""}`}
            className="rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-semibold transition hover:bg-gray-50"
          >
            Download as Excel
          </Link>
          <PrintButton />
        </div>
      </div>

      <div className="no-print mb-6">
        <Notice tone="info">
          These figures are the ones that go into Million, which works out the real pay,
          the EPF and the SOCSO. The ringgit column here is for reference only.
        </Notice>
      </div>

      {rows.length === 0 && (
        <Notice tone="warn">
          Nothing to print for {monthLabel(month)} yet. Upload the scanner file on Monthly pay
          first.
        </Notice>
      )}

      <div className="space-y-4 print:space-y-0">
        {rows.map((r) => {
          const earned =
            r.basicDays * RATE.basic +
            r.otHours * RATE.ot +
            r.restDayHours * RATE.restDay +
            r.phDays * RATE.basic +
            r.phOtHours * RATE.phOt;
          const net = earned + r.allowance - r.advance;

          return (
            <div
              key={r.code}
              className="break-inside-avoid rounded-2xl border border-line bg-white p-6 print:mb-0 print:break-after-page print:rounded-none print:border-0 print:p-0"
            >
              <div className="mb-4 flex items-start justify-between border-b border-line pb-3">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-faint">
                    Tung Lam Food Industries Sdn Bhd
                  </div>
                  <div className="mt-0.5 text-lg font-extrabold tracking-tight">Payslip</div>
                </div>
                <div className="text-right">
                  <div className="nums text-sm font-bold">{monthLabel(month)}</div>
                  <div className="text-[11px] text-mute">
                    {r.site} {r.group}
                  </div>
                </div>
              </div>

              <div className="mb-4 flex items-baseline gap-3">
                <span className="nums rounded-lg bg-accent-soft px-2 py-1 text-sm font-bold text-accent">
                  {r.code}
                </span>
                <span className="text-base font-bold">{r.name}</span>
              </div>

              <table className="w-full text-sm">
                <tbody>
                  {[
                    ["Working days in the month", String(r.workingDays), ""],
                    ["Days worked", String(r.basicDays), money(r.basicDays * RATE.basic)],
                    ["Overtime hours", r.otHours.toFixed(2), money(r.otHours * RATE.ot)],
                    [
                      "Rest day hours",
                      r.restDayHours.toFixed(2),
                      money(r.restDayHours * RATE.restDay),
                    ],
                    ["Public holidays", String(r.phDays), money(r.phDays * RATE.basic)],
                    [
                      "Public holiday overtime",
                      r.phOtHours.toFixed(2),
                      money(r.phOtHours * RATE.phOt),
                    ],
                    ["No-pay leave days", String(r.nonPayLeave), ""],
                  ].map(([label, count, amount]) => (
                    <tr key={label} className="border-b border-line">
                      <td className="py-1.5">{label}</td>
                      <td className="nums py-1.5 text-right">{count}</td>
                      <td className="nums w-28 py-1.5 text-right text-mute">{amount}</td>
                    </tr>
                  ))}
                  <tr className="border-b border-line">
                    <td className="py-1.5">Allowance</td>
                    <td className="py-1.5" />
                    <td className="nums py-1.5 text-right text-good">+{money(r.allowance)}</td>
                  </tr>
                  <tr className="border-b border-line">
                    <td className="py-1.5">Advance and deductions</td>
                    <td className="py-1.5" />
                    <td className="nums py-1.5 text-right text-bad">&minus;{money(r.advance)}</td>
                  </tr>
                  <tr>
                    <td className="pt-2.5 font-bold">Net, for reference</td>
                    <td className="pt-2.5" />
                    <td className="nums pt-2.5 text-right text-base font-extrabold">
                      RM {money(net)}
                    </td>
                  </tr>
                </tbody>
              </table>

              <p className="mt-4 text-[11px] leading-relaxed text-faint">
                Basic RM{RATE.basic}/day &middot; overtime RM{RATE.ot}/hr &middot; rest day and
                public holiday overtime RM{RATE.restDay}/hr. The figures above are what goes into
                Million; Million works out the real pay, EPF, SOCSO and PCB.
              </p>
            </div>
          );
        })}
      </div>
    </>
  );
}
