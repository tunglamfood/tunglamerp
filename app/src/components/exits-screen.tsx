"use client";
import { Chip, Field, Select, inputCls } from "@/components/ui";
import { Column, RecordScreen } from "@/components/record-screen";
import { post } from "@/lib/api";
import { ExitRecord, Worker } from "@/lib/types";
import { daysUntil } from "@/lib/expiry";

export function ExitsScreen({
  exits, workers, today,
}: {
  exits: ExitRecord[]; workers: Worker[]; today: string;
}) {
  const nameOf = new Map(workers.map((w) => [w.code, w.name]));

  const columns: Column<ExitRecord>[] = [
    { key: "code", head: "Worker", cell: (e) => (
      <div>
        <div className="nums font-semibold">{e.code}</div>
        <div className="text-xs text-mute">{nameOf.get(e.code) ?? "not on the list"}</div>
      </div>
    ) },
    { key: "told", head: "Told you", cell: (e) => <span className="nums text-mute">{e.toldOn ?? "—"}</span> },
    { key: "last", head: "Last day", cell: (e) => {
      if (!e.lastDay) return <span className="text-faint">not set</span>;
      const left = daysUntil(e.lastDay, today);
      return (
        <div>
          <div className="nums">{e.lastDay}</div>
          {left != null && left >= 0 && (
            <div className="text-xs text-warn">{left === 0 ? "today" : `${left} days away`}</div>
          )}
        </div>
      );
    } },
    { key: "reason", head: "Why", cell: (e) => <span className="text-mute">{e.reason ?? "—"}</span> },
    { key: "settled", head: "Final pay", cell: (e) => (
      e.settled ? <Chip tone="teal">Settled</Chip> : <Chip tone="amber">Outstanding</Chip>
    ) },
  ];

  return (
    <RecordScreen<ExitRecord>
      title="People leaving"
      sub={
        <span className="nums">
          {exits.length} recorded · {exits.filter((e) => !e.settled).length} not settled
        </span>
      }
      rows={exits}
      columns={columns}
      searchIn={(e) => `${e.code} ${nameOf.get(e.code) ?? ""} ${e.reason ?? ""}`}
      empty="Nobody recorded as leaving."
      addLabel="Record a leaver"
      filters={[
        {
          key: "settled",
          width: "w-[170px]",
          options: [
            { value: "all", label: "Everyone" },
            { value: "no", label: "Not settled", note: String(exits.filter((e) => !e.settled).length) },
            { value: "yes", label: "Settled", note: String(exits.filter((e) => e.settled).length) },
          ],
          match: (row, v) => (row as ExitRecord).settled === (v === "yes"),
        },
      ]}
      newRow={() => ({
        code: workers[0]?.code ?? "", toldOn: today, lastDay: null,
        reason: null, noticeDays: null, finalPayNote: null, settled: false,
      })}
      editTitle={(e, isNew) => (isNew ? "Record a leaver" : e.code)}
      editSub={(e) => nameOf.get(e.code) ?? ""}
      canSave={(e) => (!e.code ? "Choose a worker" : null)}
      onSave={(e) => post("/api/hr/exits", e)}
      form={(e, set) => (
        <>
          <Field label="Worker">
            <Select value={e.code} searchable onChange={(v) => set({ ...e, code: v })}
              placeholder="Choose a worker"
              options={workers.map((w) => ({ value: w.code, label: `${w.code} — ${w.name}` }))} />
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="When they told you">
              <input type="date" className={`${inputCls} nums`} value={e.toldOn ?? ""}
                onChange={(ev) => set({ ...e, toldOn: ev.target.value || null })} />
            </Field>
            <Field label="Last working day">
              <input type="date" className={`${inputCls} nums`} value={e.lastDay ?? ""}
                onChange={(ev) => set({ ...e, lastDay: ev.target.value || null })} />
            </Field>
          </div>
          <Field label="Notice given (days)">
            <input className={`${inputCls} nums`} inputMode="numeric" value={e.noticeDays ?? ""}
              onChange={(ev) => set({ ...e, noticeDays: Number(ev.target.value) || null })} />
          </Field>
          <Field label="Why they are going">
            <input className={inputCls} value={e.reason ?? ""} placeholder="Going home, contract ended…"
              onChange={(ev) => set({ ...e, reason: ev.target.value || null })} />
          </Field>
          <Field label="Final pay" hint="What is still owed, or what was held back.">
            <textarea className={`${inputCls} h-24`} value={e.finalPayNote ?? ""}
              onChange={(ev) => set({ ...e, finalPayNote: ev.target.value || null })} />
          </Field>
          <Field label="Is everything settled?" hint="Mark it only once they have been paid in full.">
            <div className="flex gap-2">
              <button type="button" onClick={() => set({ ...e, settled: true })}
                className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
                  e.settled ? "bg-accent text-white" : "border border-line bg-white text-mute"}`}>
                Settled
              </button>
              <button type="button" onClick={() => set({ ...e, settled: false })}
                className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
                  !e.settled ? "bg-accent text-white" : "border border-line bg-white text-mute"}`}>
                Still outstanding
              </button>
            </div>
          </Field>
        </>
      )}
    />
  );
}
