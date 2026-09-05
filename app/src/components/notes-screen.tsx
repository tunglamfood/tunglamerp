"use client";
import { Chip, Combobox, Field, Select, inputCls } from "@/components/ui";
import { Column, RecordScreen } from "@/components/record-screen";
import { post, remove } from "@/lib/api";
import { Worker, WorkerNote } from "@/lib/types";

const KINDS = ["Warning", "Note", "Praise", "Meeting"];
const TONE: Record<string, "red" | "gray" | "teal" | "blue"> = {
  Warning: "red", Note: "gray", Praise: "teal", Meeting: "blue",
};

export function NotesScreen({ notes, workers }: { notes: WorkerNote[]; workers: Worker[] }) {
  const nameOf = new Map(workers.map((w) => [w.code, w.name]));
  const kinds = [...new Set([...KINDS, ...notes.map((n) => n.kind)])];
  const newest = [...notes].sort((a, b) => b.onDate.localeCompare(a.onDate));

  const columns: Column<WorkerNote>[] = [
    { key: "date", head: "Date", cell: (n) => <span className="nums">{n.onDate}</span> },
    { key: "code", head: "Worker", cell: (n) => (
      <div>
        <div className="nums font-semibold">{n.code}</div>
        <div className="text-xs text-mute">{nameOf.get(n.code) ?? "not on the list"}</div>
      </div>
    ) },
    { key: "kind", head: "Kind", cell: (n) => <Chip tone={TONE[n.kind] ?? "gray"}>{n.kind}</Chip> },
    { key: "subject", head: "What happened", cell: (n) => (
      <div>
        <div className="font-medium">{n.subject}</div>
        {n.detail && <div className="truncate text-xs text-mute">{n.detail}</div>}
      </div>
    ) },
  ];

  return (
    <RecordScreen<WorkerNote>
      title="Warnings & notes"
      sub={
        <span className="nums">
          {notes.length} records · {notes.filter((n) => n.kind === "Warning").length} warnings
        </span>
      }
      rows={newest}
      columns={columns}
      searchIn={(n) => `${n.code} ${nameOf.get(n.code) ?? ""} ${n.kind} ${n.subject} ${n.detail ?? ""}`}
      empty="Nothing recorded. Keeping warnings here means they exist when you need them."
      addLabel="Add a record"
      filters={[
        {
          key: "kind",
          width: "w-[150px]",
          options: [
            { value: "all", label: "Everything" },
            ...kinds.map((k) => ({
              value: k, label: k, note: String(notes.filter((n) => n.kind === k).length),
            })),
          ],
          match: (row, v) => (row as WorkerNote).kind === v,
        },
      ]}
      newRow={() => ({
        code: workers[0]?.code ?? "", kind: "Warning",
        onDate: new Date().toISOString().slice(0, 10), subject: "", detail: null,
      })}
      editTitle={(n, isNew) => (isNew ? "Add a record" : `${n.code} · ${n.kind}`)}
      editSub={(n) => nameOf.get(n.code) ?? ""}
      canSave={(n) => (!n.code ? "Choose a worker" : !n.subject ? "A one-line summary is needed" : null)}
      onSave={(n) => post("/api/hr/notes", n)}
      onDelete={(n) => remove(`/api/hr/notes?id=${n.id}`)}
      form={(n, set) => (
        <>
          <Field label="Worker">
            <Select value={n.code} searchable onChange={(v) => set({ ...n, code: v })}
              placeholder="Choose a worker"
              options={workers.map((w) => ({ value: w.code, label: `${w.code} — ${w.name}` }))} />
          </Field>
          <Field label="Kind">
            <Combobox value={n.kind} options={kinds} addLabel="Add a kind…"
              onChange={(v) => set({ ...n, kind: v })} />
          </Field>
          <Field label="When">
            <input type="date" className={`${inputCls} nums`} value={n.onDate}
              onChange={(e) => set({ ...n, onDate: e.target.value })} />
          </Field>
          <Field label="In one line" hint="What somebody reading this in a year needs to know.">
            <input className={inputCls} value={n.subject} placeholder="Late three times this week"
              onChange={(e) => set({ ...n, subject: e.target.value })} />
          </Field>
          <Field label="The full story">
            <textarea className={`${inputCls} h-32`} value={n.detail ?? ""}
              onChange={(e) => set({ ...n, detail: e.target.value || null })} />
          </Field>
        </>
      )}
    />
  );
}
