"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Btn, Card, Chip, Notice, Select, inputCls } from "@/components/ui";
import { Worker } from "@/lib/types";
import { monthLabel } from "@/lib/time";

const DAY_NAMES = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

interface Row {
  date: string;
  day: number;
  name: string;
  kind: "NORMAL" | "REST" | "PH";
  holiday?: string;
  first: string;
  last: string;
  absent: boolean;
  /** True where the time came from the scanner rather than being typed. */
  scanned: boolean;
}

/** "700" and "7.30" and "19:05" all mean what you would expect. */
function readTime(raw: string): number | null {
  const s = raw.trim().replace(",", ".");
  if (!s) return null;
  let h: number, m: number;
  const sep = s.match(/^(\d{1,2})[:.](\d{1,2})$/);
  if (sep) {
    h = Number(sep[1]);
    m = Number(sep[2]);
  } else if (/^\d{3,4}$/.test(s)) {
    h = Number(s.slice(0, s.length - 2));
    m = Number(s.slice(-2));
  } else if (/^\d{1,2}$/.test(s)) {
    h = Number(s);
    m = 0;
  } else {
    return null;
  }
  if (!Number.isFinite(h) || !Number.isFinite(m) || m > 59 || h > 47) return null;
  return h * 60 + m;
}

const asClock = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

/** Same rules as the payroll, so the office sees the real figure as they type. */
function dayFigures(row: Row): { worked: number | null; ot: number | null; rest: number | null } {
  if (row.absent) return { worked: null, ot: null, rest: null };
  const a = readTime(row.first);
  const b = readTime(row.last);
  if (a == null || b == null) return { worked: null, ot: null, rest: null };
  let worked = b - a;
  if (worked < 0) worked += 24 * 60;

  if (row.kind === "REST") return { worked, ot: null, rest: worked };
  if (row.kind === "PH") return { worked, ot: worked - (worked >= 300 ? 60 : 0), rest: null };
  let ot = worked - 450 - 60;
  if (ot > 120) ot -= 15;
  return { worked, ot, rest: null };
}

const hm = (min: number) => {
  const neg = min < 0;
  const a = Math.abs(min);
  return `${neg ? "-" : ""}${Math.floor(a / 60)}h${String(a % 60).padStart(2, "0")}`;
};

export function KeyInScreen({
  month,
  months,
  workers,
  holidays,
}: {
  month: string;
  months: string[];
  workers: Worker[];
  /** Date to holiday name, for the month being keyed. */
  holidays: Record<string, string>;
}) {
  const [showing, setShowing] = useState(month);
  const [code, setCode] = useState(workers[0]?.code ?? "");
  const [usualStart, setUsualStart] = useState("07:00");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  // Typing that has not reached the database yet. Moving to another worker
  // reloads the grid, so this is what says a save has to happen first.
  const [dirty, setDirty] = useState(false);
  // Both columns are addressable, so the caret can go anywhere in the grid.
  const startRefs = useRef<(HTMLInputElement | null)[]>([]);
  const finishRefs = useRef<(HTMLInputElement | null)[]>([]);

  const worker = workers.find((w) => w.code === code);

  const blankRows = useCallback(
    (key: string): Row[] => {
      const [y, m] = key.split("-").map(Number);
      const last = new Date(y, m, 0).getDate();
      const out: Row[] = [];
      for (let d = 1; d <= last; d++) {
        const date = `${key}-${String(d).padStart(2, "0")}`;
        const dow = new Date(y, m - 1, d).getDay();
        out.push({
          date,
          day: d,
          name: DAY_NAMES[dow],
          kind: holidays[date] ? "PH" : dow === 6 ? "REST" : "NORMAL",
          holiday: holidays[date],
          first: "",
          last: "",
          absent: false,
          scanned: false,
        });
      }
      return out;
    },
    [holidays],
  );

  const load = useCallback(
    async (key: string, who: string) => {
      if (!who) return;
      setLoading(true);
      setProblem(null);
      setSavedAt(null);
      setDirty(false);
      const fresh = blankRows(key);
      try {
        const res = await fetch(`/api/month/keyin?month=${key}&code=${encodeURIComponent(who)}`);
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? "Could not open that month.");
        for (const d of body.value?.days ?? []) {
          const row = fresh.find((r) => r.date === d.date);
          if (!row) continue;
          const punches: string[] = d.punches ?? [];
          row.scanned = punches.length > 0;
          row.first = d.firstOverride ?? punches[0] ?? "";
          row.last = d.lastOverride ?? (punches.length > 1 ? punches[punches.length - 1] : "");
          row.absent = !!d.markedAbsent;
        }
        setRows(fresh);
      } catch (e) {
        setProblem((e as Error).message);
        setRows(fresh);
      } finally {
        setLoading(false);
      }
    },
    [blankRows],
  );

  useEffect(() => {
    let alive = true;
    void (async () => {
      if (!alive) return;
      await load(showing, code);
    })();
    return () => {
      alive = false;
    };
  }, [showing, code, load]);

  function setRow(i: number, patch: Partial<Row>) {
    setRows((all) => all.map((r, x) => (x === i ? { ...r, ...patch } : r)));
    setSavedAt(null);
    setDirty(true);
  }

  /** Fill every empty start with the usual one — the whole point of the screen. */
  function fillStarts() {
    const start = readTime(usualStart);
    if (start == null) {
      setProblem(`"${usualStart}" is not a time. Try 07:00, or just 700.`);
      return;
    }
    setProblem(null);
    setRows((all) =>
      all.map((r) =>
        r.absent || r.kind === "REST" || r.first ? r : { ...r, first: asClock(start) },
      ),
    );
    setSavedAt(null);
    setDirty(true);
  }

  /** True only if the month reached the database. */
  async function save(): Promise<boolean> {
    setSaving(true);
    setProblem(null);
    try {
      const res = await fetch("/api/month/keyin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          month: showing,
          code,
          days: rows.map((r) => ({
            date: r.date,
            first: r.absent ? "" : r.first,
            last: r.absent ? "" : r.last,
            absent: r.absent,
          })),
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not save.");
      setSavedAt(new Date().toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit" }));
      setDirty(false);
      return true;
    } catch (e) {
      setProblem((e as Error).message);
      return false;
    } finally {
      setSaving(false);
    }
  }

  /** Typed but not a time — worth showing at once rather than at save. */
  const looksWrong = (v: string) => v.trim() !== "" && readTime(v) === null;

  /**
   * Rewrite what was typed as a proper clock time, once the caret leaves.
   *
   * Done on the way out rather than on every keystroke: reformatting mid-typing
   * fights the caret, and "7" would become "07:00" before the 30 was reached.
   * Anything that is not a time is left exactly as typed, in red, so the office
   * can see what it actually wrote.
   */
  function tidy(i: number, col: Col) {
    setRows((all) =>
      all.map((r, x) => {
        if (x !== i) return r;
        const raw = col === "first" ? r.first : r.last;
        const min = readTime(raw);
        if (min == null) return r;
        const clock = asClock(min);
        if (clock === raw) return r;
        return col === "first" ? { ...r, first: clock } : { ...r, last: clock };
      }),
    );
  }

  type Col = "first" | "last";

  /** Put the caret in a cell and select what is there, ready to be typed over. */
  function go(i: number, col: Col) {
    const box = (col === "first" ? startRefs : finishRefs).current[i];
    if (!box) return false;
    box.focus();
    box.select();
    return true;
  }

  /** The nearest row above or below that can actually be typed into. */
  function step(from: number, dir: 1 | -1, col: Col) {
    for (let n = from + dir; n >= 0 && n < rows.length; n += dir) {
      if (rows[n].absent) continue;
      if (go(n, col)) return true;
    }
    return false;
  }

  /**
   * Moving around the grid without reaching for the mouse.
   *
   * Up and down walk the column, skipping days marked absent. Enter does the
   * same as down, because that is the habit from a spreadsheet. Left and right
   * cross between start and finish, but only once the caret is already at the
   * edge of the text — otherwise they would stop you editing the middle of a
   * time you had mistyped.
   */
  function onCellKey(e: React.KeyboardEvent<HTMLInputElement>, i: number, col: Col) {
    const box = e.currentTarget;
    const atStart = box.selectionStart === 0 && box.selectionEnd === 0;
    const atEnd =
      box.selectionStart === box.value.length && box.selectionEnd === box.value.length;

    if (e.key === "Enter" || e.key === "ArrowDown") {
      e.preventDefault();
      step(i, 1, col);
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      step(i, -1, col);
      return;
    }
    if (e.key === "ArrowRight" && col === "first" && atEnd) {
      e.preventDefault();
      go(i, "last");
      return;
    }
    if (e.key === "ArrowLeft" && col === "last" && atStart) {
      e.preventDefault();
      go(i, "first");
    }
  }

  const totals = useMemo(() => {
    let basic = 0;
    let ot = 0;
    let rest = 0;
    let ph = 0;
    let phOt = 0;
    let blank = 0;
    for (const r of rows) {
      const f = dayFigures(r);
      if (r.kind === "PH") ph += 1;
      if (f.worked == null) {
        if (!r.absent && r.kind === "NORMAL") blank += 1;
        continue;
      }
      if (r.kind === "REST") rest += f.rest ?? 0;
      else if (r.kind === "PH") phOt += f.ot ?? 0;
      else {
        basic += 1;
        ot += f.ot ?? 0;
      }
    }
    return { basic, ot, rest, ph, phOt, blank };
  }, [rows]);

  const cell = "w-[74px] rounded-lg border px-2 py-1.5 text-sm nums text-center";

  const at = workers.findIndex((w) => w.code === code);

  /**
   * Step to the worker before or after this one, wrapping at either end.
   *
   * Switching reloads the grid from the database, so anything typed and not
   * saved would be gone. Rather than warn about that on every click, the month
   * is saved first and the move waits for it. If the save fails the move is
   * abandoned, leaving the typing on screen with the reason above it — losing a
   * keyed month to a failed save would be the worst outcome of the three.
   */
  async function stepWorker(dir: 1 | -1) {
    if (workers.length < 2 || at < 0 || saving) return;
    if (dirty && !(await save())) return;
    const n = (at + dir + workers.length) % workers.length;
    setCode(workers[n].code);
  }

  const stepBtn =
    "rounded-lg px-2.5 py-1.5 text-[13px] font-semibold text-accent transition " +
    "hover:bg-accent-soft disabled:cursor-not-allowed disabled:text-faint disabled:hover:bg-transparent";

  return (
    <>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="min-w-[190px]">
          <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-faint">
            Month
          </div>
          <Select
            value={showing}
            onChange={(v) => setShowing(v)}
            options={months.map((m) => ({ value: m, label: monthLabel(m) }))}
          />
        </div>

        <div className="min-w-[260px] flex-1">
          <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-faint">
            Worker
          </div>
          <Select
            value={code}
            onChange={setCode}
            searchable
            placeholder="Choose a worker"
            options={workers.map((w) => ({
              value: w.code,
              label: `${w.code} — ${w.name}`,
              note: `${w.site} ${w.group}`,
            }))}
          />
        </div>

        <div>
          <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-faint">
            Usual start
          </div>
          <div className="flex items-stretch gap-2">
            <input
              className={`${inputCls} nums h-[42px] w-[96px] py-0 text-center ${
                looksWrong(usualStart) ? "border-bad bg-bad-soft" : ""
              }`}
              value={usualStart}
              onChange={(e) => setUsualStart(e.target.value)}
              onFocus={(e) => e.currentTarget.select()}
              onBlur={() => {
                const min = readTime(usualStart);
                if (min != null) setUsualStart(asClock(min));
              }}
              placeholder="07:00"
            />
            <Btn kind="ghost" onClick={fillStarts} className="h-[42px] whitespace-nowrap">
              Fill starts
            </Btn>
          </div>
        </div>
      </div>

      {problem && (
        <div className="mb-4">
          <Notice tone="bad">{problem}</Notice>
        </div>
      )}

      <div className="mb-4">
        <Notice tone="info">
          Press <strong>Fill starts</strong> to put the usual start on every empty day, then type
          the finish times. Both columns can be typed in freely. Move with the{" "}
          <strong>arrow keys</strong> — up and down walk the column and skip absent days, left
          and right cross between start and finish. <strong>Enter</strong> drops to the next day,
          same as the down arrow. Times can be typed the short way —{" "}
          <strong>730</strong>, <strong>7.30</strong> or <strong>19:30</strong> — and are
          written out as <strong>07:30</strong> when you move on. Anything that is not a time
          turns red where you typed it. A finish before the start means the shift ran past midnight,
          which is counted properly. <strong>Previous</strong> and <strong>Next</strong> save this
          worker before moving on, so nothing typed is lost.
        </Notice>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_240px]">
        <Card className="overflow-hidden">
          {loading ? (
            <div className="p-10 text-center text-sm text-mute">Opening…</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line bg-gray-50/70 text-left text-[10px] font-bold uppercase tracking-[0.1em] text-faint">
                    <th className="px-3 py-2.5">Day</th>
                    <th className="px-3 py-2.5">Start</th>
                    <th className="px-3 py-2.5">Finish</th>
                    <th className="px-3 py-2.5 text-right">Worked</th>
                    <th className="px-3 py-2.5 text-right">Counts as</th>
                    <th className="px-3 py-2.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => {
                    const f = dayFigures(r);
                    const rest = r.kind === "REST";
                    const ph = r.kind === "PH";
                    return (
                      <tr
                        key={r.date}
                        className={`border-b border-line last:border-0 ${
                          r.absent ? "bg-gray-50/60" : ph ? "bg-accent-soft/40" : rest ? "bg-gray-50/40" : ""
                        }`}
                      >
                        <td className="whitespace-nowrap px-3 py-1.5">
                          <span className="nums font-semibold">{r.day}</span>{" "}
                          <span className="text-xs text-mute">{r.name}</span>
                          {ph && (
                            <div className="text-[11px] font-semibold text-accent">
                              {r.holiday}
                            </div>
                          )}
                          {rest && <div className="text-[11px] text-faint">rest day</div>}
                        </td>
                        <td className="px-3 py-1.5">
                          <input
                            ref={(el) => {
                              startRefs.current[i] = el;
                            }}
                            className={`${cell} ${
                              looksWrong(r.first)
                                ? "border-bad bg-bad-soft"
                                : r.scanned
                                  ? "border-good bg-good-soft"
                                  : "border-line"
                            }`}
                            value={r.first}
                            disabled={r.absent}
                            onChange={(e) => setRow(i, { first: e.target.value })}
                            onKeyDown={(e) => onCellKey(e, i, "first")}
                            onFocus={(e) => e.currentTarget.select()}
                            onBlur={() => tidy(i, "first")}
                            placeholder={rest ? "" : "07:00"}
                          />
                        </td>
                        <td className="px-3 py-1.5">
                          <input
                            ref={(el) => {
                              finishRefs.current[i] = el;
                            }}
                            className={`${cell} ${
                              looksWrong(r.last)
                                ? "border-bad bg-bad-soft"
                                : r.scanned
                                  ? "border-good bg-good-soft"
                                  : "border-line"
                            }`}
                            value={r.last}
                            disabled={r.absent}
                            onChange={(e) => setRow(i, { last: e.target.value })}
                            onKeyDown={(e) => onCellKey(e, i, "last")}
                            onFocus={(e) => e.currentTarget.select()}
                            onBlur={() => tidy(i, "last")}
                            placeholder={rest ? "" : "19:00"}
                          />
                        </td>
                        <td className="nums px-3 py-1.5 text-right text-mute">
                          {f.worked != null ? hm(f.worked) : ""}
                        </td>
                        <td className="nums px-3 py-1.5 text-right">
                          {r.absent ? (
                            <span className="text-warn">absent</span>
                          ) : f.worked == null ? (
                            ""
                          ) : rest ? (
                            <span className="font-semibold">{hm(f.rest ?? 0)} rest</span>
                          ) : ph ? (
                            <span className="font-semibold">{hm(f.ot ?? 0)} PH OT</span>
                          ) : (
                            <span
                              className={`font-semibold ${(f.ot ?? 0) < 0 ? "text-bad" : ""}`}
                            >
                              1 day + {hm(f.ot ?? 0)} OT
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-1.5 text-right">
                          <button
                            onClick={() =>
                              setRow(i, { absent: !r.absent, first: "", last: "" })
                            }
                            className={`rounded-lg px-2 py-1 text-[11px] font-semibold transition ${
                              r.absent
                                ? "bg-warn text-white"
                                : "text-faint hover:bg-gray-100 hover:text-warn"
                            }`}
                          >
                            {r.absent ? "Absent" : "Mark absent"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* ── what it adds up to, as you type ──────────────────────────────── */}
        <div className="lg:sticky lg:top-4 lg:self-start">
          <Card className="p-4">
            <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-faint">
              {worker ? worker.name : "No worker"}
            </div>
            <div className="nums mt-0.5 text-sm font-bold">{code}</div>

            <dl className="mt-4 space-y-2 text-sm">
              {[
                ["Basic days", String(totals.basic)],
                ["Overtime", hm(totals.ot)],
                ["Rest day", hm(totals.rest)],
                ["Public holidays", String(totals.ph)],
                ["PH overtime", hm(totals.phOt)],
              ].map(([k, v]) => (
                <div key={k} className="flex items-baseline justify-between gap-3">
                  <dt className="text-mute">{k}</dt>
                  <dd className="nums font-semibold">{v}</dd>
                </div>
              ))}
            </dl>

            {totals.blank > 0 && (
              <div className="mt-3 rounded-lg bg-warn-soft px-3 py-2 text-[12px] text-warn">
                {totals.blank} working {totals.blank === 1 ? "day is" : "days are"} still blank.
                Key the times, or mark them absent.
              </div>
            )}

            <div className="mt-4 flex flex-col gap-2">
              <Btn onClick={() => void save()} disabled={saving || loading || !code}>
                {saving ? "Saving…" : "Save this worker"}
              </Btn>
              {savedAt && (
                <span className="text-center text-[12px] font-semibold text-good">
                  Saved at {savedAt}
                </span>
              )}
            </div>

            <p className="mt-4 text-[11px] leading-relaxed text-faint">
              Green boxes came from the scanner. Anything you type replaces them for that day.
            </p>
          </Card>

          <div className="mt-3 flex items-center justify-between gap-1">
            <button
              onClick={() => void stepWorker(-1)}
              disabled={workers.length < 2 || saving || loading}
              className={stepBtn}
              title="The worker before this one — saves first"
            >
              &larr; Previous
            </button>
            <Chip>{at >= 0 ? `${at + 1} of ${workers.length}` : `${workers.length} workers`}</Chip>
            <button
              onClick={() => void stepWorker(1)}
              disabled={workers.length < 2 || saving || loading}
              className={stepBtn}
              title="The worker after this one — saves first"
            >
              Next &rarr;
            </button>
          </div>

          <p className="mt-2 text-center text-[11px] font-semibold text-warn">
            {saving ? "Saving…" : dirty ? "Not saved yet — moving on will save it" : "\u00a0"}
          </p>
        </div>
      </div>
    </>
  );
}
