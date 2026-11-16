"use client";
// Sales → Dealer portal: who may sign in at tunglamfood.my/portal, what the
// catalogue there shows, and which dealers each rep orders for.
import { useState } from "react";
import { Btn, Chip, Field, Select, inputCls } from "@/components/ui";
import { Tabs } from "@/components/tabs";
import { Column, RecordScreen } from "@/components/record-screen";
import { post, remove } from "@/lib/api";
import { showPhone } from "@/lib/phone";
import { Customer, CustomerGroup, Product } from "@/lib/types";
import type { PortalAccount, PortalProduct, PortalVariant, SalesRep } from "@/lib/store-portal";

const CATEGORY_LABEL: Record<PortalProduct["category"], string> = {
  tofu: "Tofu", steamboat: "Steamboat", dessert: "Dessert", grocery: "Grocery",
};

function YesNo({ value, onChange, yes = "Yes", no = "No" }: { value: boolean; onChange: (v: boolean) => void; yes?: string; no?: string }) {
  const cls = (on: boolean) =>
    `rounded-xl px-3 py-2 text-sm font-semibold transition ${on ? "bg-accent text-white" : "border border-line bg-white text-mute"}`;
  return (
    <div className="flex gap-2">
      <button type="button" className={cls(value)} onClick={() => onChange(true)}>{yes}</button>
      <button type="button" className={cls(!value)} onClick={() => onChange(false)}>{no}</button>
    </div>
  );
}

export function PortalHub({
  accounts, reps, products, customers, groups, items,
}: {
  accounts: PortalAccount[];
  reps: SalesRep[];
  products: PortalProduct[];
  customers: Customer[];
  groups: CustomerGroup[];
  items: Product[];
}) {
  return (
    <Tabs
      tabs={[
        { id: "logins", label: "Logins", note: String(accounts.length),
          panel: <AccountsScreen accounts={accounts} reps={reps} customers={customers} groups={groups} /> },
        { id: "catalogue", label: "Catalogue", note: String(products.length),
          panel: <CatalogueScreen products={products} items={items} /> },
        { id: "reps", label: "Sales reps", note: String(reps.length),
          panel: <RepsScreen reps={reps} customers={customers} /> },
      ]}
    />
  );
}

/* ── Logins ────────────────────────────────────────────────────────────────── */

function AccountsScreen({
  accounts, reps, customers, groups,
}: { accounts: PortalAccount[]; reps: SalesRep[]; customers: Customer[]; groups: CustomerGroup[] }) {
  const customerOf = new Map(customers.map((c) => [c.code, c]));
  const groupOf = new Map(groups.map((g) => [g.code, g]));
  const repOf = new Map(reps.map((r) => [r.code, r]));

  const who = (a: PortalAccount) =>
    a.role === "rep"
      ? `Rep · ${repOf.get(a.repCode ?? "")?.name ?? a.repCode}`
      : a.customerCode
        ? `${customerOf.get(a.customerCode)?.shortName || customerOf.get(a.customerCode)?.name || a.customerCode}`
        : `Group · ${groupOf.get(a.groupCode ?? "")?.name ?? a.groupCode}`;

  const columns: Column<PortalAccount>[] = [
    { key: "phone", head: "Phone", cell: (a) => <span className="nums font-semibold">{showPhone(a.phone)}</span> },
    { key: "name", head: "Name", cell: (a) => a.name || <span className="text-faint">—</span> },
    { key: "for", head: "Orders for", cell: (a) => <span>{who(a)}</span> },
    {
      key: "last", head: "Last sign-in",
      cell: (a) => <span className="nums text-mute">{a.lastLoginAt ? a.lastLoginAt.slice(0, 10) : "Never"}</span>,
    },
    { key: "active", head: "Status", cell: (a) => (a.active ? <Chip tone="teal">Can sign in</Chip> : <Chip>Off</Chip>) },
  ];

  return (
    <RecordScreen<PortalAccount>
      title="Portal logins"
      sub="Each phone number signs in with a code sent by SMS. A dealer can have several numbers."
      rows={accounts}
      columns={columns}
      searchIn={(a) => `${a.phone} ${a.name} ${who(a)}`}
      empty="Nobody can sign in to the portal yet. Add a dealer's phone number."
      addLabel="Add login"
      filters={[{
        key: "role", width: "w-[150px]",
        options: [{ value: "all", label: "Everyone" }, { value: "dealer", label: "Dealers" }, { value: "rep", label: "Sales reps" }],
        match: (row, v) => (row as PortalAccount).role === v,
      }]}
      newRow={() => ({ phone: "", name: "", role: "dealer", customerCode: null, groupCode: null, repCode: null, active: true })}
      editTitle={(a, isNew) => (isNew ? "New portal login" : showPhone(a.phone))}
      editSub={(a, isNew) => (isNew ? "Let a dealer or rep order online" : who(a))}
      canSave={(a) =>
        !a.phone ? "A phone number is needed"
          : a.role === "dealer" && !a.customerCode && !a.groupCode ? "Pick the dealer"
            : a.role === "rep" && !a.repCode ? "Pick the sales rep" : null}
      onSave={(a) => post("/api/sales/portal/accounts", a)}
      onDelete={(a) => remove(`/api/sales/portal/accounts?id=${a.id}`)}
      form={(a, set) => (
        <>
          <Field label="Phone number" hint="The number the code is sent to — 012-345 6789 or +65 9123 4567.">
            <input className={inputCls} value={a.phone} inputMode="tel"
              onChange={(e) => set({ ...a, phone: e.target.value })} />
          </Field>
          <Field label="Name" hint="Who uses this number — Mr Lim, purchasing.">
            <input className={inputCls} value={a.name} onChange={(e) => set({ ...a, name: e.target.value })} />
          </Field>
          <Field label="Who is it">
            <YesNo value={a.role === "dealer"} yes="A dealer" no="A sales rep"
              onChange={(d) => set({ ...a, role: d ? "dealer" : "rep" })} />
          </Field>
          {a.role === "dealer" ? (
            <>
              <Field label="Dealer" hint="They see this dealer's own prices and orders.">
                <Select searchable value={a.customerCode ?? ""} placeholder="Choose a dealer…"
                  onChange={(v) => set({ ...a, customerCode: v || null, groupCode: null })}
                  options={customers.filter((c) => c.active).map((c) => ({ value: c.code, label: c.shortName || c.name, note: c.code }))} />
              </Field>
              {groups.length > 0 && (
                <Field label="…or a whole group" hint="A chain's office orders for every outlet in the group.">
                  <Select value={a.groupCode ?? ""} placeholder="No group"
                    onChange={(v) => set({ ...a, groupCode: v || null, customerCode: v ? null : a.customerCode })}
                    options={[{ value: "", label: "No group" }, ...groups.map((g) => ({ value: g.code, label: g.name }))]} />
                </Field>
              )}
            </>
          ) : (
            <Field label="Sales rep" hint="Add reps on the Sales reps tab first.">
              <Select value={a.repCode ?? ""} placeholder="Choose a rep…"
                onChange={(v) => set({ ...a, repCode: v || null })}
                options={reps.map((r) => ({ value: r.code, label: r.name, note: `${r.customerCodes.length} dealers` }))} />
            </Field>
          )}
          <Field label="Can sign in?">
            <YesNo value={a.active} onChange={(v) => set({ ...a, active: v })} />
          </Field>
        </>
      )}
    />
  );
}

/* ── Catalogue ─────────────────────────────────────────────────────────────── */

function VariantsEditor({
  variants, items, onChange,
}: { variants: PortalVariant[]; items: Product[]; onChange: (v: PortalVariant[]) => void }) {
  const itemOf = new Map(items.map((i) => [i.itemCode, i]));
  const update = (i: number, patch: Partial<PortalVariant>) =>
    onChange(variants.map((v, j) => (j === i ? { ...v, ...patch } : v)));
  const move = (i: number, d: -1 | 1) => {
    const next = [...variants];
    const j = i + d;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  return (
    <div className="space-y-3">
      {variants.map((v, i) => (
        <div key={i} className="rounded-xl border border-line p-3">
          <div className="mb-2 flex items-start gap-2">
            <div className="flex-1">
              <Select searchable value={v.itemCode} placeholder="Item code…"
                onChange={(code) => update(i, { itemCode: code })}
                options={items.filter((it) => it.active).map((it) => ({ value: it.itemCode, label: it.description, note: it.itemCode }))} />
              {v.itemCode && (
                <div className="mt-1 text-xs text-mute">
                  {itemOf.get(v.itemCode)?.description} · sold by {itemOf.get(v.itemCode)?.uom || "—"}
                </div>
              )}
            </div>
            <Btn kind="ghost" size="sm" onClick={() => move(i, -1)} disabled={i === 0} title="Move up">↑</Btn>
            <Btn kind="ghost" size="sm" onClick={() => move(i, 1)} disabled={i === variants.length - 1} title="Move down">↓</Btn>
            <Btn kind="danger" size="sm" onClick={() => onChange(variants.filter((_, j) => j !== i))} title="Remove">✕</Btn>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <input className={inputCls} placeholder="Label (EN) — 10 pcs" value={v.labelEn}
              onChange={(e) => update(i, { labelEn: e.target.value })} />
            <input className={inputCls} placeholder="Label (BM)" value={v.labelMs ?? ""}
              onChange={(e) => update(i, { labelMs: e.target.value || null })} />
            <input className={inputCls} placeholder="Label (中文)" value={v.labelZh ?? ""}
              onChange={(e) => update(i, { labelZh: e.target.value || null })} />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <input className={`${inputCls} max-w-[280px]`} placeholder="Website photo slug (optional)"
              value={v.websiteSlug ?? ""} onChange={(e) => update(i, { websiteSlug: e.target.value || null })} />
            <label className="flex items-center gap-2 text-sm text-mute">
              <input type="checkbox" checked={v.active} onChange={(e) => update(i, { active: e.target.checked })} />
              Can be ordered
            </label>
          </div>
        </div>
      ))}
      <Btn kind="ghost" size="sm"
        onClick={() => onChange([...variants, { itemCode: "", labelEn: "", labelMs: null, labelZh: null, websiteSlug: null, sort: 0, active: true }])}>
        + Add a variant
      </Btn>
    </div>
  );
}

function CatalogueScreen({ products, items }: { products: PortalProduct[]; items: Product[] }) {
  const columns: Column<PortalProduct>[] = [
    {
      key: "name", head: "Product",
      cell: (p) => (
        <div>
          <div className="font-medium">{p.nameEn}</div>
          <div className="text-xs text-mute">{[p.nameMs, p.nameZh].filter(Boolean).join(" · ")}</div>
        </div>
      ),
    },
    { key: "cat", head: "Category", cell: (p) => <span className="text-mute">{CATEGORY_LABEL[p.category]}{p.brand ? ` · ${p.brand}` : ""}</span> },
    {
      key: "variants", head: "Variants",
      cell: (p) => (
        <div className="flex flex-wrap gap-1">
          {p.variants.map((v) => (
            <Chip key={v.itemCode} tone={v.active ? "gray" : "red"}>{v.labelEn} · {v.itemCode}</Chip>
          ))}
        </div>
      ),
    },
    {
      key: "status", head: "Shown to",
      cell: (p) => !p.active ? <Chip>Hidden</Chip> : p.restricted ? <Chip tone="amber">Priced dealers only</Chip> : <Chip tone="teal">All dealers</Chip>,
    },
  ];

  return (
    <RecordScreen<PortalProduct>
      title="Portal catalogue"
      sub="One product card per entry; each variant is one item code with its own price."
      rows={products}
      columns={columns}
      searchIn={(p) => `${p.nameEn} ${p.nameMs ?? ""} ${p.nameZh ?? ""} ${p.brand} ${p.variants.map((v) => `${v.itemCode} ${v.labelEn}`).join(" ")}`}
      empty="The portal catalogue is empty. Add a product and pick its item codes."
      addLabel="Add product"
      filters={[{
        key: "category", width: "w-[150px]",
        options: [{ value: "all", label: "All categories" }, ...Object.entries(CATEGORY_LABEL).map(([value, label]) => ({
          value, label, note: String(products.filter((p) => p.category === value).length),
        }))],
        match: (row, v) => (row as PortalProduct).category === v,
      }]}
      newRow={() => ({
        nameEn: "", nameMs: null, nameZh: null, category: "tofu", brand: "", websiteSlug: null,
        restricted: false, sort: (products.length + 1) * 10, active: true,
        variants: [{ itemCode: "", labelEn: "", labelMs: null, labelZh: null, websiteSlug: null, sort: 10, active: true }],
      })}
      editTitle={(p, isNew) => (isNew ? "New portal product" : p.nameEn)}
      editSub={(p) => `${p.variants.length} variant${p.variants.length === 1 ? "" : "s"}`}
      canSave={(p) =>
        !p.nameEn ? "An English name is needed"
          : p.variants.filter((v) => v.itemCode).length === 0 ? "Pick at least one item code"
            : p.variants.some((v) => v.itemCode && !v.labelEn) ? "Every variant needs a label" : null}
      onSave={(p) => post("/api/sales/portal/catalogue", p)}
      onDelete={(p) => remove(`/api/sales/portal/catalogue?id=${p.id}`)}
      form={(p, set) => (
        <>
          <Field label="Name (English)">
            <input className={inputCls} value={p.nameEn} onChange={(e) => set({ ...p, nameEn: e.target.value })} />
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Name (BM)">
              <input className={inputCls} value={p.nameMs ?? ""} onChange={(e) => set({ ...p, nameMs: e.target.value || null })} />
            </Field>
            <Field label="Name (中文)">
              <input className={inputCls} value={p.nameZh ?? ""} onChange={(e) => set({ ...p, nameZh: e.target.value || null })} />
            </Field>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Category">
              <Select value={p.category} onChange={(v) => set({ ...p, category: v as PortalProduct["category"] })}
                options={Object.entries(CATEGORY_LABEL).map(([value, label]) => ({ value, label }))} />
            </Field>
            <Field label="Brand">
              <input className={inputCls} value={p.brand} placeholder="Tung Lam, Sakura, Cili…"
                onChange={(e) => set({ ...p, brand: e.target.value })} />
            </Field>
          </div>
          <Field label="Website photo" hint="The product's address on tunglamfood.my, e.g. tl-egg-tofu-120gm. Its photo is used.">
            <input className={inputCls} value={p.websiteSlug ?? ""} onChange={(e) => set({ ...p, websiteSlug: e.target.value || null })} />
          </Field>
          <Field label="Variants" hint="Each item code a dealer can choose, in the order they appear.">
            <VariantsEditor variants={p.variants} items={items} onChange={(variants) => set({ ...p, variants })} />
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Shown on the portal?">
              <YesNo value={p.active} onChange={(v) => set({ ...p, active: v })} />
            </Field>
            <Field label="Private label?" hint="Only dealers with their own price for it will see it.">
              <YesNo value={p.restricted} onChange={(v) => set({ ...p, restricted: v })} />
            </Field>
          </div>
          <Field label="Sort order" hint="Lower comes first.">
            <input className={inputCls} type="number" value={p.sort} onChange={(e) => set({ ...p, sort: Number(e.target.value) || 0 })} />
          </Field>
        </>
      )}
    />
  );
}

/* ── Reps ──────────────────────────────────────────────────────────────────── */

function DealerPicker({ value, customers, onChange }: { value: string[]; customers: Customer[]; onChange: (v: string[]) => void }) {
  const [q, setQ] = useState("");
  const chosen = new Set(value);
  const needle = q.trim().toLowerCase();
  const shown = customers
    .filter((c) => c.active)
    .filter((c) => !needle || `${c.code} ${c.name} ${c.shortName} ${c.state}`.toLowerCase().includes(needle))
    .slice(0, 200);
  const toggle = (code: string) => onChange(chosen.has(code) ? value.filter((c) => c !== code) : [...value, code]);
  return (
    <div>
      <input className={`${inputCls} mb-2`} placeholder="Search dealers by name, code or state…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="max-h-72 overflow-y-auto rounded-xl border border-line">
        {shown.map((c) => (
          <label key={c.code} className="flex cursor-pointer items-center gap-3 border-b border-line px-3 py-2 text-sm last:border-0 hover:bg-gray-50">
            <input type="checkbox" checked={chosen.has(c.code)} onChange={() => toggle(c.code)} />
            <span className="flex-1">{c.shortName || c.name}</span>
            <span className="nums text-xs text-faint">{c.code} · {c.state || "—"}</span>
          </label>
        ))}
      </div>
      <div className="mt-1 text-xs text-mute">{value.length} dealer{value.length === 1 ? "" : "s"} chosen</div>
    </div>
  );
}

function RepsScreen({ reps, customers }: { reps: SalesRep[]; customers: Customer[] }) {
  const columns: Column<SalesRep>[] = [
    { key: "code", head: "Code", cell: (r) => <span className="nums font-semibold">{r.code}</span> },
    { key: "name", head: "Name", cell: (r) => r.name },
    { key: "phone", head: "Phone", cell: (r) => <span className="nums text-mute">{r.phone ? showPhone(r.phone) : "—"}</span> },
    { key: "dealers", head: "Dealers", num: true, cell: (r) => <span className="nums">{r.customerCodes.length}</span> },
    { key: "active", head: "Status", cell: (r) => (r.active ? <Chip tone="teal">Active</Chip> : <Chip>Stopped</Chip>) },
  ];
  return (
    <RecordScreen<SalesRep>
      title="Sales reps"
      sub="A rep signs in on the portal, picks one of their dealers and orders at that dealer's prices."
      rows={reps}
      columns={columns}
      searchIn={(r) => `${r.code} ${r.name} ${r.phone ?? ""}`}
      empty="No sales reps yet."
      addLabel="Add rep"
      newRow={() => ({ code: "", name: "", phone: null, active: true, customerCodes: [] })}
      editTitle={(r, isNew) => (isNew ? "New sales rep" : r.name)}
      editSub={(r) => `${r.customerCodes.length} dealers`}
      canSave={(r) => (!r.code ? "A short code is needed" : !r.name ? "A name is needed" : null)}
      onSave={(r) => post("/api/sales/portal/reps", r)}
      onDelete={(r) => remove(`/api/sales/portal/reps?code=${encodeURIComponent(r.code)}`)}
      form={(r, set) => (
        <>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Code" hint="Short and unique — ALI, REP01.">
              <input className={inputCls} value={r.code} onChange={(e) => set({ ...r, code: e.target.value.toUpperCase() })} />
            </Field>
            <Field label="Name">
              <input className={inputCls} value={r.name} onChange={(e) => set({ ...r, name: e.target.value })} />
            </Field>
          </div>
          <Field label="Phone" hint="For the office. To let the rep sign in, also add a login for this number.">
            <input className={inputCls} value={r.phone ?? ""} inputMode="tel" onChange={(e) => set({ ...r, phone: e.target.value || null })} />
          </Field>
          <Field label="Dealers they look after">
            <DealerPicker value={r.customerCodes} customers={customers} onChange={(customerCodes) => set({ ...r, customerCodes })} />
          </Field>
          <Field label="Active?">
            <YesNo value={r.active} onChange={(v) => set({ ...r, active: v })} />
          </Field>
        </>
      )}
    />
  );
}
