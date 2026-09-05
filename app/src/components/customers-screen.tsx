"use client";
import { Chip, Combobox, Field, inputCls } from "@/components/ui";
import { Column, RecordScreen } from "@/components/record-screen";
import { post } from "@/lib/api";
import { Customer } from "@/lib/types";

export function CustomersScreen({ customers }: { customers: Customer[] }) {
  const states = [...new Set(customers.map((c) => c.state).filter(Boolean))].sort();

  const columns: Column<Customer>[] = [
    { key: "code", head: "Code", cell: (c) => <span className="nums font-semibold">{c.code}</span> },
    {
      key: "name",
      head: "Name",
      cell: (c) => (
        <div>
          <div className="font-medium">{c.name}</div>
          {c.shortName && c.shortName !== c.name && (
            <div className="text-xs text-mute">known as {c.shortName}</div>
          )}
        </div>
      ),
    },
    { key: "state", head: "State", cell: (c) => c.state || <span className="text-faint">—</span> },
    {
      key: "contact",
      head: "Contact",
      cell: (c) => (
        <div className="text-mute">
          <div className="nums">{c.contact || "—"}</div>
          {c.email && <div className="truncate text-xs">{c.email}</div>}
        </div>
      ),
    },
    {
      key: "active",
      head: "Status",
      cell: (c) => (c.active ? <Chip tone="teal">Selling</Chip> : <Chip>Stopped</Chip>),
    },
  ];

  return (
    <RecordScreen<Customer>
      title="Customers"
      sub={
        <span className="nums">
          {customers.length} on the list · {customers.filter((c) => c.active).length} still buying
        </span>
      }
      rows={customers}
      columns={columns}
      searchIn={(c) => `${c.code} ${c.name} ${c.shortName} ${c.state} ${c.contact ?? ""} ${c.email ?? ""}`}
      empty="No customers yet. Add one, or run scripts/import-sales.mjs to bring in the Million list."
      addLabel="Add customer"
      filters={[
        {
          key: "state",
          width: "w-[164px]",
          options: [
            { value: "all", label: "All states" },
            ...states.map((s) => ({
              value: s,
              label: s,
              note: String(customers.filter((c) => c.state === s).length),
            })),
          ],
          match: (row, v) => (row as Customer).state === v,
        },
        {
          key: "active",
          width: "w-[140px]",
          options: [
            { value: "all", label: "Everyone" },
            { value: "yes", label: "Still buying" },
            { value: "no", label: "Stopped" },
          ],
          match: (row, v) => (row as Customer).active === (v === "yes"),
        },
      ]}
      newRow={() => ({
        code: "", name: "", shortName: "", state: "", address: null, contact: null,
        email: null, attn: null, incomeTaxNo: null, active: true,
      })}
      editTitle={(c, isNew) => (isNew ? "New customer" : c.code)}
      editSub={(c, isNew) => (isNew ? "Add a dealer or a shop" : c.name)}
      canSave={(c) =>
        !c.code ? "A code is needed" : !c.name ? "A name is needed" : null
      }
      onSave={(c) => post("/api/sales/customers", c)}
      form={(c, set) => (
        <>
          <Field label="Code" hint="The debtor code Million uses, like 3030/0003">
            <input className={inputCls} value={c.code} placeholder="3030/0003"
              onChange={(e) => set({ ...c, code: e.target.value })} />
          </Field>
          <Field label="Name" hint="As it appears on the invoice">
            <input className={inputCls} value={c.name}
              onChange={(e) => set({ ...c, name: e.target.value })} />
          </Field>
          <Field label="Short name" hint="What the office actually calls them — 433, Poon Lee">
            <input className={inputCls} value={c.shortName}
              onChange={(e) => set({ ...c, shortName: e.target.value })} />
          </Field>
          <Field label="State" hint="Prices are often set state by state.">
            <Combobox value={c.state} options={states} addLabel="Add a state…"
              placeholder="Penang" onChange={(v) => set({ ...c, state: v })} />
          </Field>
          <Field label="Address">
            <textarea className={`${inputCls} h-24`} value={c.address ?? ""}
              onChange={(e) => set({ ...c, address: e.target.value || null })} />
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Phone">
              <input className={inputCls} value={c.contact ?? ""}
                onChange={(e) => set({ ...c, contact: e.target.value || null })} />
            </Field>
            <Field label="Email">
              <input className={inputCls} value={c.email ?? ""}
                onChange={(e) => set({ ...c, email: e.target.value || null })} />
            </Field>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Attention to">
              <input className={inputCls} value={c.attn ?? ""}
                onChange={(e) => set({ ...c, attn: e.target.value || null })} />
            </Field>
            <Field label="Income tax no.">
              <input className={inputCls} value={c.incomeTaxNo ?? ""}
                onChange={(e) => set({ ...c, incomeTaxNo: e.target.value || null })} />
            </Field>
          </div>
          <Field label="Still buying?" hint="Stopped customers drop out of the order screen.">
            <div className="flex gap-2">
              <button type="button" onClick={() => set({ ...c, active: true })}
                className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
                  c.active ? "bg-accent text-white" : "border border-line bg-white text-mute"
                }`}>
                Yes
              </button>
              <button type="button" onClick={() => set({ ...c, active: false })}
                className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
                  !c.active ? "bg-accent text-white" : "border border-line bg-white text-mute"
                }`}>
                No
              </button>
            </div>
          </Field>
        </>
      )}
    />
  );
}
