"use client";
import { useMemo, useRef, useState } from "react";
import { Btn, Card, Chip, PageHeader, Stat } from "@/components/ui";
import { Flag, MonthTotals, PayExtras, Worker } from "@/lib/types";
import { monthLabel } from "@/lib/time";

/** RM per overtime hour — used only to show what the tea break correction is worth. */
const OT_RATE = 13.08;

interface MonthView {
  totals: MonthTotals[];
  flags: Flag[];
  workers: Worker[];
  extras: Record<string, PayExtras>;
  read?: { rowsInFile: number; rowsForMonth: number; matched: number; unmatched: number };
}

function thisMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export default function MonthPage() {
  const [month, setMonth] = useState(thisMonthKey());
  const [view, setView] = useState<MonthView | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [openWorker, setOpenWorker] = useState<string | null>(null);
  const scansRef = useRef<HTMLInputElement>(null);
  const allowancesRef = useRef<HTMLInputElement>(null);

  async function upload() {
    const file = scansRef.current?.files?.[0];
    if (!file) {
      setProblem("Choose the CheckTime file first.");
      return;
    }
    const form = new FormData();
    form.set("month", month);
    form.set("scans", file);
    const allowances = allowancesRef.current?.files?.[0];
    if (allowances) form.set("allowances", allowances);

    setBusy(true);
    setProblem(null);
    try {
      const res = await fetch("/api/month/upload", { method: "POST", body: form });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not read that file.");
      setView(body);
    } catch (e) {
      setProblem((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function loadExisting() {
    setBusy(true);
    setProblem(null);
    try {
      const res = await fetch(`/api/month/view?month=${month}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not load that month.");
      setView(body);
    } catch (e) {
      setProblem((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function correct(patch: {
    code: string;
    date: string;
    firstOverride?: string | null;
    lastOverride?: string | null;
    markedAbsent?: boolean;
  }) {
    setBusy(true);
    setProblem(null);
    try {
      const res = await fetch("/api/month/correct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month, ...patch }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not save that correction.");
      setView((v) => (v ? { ...body, read: v.read } : body));
    } catch (e) {
      setProblem((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function download() {
    setProblem(null);
    const res = await fetch(`/api/month/export?month=${month}`);
    if (!res.ok) {
      setProblem(await res.text());
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `MILLION_IMPORT_${month}.xls`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const outstanding = view?.flags.length ?? 0;
  const dayFlags = useMemo(() => view?.flags.filter((f) => f.date) ?? [], [view]);
  const monthFlags = useMemo(() => view?.flags.filter((f) => !f.date) ?? [], [view]);
  const nameOf = useMemo(
    () => new Map((view?.workers ?? []).map((w) => [w.code, w.name])),
    [view],
  );

  const difference = (view?.totals ?? []).reduce((sum, t) => sum + t.r2DifferenceHours, 0);

  return (
    <>
      <PageHeader
        title="Month"
        sub={monthLabel(month)}
        right={
          <>
            <input
              type="month"
              value={month}
              onChange={(e) => {
                setMonth(e.target.value);
                setView(null);
              }}
              className="rounded-lg border border-line px-3 py-2 text-sm"
            />
            <Btn kind="ghost" onClick={() => void loadExisting()} disabled={busy}>
              Open
            </Btn>
          </>
        }
      />

      {problem && (
        <Card className="mb-4 border-red-200 bg-red-50 p-4 text-sm text-red-700">{problem}</Card>
      )}

      <Card className="mb-6 p-4">
        <div className="mb-3 text-sm font-semibold">Upload</div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-mute">
              CheckTime file (required)
            </span>
            <input ref={scansRef} type="file" accept=".xls,.xlsx" className="w-full text-sm" />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-mute">
              Allowance &amp; advance file (optional)
            </span>
            <input ref={allowancesRef} type="file" accept=".xls,.xlsx" className="w-full text-sm" />
          </label>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <Btn onClick={() => void upload()} disabled={busy}>
            {busy ? "Reading…" : "Read the file"}
          </Btn>
          {view?.read && (
            <span className="text-xs text-mute">
              {view.read.rowsForMonth} scan rows for this month · {view.read.matched} matched to a
              worker
              {view.read.unmatched > 0 && ` · ${view.read.unmatched} unknown`}
            </span>
          )}
        </div>
      </Card>

      {view && (
        <>
          <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Workers" value={String(view.totals.length)} sub="active this month" />
            <Stat
              label="Still to check"
              value={String(outstanding)}
              sub={outstanding === 0 ? "nothing outstanding" : "export is locked"}
              tone={outstanding === 0 ? "text-emerald-600" : "text-amber-600"}
            />
            <Stat
              label="Overtime"
              value={view.totals.reduce((s, t) => s + t.otHours, 0).toFixed(2)}
              sub="hours, all workers"
            />
            <Stat
              label="Tea break correction"
              value={`RM ${(difference * OT_RATE).toFixed(0)}`}
              sub={`${difference.toFixed(2)} hrs less than the old sheet`}
            />
          </div>

          <Card className="mb-6 p-4">
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <div className="text-sm font-semibold">Check &amp; fix</div>
              {outstanding === 0 ? (
                <Chip tone="teal">Nothing left to check</Chip>
              ) : (
                <Chip tone="amber">
                  {outstanding} {outstanding === 1 ? "thing" : "things"} still to check
                </Chip>
              )}
            </div>

            {monthFlags.length > 0 && (
              <ul className="mb-4 space-y-2">
                {monthFlags.map((f, i) => (
                  <li
                    key={`${f.kind}-${f.code ?? f.name}-${i}`}
                    className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
                  >
                    {f.message}
                  </li>
                ))}
              </ul>
            )}

            {dayFlags.length === 0 && monthFlags.length === 0 && (
              <p className="text-sm text-mute">
                Every day in the month has a start and a finish time. The Million file is ready.
              </p>
            )}

            {dayFlags.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-[11px] uppercase tracking-wider text-mute">
                      <th className="px-2 py-2">Worker</th>
                      <th className="px-2 py-2">Date</th>
                      <th className="px-2 py-2">Scanned</th>
                      <th className="px-2 py-2">What happened</th>
                      <th className="px-2 py-2">Start</th>
                      <th className="px-2 py-2">Finish</th>
                      <th className="px-2 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {dayFlags.slice(0, 200).map((f) => (
                      <FlagRow key={`${f.code}-${f.date}`} flag={f} busy={busy} onFix={correct} />
                    ))}
                  </tbody>
                </table>
                {dayFlags.length > 200 && (
                  <p className="mt-3 text-xs text-mute">
                    Showing the first 200 of {dayFlags.length}. Fix these and the rest will follow.
                  </p>
                )}
              </div>
            )}
          </Card>

          <Card className="p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">Month summary</div>
                <p className="mt-1 text-xs text-mute">
                  &ldquo;Old sheet&rdquo; is what the previous spreadsheet would have paid in
                  overtime. The difference is the tea break correction.
                </p>
              </div>
              <div className="flex items-center gap-3">
                {outstanding > 0 && (
                  <span className="text-xs text-amber-700">
                    Clear the list above to unlock the download
                  </span>
                )}
                <Btn onClick={() => void download()} disabled={busy || outstanding > 0}>
                  Download Million file
                </Btn>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-[11px] uppercase tracking-wider text-mute">
                    <th className="px-2 py-2">Code</th>
                    <th className="px-2 py-2">Name</th>
                    <th className="px-2 py-2 text-right">Basic days</th>
                    <th className="px-2 py-2 text-right">OT hrs</th>
                    <th className="px-2 py-2 text-right text-mute">Old sheet</th>
                    <th className="px-2 py-2 text-right">Rest day</th>
                    <th className="px-2 py-2 text-right">PH</th>
                    <th className="px-2 py-2 text-right">PH OT</th>
                    <th className="px-2 py-2 text-right">No pay</th>
                    <th className="px-2 py-2 text-right">Allowance</th>
                    <th className="px-2 py-2 text-right">Advance</th>
                  </tr>
                </thead>
                <tbody>
                  {view.totals.map((t) => (
                    <tr
                      key={t.code}
                      className="cursor-pointer border-b border-line last:border-0 hover:bg-gray-50"
                      onClick={() => setOpenWorker(openWorker === t.code ? null : t.code)}
                    >
                      <td className="px-2 py-2 font-medium tabular-nums">{t.code}</td>
                      <td className="px-2 py-2">{nameOf.get(t.code) ?? "—"}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{t.basicDays}</td>
                      <td className="px-2 py-2 text-right font-medium tabular-nums">
                        {t.otHours.toFixed(2)}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums text-mute">
                        {t.otHoursOldSheet.toFixed(2)}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">
                        {t.restDayHours.toFixed(2)}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">{t.phDays}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{t.phOtHours.toFixed(2)}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{t.nonPayLeave}</td>
                      <td className="px-2 py-2 text-right tabular-nums">
                        {(view.extras[t.code]?.allowance ?? 0).toFixed(2)}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">
                        {(view.extras[t.code]?.advance ?? 0).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </>
  );
}

function FlagRow({
  flag,
  busy,
  onFix,
}: {
  flag: Flag;
  busy: boolean;
  onFix: (patch: {
    code: string;
    date: string;
    firstOverride?: string | null;
    lastOverride?: string | null;
    markedAbsent?: boolean;
  }) => Promise<void>;
}) {
  const [first, setFirst] = useState(flag.suggestFirst ?? flag.punches[0] ?? "");
  const [last, setLast] = useState(flag.suggestLast ?? "");

  return (
    <tr className="border-b border-line last:border-0 align-top">
      <td className="px-2 py-2">{flag.name}</td>
      <td className="px-2 py-2 whitespace-nowrap tabular-nums">{flag.date}</td>
      <td className="px-2 py-2 tabular-nums text-mute">{flag.punches.join(", ") || "nothing"}</td>
      <td className="px-2 py-2 text-mute">{flag.message}</td>
      <td className="px-2 py-2">
        <input
          className="w-20 rounded border border-line px-2 py-1 text-sm tabular-nums"
          value={first}
          onChange={(e) => setFirst(e.target.value)}
          placeholder="07:00"
        />
      </td>
      <td className="px-2 py-2">
        <input
          className="w-20 rounded border border-line px-2 py-1 text-sm tabular-nums"
          value={last}
          onChange={(e) => setLast(e.target.value)}
          placeholder="19:00"
        />
      </td>
      <td className="px-2 py-2 whitespace-nowrap text-right">
        <Btn
          size="sm"
          disabled={busy}
          onClick={() =>
            void onFix({
              code: flag.code!,
              date: flag.date!,
              firstOverride: first,
              lastOverride: last,
            })
          }
        >
          Accept
        </Btn>{" "}
        <Btn
          size="sm"
          kind="ghost"
          disabled={busy}
          onClick={() => void onFix({ code: flag.code!, date: flag.date!, markedAbsent: true })}
        >
          Absent
        </Btn>
      </td>
    </tr>
  );
}
