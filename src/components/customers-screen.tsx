"use client";
import { Chip, Combobox, Field, Select, inputCls } from "@/components/ui";
import { Column, RecordScreen } from "@/components/record-screen";
import { post } from "@/lib/api";
import { Customer } from "@/lib/types";
import { tidyState } from "@/lib/states";

const TERMS = ["COD", "7 days", "14 days", "30 days", "60 days", "90 days"];

function YesNo({ value, onChange, yes = "Yes", no = "No" }: {
  value: boolean; onChange: (v: boolean) => void; yes?: string; no?: string;
}) {
  const cls = (on: boolean) => `rounded-xl px-3 py-2 text-sm font-semibold transition ${
    on ? "bg-accent text-white" : "border border-line bg-white text-mute"
  }`;
  return (
    <div className="flex gap-2">
      <button type="button" onClick={() => onChange(true)} className={cls(value)}>{yes}</button>
      <button type="button" onClick={() => onChange(false)} className={cls(!value)}>{no}</button>
    </div>
  );
}

export function CustomersScreen({ customers }: { customers: Customer[] }) {
  const states = [...new Set(customers.map((c) => c.state).filter(Boolean))].sort();
  const terms = [...new Set([...TERMS, ...customers.map((c) => c.paymentTerms ?? "").filter(Boolean)])];
  const held = customers.filter((c) => c.onHold).length;

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
      cell: (c) => (
        <div className="flex flex-wrap items-center gap-1.5">
          {c.active ? <Chip tone="teal">Selling</Chip> : <Chip>Stopped</Chip>}
          {c.onHold && <span title={c.holdReason ?? undefined}><Chip tone="red">On hold</Chip></span>}
          {c.paymentTerms && <span className="text-xs text-mute">{c.paymentTerms}</span>}
        </div>
      ),
    },
  ];

  return (
    <RecordScreen<Customer>
      title="Customers"
      sub={
        <span className="nums">
          {customers.length} on the list · {customers.filter((c) => c.active).length} still buying
          {held > 0 && <> · {held} on hold</>}
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
            { value: "hold", label: "On hold", note: String(held) },
          ],
          match: (row, v) =>
            v === "hold" ? (row as Customer).onHold === true : (row as Customer).active === (v === "yes"),
        },
      ]}
      newRow={() => ({
        code: "", name: "", shortName: "", state: "", address: null, contact: null,
        email: null, attn: null, incomeTaxNo: null, active: true, groupCode: null,
        currency: "MYR", paymentTerms: "", creditLimit: null, onHold: false, holdReason: null,
      })}
      editTitle={(c, isNew) => (isNew ? "New customer" : c.code)}
      editSub={(c, isNew) => (isNew ? "Add a dealer or a shop" : c.name)}
      canSave={(c) =>
        !c.code ? "A code is needed"
          : !c.name ? "A name is needed"
          : c.creditLimit != null && (!Number.isFinite(c.creditLimit) || c.creditLimit < 0) ? "The credit limit is not a number"
          : null
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
              placeholder="Penang" onChange={(v) => set({ ...c, state: tidyState(v) })} />
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
            <YesNo value={c.active} onChange={(v) => set({ ...c, active: v })} />
          </Field>

          <div className="border-t border-line pt-5">
            <div className="mb-4 text-[11px] font-bold uppercase tracking-[0.1em] text-faint">Credit and the dealer portal</div>
            <div className="space-y-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Payment terms" hint="Shown to the dealer when they order.">
                  <Combobox value={c.paymentTerms ?? ""} options={terms} addLabel="Other terms…"
                    placeholder="30 days" onChange={(v) => set({ ...c, paymentTerms: v.trim() })} />
                </Field>
                <Field label="Credit limit" hint="For the office. Nothing is blocked on it.">
                  <input className={`${inputCls} nums`} inputMode="decimal" placeholder="Not set"
                    value={c.creditLimit == null ? "" : String(c.creditLimit)}
                    onChange={(e) => {
                      const v = e.target.value.replace(/[,\s]/g, "");
                      set({ ...c, creditLimit: v === "" ? null : Number(v) });
                    }} />
                </Field>
              </div>
              <Field label="Invoiced in" hint="Prices on the portal show in this currency.">
                <Select className="w-[180px]" value={c.currency ?? "MYR"}
                  onChange={(v) => set({ ...c, currency: v === "SGD" ? "SGD" : "MYR" })}
                  options={[{ value: "MYR", label: "Ringgit (RM)" }, { value: "SGD", label: "Singapore dollar (S$)" }]} />
              </Field>
              <Field label="On hold?" hint="They can still order on the portal; their orders wait as “On hold” for you to confirm or cancel.">
                <YesNo value={c.onHold === true} onChange={(v) => set({ ...c, onHold: v, holdReason: v ? c.holdReason ?? null : null })} />
              </Field>
              {c.onHold && (
                <Field label="Why" hint="Only the office sees this.">
                  <input className={inputCls} value={c.holdReason ?? ""} placeholder="Over the credit limit"
                    onChange={(e) => set({ ...c, holdReason: e.target.value || null })} />
                </Field>
              )}
            </div>
          </div>
        </>
      )}
    />
  );
}
