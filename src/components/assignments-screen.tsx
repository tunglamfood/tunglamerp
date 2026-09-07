"use client";
import { Chip, Combobox, Field, Select, inputCls } from "@/components/ui";
import { Column, RecordScreen } from "@/components/record-screen";
import { post, remove } from "@/lib/api";
import { Assignment, Worker } from "@/lib/types";

const KINDS = ["Hostel", "Transport"];

export function AssignmentsScreen({
  assignments, workers,
}: {
  assignments: Assignment[]; workers: Worker[];
}) {
  const nameOf = new Map(workers.map((w) => [w.code, w.name]));
  const kinds = [...new Set([...KINDS, ...assignments.map((a) => a.kind)])];
  const values = [...new Set(assignments.map((a) => a.value).filter(Boolean))].sort();

  const columns: Column<Assignment>[] = [
    { key: "code", head: "Worker", cell: (a) => (
      <div>
        <div className="nums font-semibold">{a.code}</div>
        <div className="text-xs text-mute">{nameOf.get(a.code) ?? "not on the list"}</div>
      </div>
    ) },
    { key: "kind", head: "What", cell: (a) => <Chip tone="blue">{a.kind}</Chip> },
    { key: "value", head: "Which", cell: (a) => <span className="font-medium">{a.value}</span> },
    { key: "from", head: "From", cell: (a) => <span className="nums text-mute">{a.fromDate ?? "—"}</span> },
    { key: "to", head: "Until", cell: (a) => (
      a.toDate ? <span className="nums text-mute">{a.toDate}</span> : <Chip tone="teal">still there</Chip>
    ) },
    { key: "note", head: "Note", cell: (a) => <span className="text-mute">{a.note ?? ""}</span> },
  ];

  return (
    <RecordScreen<Assignment>
      title="Hostel & transport"
      sub={<span className="nums">{assignments.filter((a) => !a.toDate).length} current</span>}
      rows={assignments}
      columns={columns}
      searchIn={(a) => `${a.code} ${nameOf.get(a.code) ?? ""} ${a.kind} ${a.value} ${a.note ?? ""}`}
      empty="Nothing recorded yet. Add who sleeps where, and who rides which van."
      addLabel="Add a record"
      filters={[
        {
          key: "kind",
          width: "w-[150px]",
          options: [
            { value: "all", label: "Both" },
            ...kinds.map((k) => ({
              value: k, label: k, note: String(assignments.filter((a) => a.kind === k).length),
            })),
          ],
          match: (row, v) => (row as Assignment).kind === v,
        },
        {
          key: "current",
          width: "w-[150px]",
          options: [
            { value: "all", label: "All time" },
            { value: "yes", label: "Current only" },
            { value: "no", label: "Finished" },
          ],
          match: (row, v) => (!(row as Assignment).toDate) === (v === "yes"),
        },
      ]}
      newRow={() => ({
        code: workers[0]?.code ?? "", kind: "Hostel", value: "",
        fromDate: new Date().toISOString().slice(0, 10), toDate: null, note: null,
      })}
      editTitle={(a, isNew) => (isNew ? "Add a record" : `${a.code} · ${a.kind}`)}
      editSub={(a) => nameOf.get(a.code) ?? ""}
      canSave={(a) => (!a.code ? "Choose a worker" : !a.value ? "Which room or van?" : null)}
      onSave={(a) => post("/api/hr/assignments", a)}
      onDelete={(a) => remove(`/api/hr/assignments?id=${a.id}`)}
      form={(a, set) => (
        <>
          <Field label="Worker">
            <Select value={a.code} searchable onChange={(v) => set({ ...a, code: v })}
              placeholder="Choose a worker"
              options={workers.map((w) => ({ value: w.code, label: `${w.code} — ${w.name}` }))} />
          </Field>
          <Field label="Hostel or transport">
            <Combobox value={a.kind} options={kinds} addLabel="Add a kind…"
              onChange={(v) => set({ ...a, kind: v })} />
          </Field>
          <Field label="Which one" hint="Room number, van number, route name — your own words.">
            <Combobox value={a.value} options={values} addLabel="Add a new one…"
              placeholder="Room 4B" onChange={(v) => set({ ...a, value: v })} />
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="From">
              <input type="date" className={`${inputCls} nums`} value={a.fromDate ?? ""}
                onChange={(e) => set({ ...a, fromDate: e.target.value || null })} />
            </Field>
            <Field label="Until" hint="Leave blank while they are still there.">
              <input type="date" className={`${inputCls} nums`} value={a.toDate ?? ""}
                onChange={(e) => set({ ...a, toDate: e.target.value || null })} />
            </Field>
          </div>
          <Field label="Note">
            <input className={inputCls} value={a.note ?? ""}
              onChange={(e) => set({ ...a, note: e.target.value || null })} />
          </Field>
        </>
      )}
    />
  );
}
