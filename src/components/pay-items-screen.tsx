"use client";
import { useState } from "react";
import { Chip, Combobox, Field, Select, inputCls } from "@/components/ui";
import { Column, RecordScreen } from "@/components/record-screen";
import { post, remove } from "@/lib/api";
import { PayItem, Worker } from "@/lib/types";
import { monthLabel } from "@/lib/time";

const money = (n: number) => n.toFixed(2);

/** Money that is added, and money that is taken off. Kept apart because
 *  getting the sign wrong is the one mistake that reaches a payslip. */
const ADDS = "allowance";

export function PayItemsScreen({
  items, workers, months, month,
}: {
  items: PayItem[]; workers: Worker[]; months: string[]; month: string;
}) {
  const [showing, setShowing] = useState(month);
  const nameOf = new Map(workers.map((w) => [w.code, w.name]));
  const kinds = [...new Set(["allowance", "advance", "deduction", ...items.map((i) => i.kind)])];
  const labels = [...new Set(items.map((i) => i.label).filter(Boolean))].sort();
  const rows = items.filter((i) => i.monthKey === showing);

  const added = rows.filter((r) => r.kind === ADDS).reduce((s, r) => s + r.amount, 0);
  const taken = rows.filter((r) => r.kind !== ADDS).reduce((s, r) => s + r.amount, 0);

  const columns: Column<PayItem>[] = [
    { key: "code", head: "Worker", cell: (r) => (
      <div>
        <div className="nums font-semibold">{r.code}</div>
        <div className="text-xs text-mute">{nameOf.get(r.code) ?? "not on the list"}</div>
      </div>
    ) },
    { key: "kind", head: "Kind", cell: (r) => (
      <Chip tone={r.kind === ADDS ? "teal" : "amber"}>{r.kind}</Chip>
    ) },
    { key: "label", head: "What for", cell: (r) => r.label || <span className="text-faint">—</span> },
    { key: "amount", head: "Amount", num: true, cell: (r) => (
      <span className={r.kind === ADDS ? "font-semibold text-good" : "font-semibold"}>
        {r.kind === ADDS ? "+" : "\u2212"}{money(r.amount)}
      </span>
    ) },
    { key: "note", head: "Note", cell: (r) => <span className="text-mute">{r.note ?? ""}</span> },
  ];

  return (
    <RecordScreen<PayItem>
      title="Allowances & advances"
      sub={
        <span className="nums">
          {monthLabel(showing)} · {rows.length} lines · +{money(added)} added · &minus;{money(taken)} taken off
        </span>
      }
      rows={rows}
      columns={columns}
      searchIn={(r) => `${r.code} ${nameOf.get(r.code) ?? ""} ${r.kind} ${r.label} ${r.note ?? ""}`}
      empty="Nothing recorded for this month yet."
      addLabel="Add a line"
      toolbarExtra={
        <Select className="w-[186px]" value={showing} onChange={setShowing}
          options={months.map((m) => ({
            value: m, label: monthLabel(m),
            note: String(items.filter((i) => i.monthKey === m).length || ""),
          }))} />
      }
      filters={[
        {
          key: "kind",
          width: "w-[150px]",
          options: [
            { value: "all", label: "All kinds" },
            ...kinds.map((k) => ({
              value: k, label: k, note: String(rows.filter((r) => r.kind === k).length),
            })),
          ],
          match: (row, v) => (row as PayItem).kind === v,
        },
      ]}
      newRow={() => ({
        monthKey: showing, code: workers[0]?.code ?? "", kind: "allowance",
        label: "", amount: 0, note: null,
      })}
      editTitle={(r, isNew) => (isNew ? "New money line" : `${r.code} · ${r.kind}`)}
      editSub={() => monthLabel(showing)}
      canSave={(r) => (!r.code ? "Choose a worker" : !r.kind ? "Choose a kind" : null)}
      onSave={(r) => post("/api/hr/pay-items", r)}
      onDelete={(r) => remove(`/api/hr/pay-items?id=${r.id}`)}
      form={(r, set) => (
        <>
          <Field label="Worker">
            <Select value={r.code} searchable onChange={(v) => set({ ...r, code: v })}
              placeholder="Choose a worker"
              options={workers.map((w) => ({ value: w.code, label: `${w.code} — ${w.name}` }))} />
          </Field>
          <Field label="Kind" hint="Allowance is added to the pay. Anything else is taken off.">
            <Combobox value={r.kind} options={kinds} addLabel="Add a kind…"
              onChange={(v) => set({ ...r, kind: v })} />
          </Field>
          <Field label="What for" hint="Levy, hostel, attendance, uniform…">
            <Combobox value={r.label} options={labels} addLabel="Add a reason…"
              placeholder="Levy" onChange={(v) => set({ ...r, label: v })} />
          </Field>
          <Field label="Amount (RM)">
            <input className={`${inputCls} nums text-lg font-bold`} inputMode="decimal"
              value={String(r.amount)}
              onChange={(e) => set({ ...r, amount: Number(e.target.value) || 0 })} />
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
