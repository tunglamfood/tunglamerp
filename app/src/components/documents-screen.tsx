"use client";
import { Chip, Combobox, Field, Notice, Select, inputCls } from "@/components/ui";
import { Column, RecordScreen } from "@/components/record-screen";
import { post, remove } from "@/lib/api";
import { WorkerDocument, Worker } from "@/lib/types";
import { ExpiryLevel, expiryLevel, expiryWords } from "@/lib/expiry";

const KINDS = ["Passport", "Work permit", "FOMEMA", "Insurance", "Visa", "Contract"];

const TONE: Record<ExpiryLevel, "red" | "amber" | "blue" | "teal" | "gray"> = {
  expired: "red", urgent: "amber", soon: "blue", fine: "teal", none: "gray",
};

/**
 * The one screen in the system meant to nag. A lapsed work permit stops a
 * worker working and can cost the company a fine, so anything close to running
 * out is put at the top and coloured.
 */
export function DocumentsScreen({
  documents, workers, today,
}: {
  documents: WorkerDocument[]; workers: Worker[]; today: string;
}) {
  const nameOf = new Map(workers.map((w) => [w.code, w.name]));
  const kinds = [...new Set([...KINDS, ...documents.map((d) => d.kind)])];

  const level = (d: WorkerDocument) => expiryLevel(d.expiresOn, today);
  const rank: Record<ExpiryLevel, number> = { expired: 0, urgent: 1, soon: 2, fine: 3, none: 4 };
  const sorted = [...documents].sort((a, b) => {
    const r = rank[level(a)] - rank[level(b)];
    return r !== 0 ? r : (a.expiresOn ?? "9999").localeCompare(b.expiresOn ?? "9999");
  });

  const counts = {
    expired: documents.filter((d) => level(d) === "expired").length,
    urgent: documents.filter((d) => level(d) === "urgent").length,
    soon: documents.filter((d) => level(d) === "soon").length,
  };

  const columns: Column<WorkerDocument>[] = [
    { key: "code", head: "Worker", cell: (d) => (
      <div>
        <div className="nums font-semibold">{d.code}</div>
        <div className="text-xs text-mute">{nameOf.get(d.code) ?? "not on the list"}</div>
      </div>
    ) },
    { key: "kind", head: "Document", cell: (d) => <span className="font-medium">{d.kind}</span> },
    { key: "number", head: "Number", cell: (d) => <span className="nums text-mute">{d.number ?? "—"}</span> },
    { key: "expires", head: "Expires", cell: (d) => <span className="nums">{d.expiresOn ?? "—"}</span> },
    { key: "state", head: "", cell: (d) => (
      <Chip tone={TONE[level(d)]}>{expiryWords(d.expiresOn, today)}</Chip>
    ) },
  ];

  return (
    <RecordScreen<WorkerDocument>
      title="Documents & permits"
      sub={<span className="nums">{documents.length} recorded</span>}
      rows={sorted}
      columns={columns}
      searchIn={(d) => `${d.code} ${nameOf.get(d.code) ?? ""} ${d.kind} ${d.number ?? ""}`}
      empty="Nothing recorded yet. Add a passport or a work permit and the system will start warning you before it runs out."
      addLabel="Add a document"
      filters={[
        {
          key: "kind",
          width: "w-[160px]",
          options: [
            { value: "all", label: "All documents" },
            ...kinds.map((k) => ({
              value: k, label: k, note: String(documents.filter((d) => d.kind === k).length),
            })),
          ],
          match: (row, v) => (row as WorkerDocument).kind === v,
        },
        {
          key: "level",
          width: "w-[180px]",
          options: [
            { value: "all", label: "Any state" },
            { value: "expired", label: "Already expired", note: String(counts.expired) },
            { value: "urgent", label: "Within a month", note: String(counts.urgent) },
            { value: "soon", label: "Within 3 months", note: String(counts.soon) },
            { value: "none", label: "No date recorded" },
          ],
          match: (row, v) => level(row as WorkerDocument) === v,
        },
      ]}
      newRow={() => ({
        code: workers[0]?.code ?? "", kind: "Work permit",
        number: null, issuedOn: null, expiresOn: null, note: null,
      })}
      editTitle={(d, isNew) => (isNew ? "Add a document" : `${d.code} · ${d.kind}`)}
      editSub={(d) => nameOf.get(d.code) ?? ""}
      canSave={(d) => (!d.code ? "Choose a worker" : !d.kind ? "Choose a kind" : null)}
      onSave={(d) => post("/api/hr/documents", d)}
      onDelete={(d) => remove(`/api/hr/documents?id=${d.id}`)}
      form={(d, set) => (
        <>
          {level(d) === "expired" && (
            <Notice tone="bad">
              This has already run out. Somebody working on an expired permit is a fine waiting to
              happen.
            </Notice>
          )}
          {level(d) === "urgent" && (
            <Notice tone="warn">
              {expiryWords(d.expiresOn, today)} — start the renewal now if it has not begun.
            </Notice>
          )}
          <Field label="Worker">
            <Select value={d.code} searchable onChange={(v) => set({ ...d, code: v })}
              placeholder="Choose a worker"
              options={workers.map((w) => ({ value: w.code, label: `${w.code} — ${w.name}` }))} />
          </Field>
          <Field label="Which document">
            <Combobox value={d.kind} options={kinds} addLabel="Add a kind…"
              onChange={(v) => set({ ...d, kind: v })} />
          </Field>
          <Field label="Number">
            <input className={`${inputCls} nums`} value={d.number ?? ""}
              onChange={(e) => set({ ...d, number: e.target.value || null })} />
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Issued on">
              <input type="date" className={`${inputCls} nums`} value={d.issuedOn ?? ""}
                onChange={(e) => set({ ...d, issuedOn: e.target.value || null })} />
            </Field>
            <Field label="Expires on" hint="The date the warnings count down to.">
              <input type="date" className={`${inputCls} nums`} value={d.expiresOn ?? ""}
                onChange={(e) => set({ ...d, expiresOn: e.target.value || null })} />
            </Field>
          </div>
          <Field label="Note">
            <input className={inputCls} value={d.note ?? ""}
              onChange={(e) => set({ ...d, note: e.target.value || null })} />
          </Field>
        </>
      )}
    />
  );
}
