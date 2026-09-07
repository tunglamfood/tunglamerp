"use client";
import { Chip, Combobox, Field, Select, inputCls } from "@/components/ui";
import { Column, RecordScreen } from "@/components/record-screen";
import { post, remove } from "@/lib/api";
import { LeaveRecord, Worker } from "@/lib/types";

const KINDS = ["Annual", "Medical", "Hospital", "Unpaid", "Marriage", "Compassionate", "Maternity", "Paternity"];

/** Whole days between two dates, both ends counted. */
function spanDays(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00`);
  const b = Date.parse(`${to}T00:00:00`);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return 1;
  return Math.round((b - a) / 86_400_000) + 1;
}

export function LeaveScreen({ leave, workers }: { leave: LeaveRecord[]; workers: Worker[] }) {
  const nameOf = new Map(workers.map((w) => [w.code, w.name]));
  const kinds = [...new Set([...KINDS, ...leave.map((l) => l.kind)])];

  const columns: Column<LeaveRecord>[] = [
    { key: "code", head: "Worker", cell: (r) => (
      <div>
        <div className="nums font-semibold">{r.code}</div>
        <div className="text-xs text-mute">{nameOf.get(r.code) ?? "not on the list"}</div>
      </div>
    ) },
    { key: "kind", head: "Kind", cell: (r) => <Chip tone={r.paid ? "teal" : "amber"}>{r.kind}</Chip> },
    { key: "from", head: "From", cell: (r) => <span className="nums">{r.fromDate}</span> },
    { key: "to", head: "To", cell: (r) => <span className="nums">{r.toDate}</span> },
    { key: "days", head: "Days", num: true, cell: (r) => r.days },
    { key: "paid", head: "Paid?", cell: (r) => (r.paid ? "Paid" : <span className="text-warn">No pay</span>) },
    { key: "note", head: "Note", cell: (r) => <span className="text-mute">{r.note ?? ""}</span> },
  ];

  return (
    <RecordScreen<LeaveRecord>
      title="Leave"
      sub={<span className="nums">{leave.length} records</span>}
      rows={leave}
      columns={columns}
      searchIn={(r) => `${r.code} ${nameOf.get(r.code) ?? ""} ${r.kind} ${r.note ?? ""}`}
      empty="No leave recorded yet."
      addLabel="Record leave"
      filters={[
        {
          key: "kind",
          width: "w-[160px]",
          options: [
            { value: "all", label: "All kinds" },
            ...kinds.map((k) => ({
              value: k, label: k, note: String(leave.filter((l) => l.kind === k).length),
            })),
          ],
          match: (row, v) => (row as LeaveRecord).kind === v,
        },
        {
          key: "paid",
          width: "w-[140px]",
          options: [
            { value: "all", label: "Paid or not" },
            { value: "yes", label: "Paid" },
            { value: "no", label: "No pay" },
          ],
          match: (row, v) => (row as LeaveRecord).paid === (v === "yes"),
        },
      ]}
      newRow={() => {
        const today = new Date().toISOString().slice(0, 10);
        return {
          code: workers[0]?.code ?? "", kind: "Annual",
          fromDate: today, toDate: today, days: 1, paid: true, note: null,
        };
      }}
      editTitle={(r, isNew) => (isNew ? "Record leave" : `${r.code} · ${r.kind}`)}
      editSub={(r) => nameOf.get(r.code) ?? ""}
      canSave={(r) => (!r.code ? "Choose a worker" : !r.fromDate ? "Choose a start date" : null)}
      onSave={(r) => post("/api/hr/leave", r)}
      onDelete={(r) => remove(`/api/hr/leave?id=${r.id}`)}
      form={(r, set) => (
        <>
          <Field label="Worker">
            <Select value={r.code} searchable onChange={(v) => set({ ...r, code: v })}
              placeholder="Choose a worker"
              options={workers.map((w) => ({ value: w.code, label: `${w.code} — ${w.name}` }))} />
          </Field>
          <Field label="Kind">
            <Combobox value={r.kind} options={kinds} addLabel="Add a kind…"
              onChange={(v) => set({ ...r, kind: v, paid: v !== "Unpaid" })} />
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="First day">
              <input type="date" className={`${inputCls} nums`} value={r.fromDate}
                onChange={(e) => {
                  const from = e.target.value;
                  const to = r.toDate < from ? from : r.toDate;
                  set({ ...r, fromDate: from, toDate: to, days: spanDays(from, to) });
                }} />
            </Field>
            <Field label="Last day">
              <input type="date" className={`${inputCls} nums`} value={r.toDate}
                onChange={(e) => set({ ...r, toDate: e.target.value, days: spanDays(r.fromDate, e.target.value) })} />
            </Field>
          </div>
          <Field label="How many days" hint="Worked out from the dates. Change it for a half day.">
            <input className={`${inputCls} nums`} inputMode="decimal" value={String(r.days)}
              onChange={(e) => set({ ...r, days: Number(e.target.value) || 0 })} />
          </Field>
          <Field label="Is it paid?" hint="Unpaid leave becomes no-pay days on the payslip.">
            <div className="flex gap-2">
              <button type="button" onClick={() => set({ ...r, paid: true })}
                className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
                  r.paid ? "bg-accent text-white" : "border border-line bg-white text-mute"}`}>
                Paid
              </button>
              <button type="button" onClick={() => set({ ...r, paid: false })}
                className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
                  !r.paid ? "bg-accent text-white" : "border border-line bg-white text-mute"}`}>
                No pay
              </button>
            </div>
          </Field>
          <Field label="Note">
            <input className={inputCls} value={r.note ?? ""}
              onChange={(e) => set({ ...r, note: e.target.value || null })} />
          </Field>
        </>
      )}
    />
  );
}
