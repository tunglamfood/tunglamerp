"use client";
// Promotions: a promo price — or a % off each dealer's own price — for one item,
// for everyone, one group or one dealer, between two dates, optionally only from
// a minimum quantity. The portal shows it; the database applies it to the order.
import { Chip, Field, Select, inputCls } from "@/components/ui";
import { Column, RecordScreen } from "@/components/record-screen";
import { post, remove } from "@/lib/api";
import type { Promotion } from "@/lib/store-promotions";
import type { Customer, CustomerGroup, Product } from "@/lib/types";

const rm = (n: number) => `RM ${n.toFixed(2)}`;

export function PromotionsScreen({
  promotions, products, customers, groups, today,
}: { promotions: Promotion[]; products: Product[]; customers: Customer[]; groups: CustomerGroup[]; today: string }) {
  const itemOf = new Map(products.map((p) => [p.itemCode, p]));
  const custOf = new Map(customers.map((c) => [c.code, c.shortName || c.name]));
  const groupOf = new Map(groups.map((g) => [g.code, g.name]));
  const state = (p: Promotion) =>
    !p.active ? "off" : p.startsOn > today ? "later" : p.endsOn && p.endsOn < today ? "ended" : "live";
  const who = (p: Promotion) =>
    p.customerCode ? custOf.get(p.customerCode) ?? p.customerCode : p.groupCode ? `Group · ${groupOf.get(p.groupCode) ?? p.groupCode}` : "All dealers";
  const deal = (p: Promotion) =>
    `${p.kind === "price" ? `${rm(p.value)} each` : `${p.value}% off`}${p.minQty > 1 ? ` from ${p.minQty} ${(itemOf.get(p.itemCode)?.uom ?? "").toLowerCase()}` : ""}`;

  const columns: Column<Promotion>[] = [
    { key: "title", head: "Promotion", cell: (p) => <div><div className="font-medium">{p.titleEn}</div><div className="text-xs text-mute">{itemOf.get(p.itemCode)?.description ?? p.itemCode} · {p.itemCode}</div></div> },
    { key: "deal", head: "Deal", cell: (p) => <span className="nums font-semibold">{deal(p)}</span> },
    { key: "who", head: "For", cell: (p) => <span className="text-mute">{who(p)}</span> },
    { key: "dates", head: "Dates", cell: (p) => <span className="nums text-mute">{p.startsOn} → {p.endsOn ?? "no end"}</span> },
    {
      key: "state", head: "Status",
      cell: (p) => ({ live: <Chip tone="teal">On now</Chip>, later: <Chip tone="blue">Starts later</Chip>, ended: <Chip>Ended</Chip>, off: <Chip>Off</Chip> })[state(p)],
    },
  ];

  return (
    <RecordScreen<Promotion>
      title="Promotions"
      sub="Dealers see these on the portal with a Promo tag. When a portal order qualifies, the database uses the promotion price — unless the dealer's own price is already lower."
      rows={promotions}
      columns={columns}
      searchIn={(p) => `${p.titleEn} ${p.itemCode} ${itemOf.get(p.itemCode)?.description ?? ""} ${who(p)}`}
      empty="No promotions yet. Add one for a slow item, a festive season or a new product."
      addLabel="Add promotion"
      filters={[{
        key: "state", width: "w-[160px]",
        options: [{ value: "all", label: "All" }, { value: "live", label: "On now" }, { value: "later", label: "Starts later" }, { value: "ended", label: "Ended" }, { value: "off", label: "Off" }],
        match: (row, v) => state(row as Promotion) === v,
      }]}
      newRow={() => ({
        titleEn: "", titleMs: null, titleZh: null, itemCode: "", kind: "price", value: 0, minQty: 1,
        customerCode: null, groupCode: null, startsOn: today, endsOn: null, active: true,
      })}
      editTitle={(p, isNew) => (isNew ? "New promotion" : p.titleEn)}
      editSub={(p) => (p.itemCode ? `${itemOf.get(p.itemCode)?.description ?? p.itemCode} · list price ${rm(itemOf.get(p.itemCode)?.basePrice ?? 0)}` : "Pick the item")}
      canSave={(p) =>
        !p.titleEn.trim() ? "A name dealers will see is needed"
          : !p.itemCode ? "Pick the item"
            : !(p.value > 0) ? (p.kind === "percent" ? "How many % off?" : "What is the promo price?")
              : p.kind === "percent" && p.value >= 100 ? "Under 100% off"
                : p.endsOn && p.endsOn < p.startsOn ? "It ends before it starts" : null}
      onSave={(p) => post("/api/sales/promotions", p)}
      onDelete={(p) => remove(`/api/sales/promotions?id=${p.id}`)}
      form={(p, set) => (
        <>
          <Field label="Name dealers see (English)" hint="Short — “Raya special”, “New: Silken tofu”.">
            <input className={inputCls} maxLength={80} value={p.titleEn} onChange={(e) => set({ ...p, titleEn: e.target.value })} />
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Name (BM) — optional"><input className={inputCls} maxLength={80} value={p.titleMs ?? ""} onChange={(e) => set({ ...p, titleMs: e.target.value || null })} /></Field>
            <Field label="Name (中文) — optional"><input className={inputCls} maxLength={80} value={p.titleZh ?? ""} onChange={(e) => set({ ...p, titleZh: e.target.value || null })} /></Field>
          </div>
          <Field label="Item">
            <Select searchable value={p.itemCode} placeholder="Choose the item…" onChange={(v) => set({ ...p, itemCode: v })}
              options={products.filter((x) => x.active).map((x) => ({ value: x.itemCode, label: x.description, note: x.itemCode }))} />
          </Field>
          <div className="grid gap-5 sm:grid-cols-3">
            <Field label="Kind">
              <Select value={p.kind} onChange={(v) => set({ ...p, kind: v as Promotion["kind"] })}
                options={[{ value: "price", label: "Promo price" }, { value: "percent", label: "% off their price" }]} />
            </Field>
            <Field label={p.kind === "price" ? "Price each (RM)" : "% off"}>
              <input className={`${inputCls} nums`} inputMode="decimal" value={p.value || ""} onChange={(e) => set({ ...p, value: Number(e.target.value) || 0 })} />
            </Field>
            <Field label="From quantity" hint="1 = any quantity.">
              <input className={`${inputCls} nums`} inputMode="numeric" value={p.minQty} onChange={(e) => set({ ...p, minQty: Math.max(1, Math.floor(Number(e.target.value) || 1)) })} />
            </Field>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="For">
              <Select value={p.customerCode ? "customer" : p.groupCode ? "group" : "all"}
                onChange={(v) => set({ ...p, customerCode: v === "customer" ? p.customerCode ?? "" : null, groupCode: v === "group" ? p.groupCode ?? "" : null })}
                options={[{ value: "all", label: "All dealers" }, { value: "group", label: "One group" }, { value: "customer", label: "One dealer" }]} />
            </Field>
            {p.customerCode !== null && (
              <Field label="Dealer">
                <Select searchable value={p.customerCode} placeholder="Choose a dealer…" onChange={(v) => set({ ...p, customerCode: v })}
                  options={customers.filter((c) => c.active).map((c) => ({ value: c.code, label: c.shortName || c.name, note: c.code }))} />
              </Field>
            )}
            {p.groupCode !== null && p.customerCode === null && (
              <Field label="Group">
                <Select value={p.groupCode} placeholder="Choose a group…" onChange={(v) => set({ ...p, groupCode: v })}
                  options={groups.map((g) => ({ value: g.code, label: g.name }))} />
              </Field>
            )}
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="From"><input type="date" className={`${inputCls} nums`} value={p.startsOn} onChange={(e) => set({ ...p, startsOn: e.target.value })} /></Field>
            <Field label="Until" hint="Empty: until switched off."><input type="date" className={`${inputCls} nums`} value={p.endsOn ?? ""} onChange={(e) => set({ ...p, endsOn: e.target.value || null })} /></Field>
          </div>
          <Field label="Switched on?">
            <div className="flex gap-2">
              {[true, false].map((v) => (
                <button key={String(v)} type="button" onClick={() => set({ ...p, active: v })}
                  className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${p.active === v ? "bg-accent text-white" : "border border-line bg-white text-mute"}`}>
                  {v ? "Yes" : "No"}
                </button>
              ))}
            </div>
          </Field>
        </>
      )}
    />
  );
}
