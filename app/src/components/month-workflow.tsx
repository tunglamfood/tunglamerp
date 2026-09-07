"use client";
import { useMemo, useState } from "react";
import { Btn, Card, Chip, FilePicker, Notice, Select, Stat, Step, StepState } from "@/components/ui";
import { Flag } from "@/lib/types";
import { monthLabel } from "@/lib/time";
import { MonthView, hasAnything } from "@/lib/month-view";

/** RM per overtime hour — used only to show what the tea break correction is worth. */
const OT_RATE = 13.08;

/** The last two years of months, newest first. Friendlier than the browser's
 *  own month widget, which differs on every machine and has no words on it. */
function recentMonths(from: string, count = 24): string[] {
  const [y, m] = from.split("-").map(Number);
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(y, m - 1 - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

export function MonthWorkflow({
  initialMonth,
  initialView,
}: {
  initialMonth: string;
  initialView: MonthView | null;
}) {
  const [month, setMonth] = useState(initialMonth);
  const [view, setView] = useState<MonthView | null>(initialView);
  const [scanFile, setScanFile] = useState<File | null>(null);
  const [allowanceFile, setAllowanceFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [openWorker, setOpenWorker] = useState<string | null>(null);
  const months = useMemo(() => recentMonths(initialMonth), [initialMonth]);

  /**
   * Changing the month opens whatever is already stored for it. This runs from
   * the picker's own change event, not an effect — the fetch happens because
   * somebody picked a month, which is exactly when it should.
   */
  async function pickMonth(key: string) {
    setMonth(key);
    setScanFile(null);
    setAllowanceFile(null);
    setLoading(true);
    setProblem(null);
    try {
      const res = await fetch(`/api/month/view?month=${key}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not load that month.");
      setView(hasAnything(body) ? body : null);
    } catch (e) {
      setProblem((e as Error).message);
      setView(null);
    } finally {
      setLoading(false);
    }
  }

  async function upload() {
    if (!scanFile) return;
    const form = new FormData();
    form.set("month", month);
    form.set("scans", scanFile);
    if (allowanceFile) form.set("allowances", allowanceFile);

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

  async function correct(patch: {
    code: string; date: string;
    firstOverride?: string | null; lastOverride?: string | null; markedAbsent?: boolean;
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
  const nameOf = useMemo(() => new Map((view?.workers ?? []).map((w) => [w.code, w.name])), [view]);
  const difference = (view?.totals ?? []).reduce((s, t) => s + t.r2DifferenceHours, 0);

  const step2: StepState = view ? "done" : "current";
  const step3: StepState = !view ? "waiting" : outstanding === 0 ? "done" : "current";
  const step4: StepState = !view ? "waiting" : outstanding === 0 ? "current" : "waiting";

  return (
    <>
      <div className="mb-6">
        <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-faint">HR</div>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight">Monthly pay</h1>
        <p className="mt-1 text-sm text-mute">
          Four steps, in order. The download at the end stays locked until everything adds up.
        </p>
      </div>

      {problem && <div className="mb-4"><Notice tone="bad">{problem}</Notice></div>}

      <div className="space-y-3">
        {/* ── 1 ─────────────────────────────────────────────────────────── */}
        <Step
          n={1}
          title="Which month are you paying?"
          state="done"
          hint="Pick it and anything already saved for that month opens by itself."
          delay={0}
        >
          <div className="flex flex-wrap items-center gap-3">
            <Select value={month} onChange={(v) => void pickMonth(v)} className="w-[200px]"
              searchable={false}
              options={months.map((m) => ({ value: m, label: monthLabel(m) }))} />
            {loading ? (
              <Chip>checking…</Chip>
            ) : view ? (
              <Chip tone="teal">already uploaded</Chip>
            ) : (
              <Chip>nothing uploaded yet</Chip>
            )}
          </div>
        </Step>

        {/* ── 2 ─────────────────────────────────────────────────────────── */}
        <Step
          n={2}
          title="Add the file from the scanner"
          state={step2}
          hint={
            view
              ? "Already read. Drop a newer file in if you re-exported it — it replaces the old one."
              : "In CheckTime, run the In Out Report for this month and save it. That is the file."
          }
          delay={60}
        >
          <div className="grid gap-4 lg:grid-cols-2">
            <FilePicker
              label="CheckTime In Out Report"
              hint="The In Out Report, straight out of CheckTime"
              required
              file={scanFile}
              onPick={setScanFile}
              disabled={busy}
            />
            <FilePicker
              label="Allowance & advance sheet"
              hint="Only if you pay allowances or hold advances this month"
              file={allowanceFile}
              onPick={setAllowanceFile}
              disabled={busy}
              template={{ href: "/api/template/allowances", label: "Download blank template" }}
            />
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Btn onClick={() => void upload()} disabled={busy || !scanFile}>
              {busy ? "Reading…" : "Read the file"}
            </Btn>
            {!scanFile && !view && (
              <span className="text-sm text-mute">Choose the scanner file first.</span>
            )}
            {view?.read && (
              <span className="nums text-xs text-mute">
                {view.read.rowsForMonth} rows for this month · {view.read.matched} matched to a worker
                {view.read.unmatched > 0 && ` · ${view.read.unmatched} unknown`}
              </span>
            )}
          </div>
        </Step>

        {/* ── 3 ─────────────────────────────────────────────────────────── */}
        <Step
          n={3}
          title="Check anything that does not add up"
          state={step3}
          hint={
            !view
              ? "Nothing to check until the file is read."
              : outstanding === 0
                ? "Nothing outstanding. Every day has a start and a finish."
                : "Each row has a suggested time already filled in. Accept it, correct it, or mark the day absent."
          }
          delay={120}
        >
          {view && (
            <>
              {outstanding > 100 && (
                <div className="mb-4">
                  <Notice tone="info">
                    A list this long means the scanner was not running properly that month —
                    people missing whole days, or scanning once instead of twice. Once everyone
                    scans in and out each day this should be a handful of rows, or none.
                  </Notice>
                </div>
              )}

              <div className="mb-4 flex flex-wrap items-center gap-2">
                {outstanding === 0 ? (
                  <Chip tone="teal">all clear</Chip>
                ) : (
                  <Chip tone="amber">
                    {outstanding} {outstanding === 1 ? "thing" : "things"} still to check
                  </Chip>
                )}
                {dayFlags.length > 0 && <Chip>{dayFlags.length} days</Chip>}
                {monthFlags.length > 0 && <Chip>{monthFlags.length} about people</Chip>}
              </div>

              {monthFlags.length > 0 && (
                <ul className="mb-4 space-y-2">
                  {monthFlags.slice(0, 8).map((f, i) => (
                    <li key={`${f.kind}-${f.code ?? f.name}-${i}`}>
                      <Notice tone="warn">{f.message}</Notice>
                    </li>
                  ))}
                  {monthFlags.length > 8 && (
                    <li className="text-xs text-mute">
                      …and {monthFlags.length - 8} more like these.
                    </li>
                  )}
                </ul>
              )}

              {dayFlags.length > 0 && (
                <div className="overflow-x-auto rounded-xl border border-line">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-line bg-gray-50/70 text-left text-[10px] font-bold uppercase tracking-[0.1em] text-faint">
                        <th className="px-3 py-2.5">Worker</th>
                        <th className="px-3 py-2.5">Date</th>
                        <th className="px-3 py-2.5">Scanned</th>
                        <th className="px-3 py-2.5">What happened</th>
                        <th className="px-3 py-2.5">Start</th>
                        <th className="px-3 py-2.5">Finish</th>
                        <th className="px-3 py-2.5"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {dayFlags.slice(0, 100).map((f) => (
                        <FlagRow key={`${f.code}-${f.date}`} flag={f} busy={busy} onFix={correct} />
                      ))}
                    </tbody>
                  </table>
                  {dayFlags.length > 100 && (
                    <div className="border-t border-line bg-gray-50/70 px-3 py-2.5 text-xs text-mute">
                      Showing the first 100 of {dayFlags.length}. Clear these and the next lot appears.
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </Step>

        {/* ── 4 ─────────────────────────────────────────────────────────── */}
        <Step
          n={4}
          title="Download the file for Million"
          state={step4}
          hint={
            !view
              ? "Waiting on the steps above."
              : outstanding > 0
                ? `Locked. ${outstanding} ${outstanding === 1 ? "thing needs" : "things need"} checking in step 3 first.`
                : "Ready. Bring this file into Million and it makes the payslips."
          }
          delay={180}
        >
          {view && (
            <Btn onClick={() => void download()} disabled={busy || outstanding > 0}
              title={outstanding > 0 ? "Clear the check list first" : undefined}>
              {outstanding > 0 ? "Locked until step 3 is clear" : "Download Million file"}
            </Btn>
          )}
        </Step>
      </div>

      {/* ── the numbers ─────────────────────────────────────────────────── */}
      {view && (
        <>
          <div className="mt-10 mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Workers" value={String(view.totals.length)} sub="active this month" />
            <Stat label="Still to check" value={String(outstanding)}
              sub={outstanding === 0 ? "nothing outstanding" : "download is locked"}
              tone={outstanding === 0 ? "text-good" : "text-warn"} />
            <Stat label="Overtime" value={view.totals.reduce((s, t) => s + t.otHours, 0).toFixed(2)}
              sub="hours, everyone" />
            <Stat label="Tea break correction" value={`RM ${(difference * OT_RATE).toFixed(0)}`}
              sub={`${difference.toFixed(2)} hrs less than the old sheet`} />
          </div>

          <Card className="overflow-hidden">
            <div className="border-b border-line px-5 py-4">
              <div className="text-base font-bold tracking-tight">Every worker, this month</div>
              <p className="mt-1 text-[13px] text-mute">
                &ldquo;Old sheet&rdquo; is what the previous spreadsheet would have paid in overtime.
                The gap is the tea break correction.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line bg-gray-50/70 text-left text-[10px] font-bold uppercase tracking-[0.1em] text-faint">
                    <th className="px-3 py-2.5">Code</th>
                    <th className="px-3 py-2.5">Name</th>
                    <th className="px-3 py-2.5 text-right">Basic days</th>
                    <th className="px-3 py-2.5 text-right">OT hrs</th>
                    <th className="px-3 py-2.5 text-right">Old sheet</th>
                    <th className="px-3 py-2.5 text-right">Rest day</th>
                    <th className="px-3 py-2.5 text-right">PH</th>
                    <th className="px-3 py-2.5 text-right">PH OT</th>
                    <th className="px-3 py-2.5 text-right">No pay</th>
                    <th className="px-3 py-2.5 text-right">Allowance</th>
                    <th className="px-3 py-2.5 text-right">Advance</th>
                  </tr>
                </thead>
                <tbody>
                  {view.totals.map((t) => (
                    <tr key={t.code}
                      onClick={() => setOpenWorker(openWorker === t.code ? null : t.code)}
                      className="cursor-pointer border-b border-line last:border-0 hover:bg-accent-soft/40">
                      <td className="nums px-3 py-2.5 font-semibold">{t.code}</td>
                      <td className="px-3 py-2.5">{nameOf.get(t.code) ?? "—"}</td>
                      <td className="nums px-3 py-2.5 text-right">{t.basicDays}</td>
                      <td className="nums px-3 py-2.5 text-right font-semibold">{t.otHours.toFixed(2)}</td>
                      <td className="nums px-3 py-2.5 text-right text-faint">{t.otHoursOldSheet.toFixed(2)}</td>
                      <td className="nums px-3 py-2.5 text-right">{t.restDayHours.toFixed(2)}</td>
                      <td className="nums px-3 py-2.5 text-right">{t.phDays}</td>
                      <td className="nums px-3 py-2.5 text-right">{t.phOtHours.toFixed(2)}</td>
                      <td className="nums px-3 py-2.5 text-right">{t.nonPayLeave}</td>
                      <td className="nums px-3 py-2.5 text-right">{(view.extras[t.code]?.allowance ?? 0).toFixed(2)}</td>
                      <td className="nums px-3 py-2.5 text-right">{(view.extras[t.code]?.advance ?? 0).toFixed(2)}</td>
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
  flag, busy, onFix,
}: {
  flag: Flag;
  busy: boolean;
  onFix: (patch: {
    code: string; date: string;
    firstOverride?: string | null; lastOverride?: string | null; markedAbsent?: boolean;
  }) => Promise<void>;
}) {
  const [first, setFirst] = useState(flag.suggestFirst ?? "");
  const [last, setLast] = useState(flag.suggestLast ?? "");
  const cell = "w-[76px] rounded-lg border px-2 py-1.5 text-sm nums";
  // Nothing is guessed for the office, so nothing can be accepted until both
  // ends of the day are actually there.
  const ready = first.trim() !== "" && last.trim() !== "";

  return (
    <tr className="border-b border-line align-top last:border-0">
      <td className="px-3 py-2.5">{flag.name}</td>
      <td className="nums whitespace-nowrap px-3 py-2.5">{flag.date}</td>
      <td className="nums px-3 py-2.5 text-mute">{flag.punches.join(", ") || "nothing"}</td>
      <td className="max-w-xs px-3 py-2.5 text-[13px] text-mute">{flag.message}</td>
      <td className="px-3 py-2.5">
        <input
          className={`${cell} ${first.trim() ? "border-line" : "border-warn-line bg-warn-soft"}`}
          value={first}
          onChange={(e) => setFirst(e.target.value)}
          placeholder="start"
        />
      </td>
      <td className="px-3 py-2.5">
        <input
          className={`${cell} ${last.trim() ? "border-line" : "border-warn-line bg-warn-soft"}`}
          value={last}
          onChange={(e) => setLast(e.target.value)}
          placeholder="finish"
        />
      </td>
      <td className="whitespace-nowrap px-3 py-2.5 text-right">
        <Btn size="sm" disabled={busy || !ready}
          title={ready ? undefined : "Both times are needed"}
          onClick={() => void onFix({ code: flag.code!, date: flag.date!, firstOverride: first, lastOverride: last })}>
          Save
        </Btn>{" "}
        <Btn size="sm" kind="ghost" disabled={busy}
          onClick={() => void onFix({ code: flag.code!, date: flag.date!, markedAbsent: true })}>
          Absent
        </Btn>
      </td>
    </tr>
  );
}
