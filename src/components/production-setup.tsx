"use client";
// Production setup. Every item a dealer can order is either made here, bought in, or
// not a product. Made here: either a base product (with its line, batch size, buffer,
// shelf life and recipe) or a pack/carton of a base product ("1 carton = 180 tubes").
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Btn, Chip, Field, Notice, Select, inputCls } from "@/components/ui";
import { Tabs } from "@/components/tabs";
import { Column, RecordScreen } from "@/components/record-screen";
import { post } from "@/lib/api";
import type { ProdItem, ProdLine, RecipeLine } from "@/lib/production";
import type { ProdSettings } from "@/lib/store-production";

export type SetupRow = ProdItem & { description: string; group: string; uom: string; configured: boolean; recipe: RecipeLine[] };
type Opt = { value: string; label: string; note?: string; uom?: string };

const numOrNull = (v: string) => (v.trim() === "" ? null : Number(v) || null);

function supplied(r: SetupRow, nameOf: Map<string, string>) {
  if (r.mode === "buy") return <Chip tone="blue">Bought in</Chip>;
  if (r.mode === "none") return <Chip>Not a product</Chip>;
  if (r.makesItem) return <span className="text-mute">Pack: {r.unitsPer} × {nameOf.get(r.makesItem) ?? r.makesItem}</span>;
  return <Chip tone="teal">Made here</Chip>;
}

export function ProductionSetup({ rows, lines, settings, ingredients }: { rows: SetupRow[]; lines: ProdLine[]; settings: ProdSettings; ingredients: Opt[] }) {
  const notSetUp = rows.filter((r) => !r.configured && r.mode === "make").length;
  return (
    <Tabs
      tabs={[
        { id: "products", label: "Products", note: notSetUp ? `${notSetUp} to set up` : String(rows.length), tone: notSetUp ? "warn" : "plain", panel: <ProductsTab rows={rows} lines={lines} ingredients={ingredients} /> },
        { id: "lines", label: "Lines", note: String(lines.length), panel: <LinesTab lines={lines} /> },
        { id: "settings", label: "Cut-off", panel: <SettingsTab settings={settings} /> },
      ]}
    />
  );
}

function ProductsTab({ rows, lines, ingredients }: { rows: SetupRow[]; lines: ProdLine[]; ingredients: Opt[] }) {
  const nameOf = new Map(rows.map((r) => [r.itemCode, r.description]));
  const lineName = new Map(lines.map((l) => [l.code, l.name]));
  const bases = rows.filter((r) => r.mode === "make" && !r.makesItem);

  const columns: Column<SetupRow>[] = [
    { key: "p", head: "Product", cell: (r) => <div><div className="font-medium">{r.description}</div><div className="nums text-xs text-faint">{r.itemCode}{r.group ? ` · ${r.group}` : ""}</div></div> },
    { key: "s", head: "Supplied", cell: (r) => <div className="flex flex-wrap items-center gap-1">{supplied(r, nameOf)}{!r.configured && r.mode === "make" && <Chip tone="amber">not set up</Chip>}</div> },
    { key: "l", head: "Line", cell: (r) => <span className="text-mute">{r.mode === "make" && !r.makesItem ? (r.lineCode ? lineName.get(r.lineCode) ?? r.lineCode : "—") : ""}</span> },
    { key: "b", head: "Batch", num: true, cell: (r) => (r.mode === "make" && !r.makesItem && r.batchSize ? r.batchSize.toLocaleString("en-MY") : "") },
    { key: "f", head: "Buffer", num: true, cell: (r) => (r.mode === "make" && !r.makesItem && r.bufferPct ? `${r.bufferPct}%` : "") },
    { key: "e", head: "Shelf life", num: true, cell: (r) => (r.shelfLifeDays ? `${r.shelfLifeDays} d` : "") },
    { key: "r", head: "Recipe", num: true, cell: (r) => (r.recipe.length ? `${r.recipe.length} items` : "") },
  ];

  return (
    <RecordScreen<SetupRow>
      title="How each product is made"
      sub="Made here (with its line, batch, buffer, shelf life and recipe), a pack or carton of another product, or bought in. Packs and cartons count towards the product inside them."
      rows={rows}
      columns={columns}
      searchIn={(r) => `${r.itemCode} ${r.description} ${r.group}`}
      empty="No products yet."
      addLabel="Set up another item"
      filters={[{
        key: "kind", width: "w-[190px]",
        options: [
          { value: "all", label: "All" },
          { value: "todo", label: "Not set up yet", note: String(rows.filter((r) => !r.configured && r.mode === "make").length) },
          { value: "base", label: "Made here" },
          { value: "pack", label: "Packs & cartons" },
          { value: "buy", label: "Bought in" },
        ],
        match: (row, v) => {
          const r = row as SetupRow;
          return v === "todo" ? !r.configured && r.mode === "make" : v === "base" ? r.mode === "make" && !r.makesItem : v === "pack" ? r.mode === "make" && !!r.makesItem : r.mode === v;
        },
      }]}
      newRow={() => ({ itemCode: "", description: "", group: "", uom: "", configured: false, mode: "make", makesItem: null, unitsPer: 1, lineCode: null, batchSize: null, minRun: null, bufferPct: 0, shelfLifeDays: null, recipeYield: null, sort: 0, recipe: [] })}
      editTitle={(r, isNew) => (isNew ? "Set up an item" : r.description)}
      editSub={(r) => r.itemCode}
      canSave={(r) => (!r.itemCode ? "Pick the item" : r.mode === "make" && r.makesItem === r.itemCode ? "A pack cannot contain itself" : null)}
      onSave={(r) => post("/api/production/setup", { kind: "item", ...r })}
      form={(r, set) => (
        <>
          {!r.description && (
            <Field label="Item">
              <Select searchable value={r.itemCode} placeholder="Choose the item…" options={ingredients}
                onChange={(v) => set({ ...r, itemCode: v, description: ingredients.find((o) => o.value === v)?.label ?? v })} />
            </Field>
          )}
          <Field label="Supplied">
            <div className="flex flex-wrap gap-2">
              {([["make", "Made here"], ["buy", "Bought in"], ["none", "Not a product"]] as const).map(([v, label]) => (
                <button key={v} type="button" onClick={() => set({ ...r, mode: v })}
                  className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${r.mode === v ? "bg-accent text-white" : "border border-line bg-white text-mute"}`}>{label}</button>
              ))}
            </div>
          </Field>

          {r.mode === "make" && (
            <Field label="Is it a pack or carton of another product?" hint="E.g. a 3-pack of the 120 g tube, or a carton of 180. Orders for it count towards the product inside.">
              <div className="grid gap-2 sm:grid-cols-[1fr_120px]">
                <Select searchable value={r.makesItem ?? ""} placeholder="No — it is made as it is"
                  options={[{ value: "", label: "No — it is made as it is" }, ...bases.filter((b) => b.itemCode !== r.itemCode).map((b) => ({ value: b.itemCode, label: b.description, note: b.itemCode }))]}
                  onChange={(v) => set({ ...r, makesItem: v || null })} />
                {r.makesItem && (
                  <input className={`${inputCls} nums`} inputMode="decimal" placeholder="How many inside" value={r.unitsPer}
                    onChange={(e) => set({ ...r, unitsPer: Number(e.target.value) || 1 })} />
                )}
              </div>
            </Field>
          )}

          {r.mode === "make" && !r.makesItem && (
            <>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Production line">
                  <Select value={r.lineCode ?? ""} placeholder="Choose a line…"
                    options={[{ value: "", label: "No line" }, ...lines.filter((l) => l.active).map((l) => ({ value: l.code, label: l.name }))]}
                    onChange={(v) => set({ ...r, lineCode: v || null })} />
                </Field>
                <Field label="Order on the line" hint="Lower is made first — soft before firm, frying last.">
                  <input className={`${inputCls} nums`} inputMode="numeric" value={r.sort} onChange={(e) => set({ ...r, sort: Math.round(Number(e.target.value) || 0) })} />
                </Field>
              </div>
              <div className="grid gap-5 sm:grid-cols-3">
                <Field label={`Batch size (${r.uom.toLowerCase() || "units"})`} hint="One tank / mould / tray. Plans round up to whole batches.">
                  <input className={`${inputCls} nums`} inputMode="decimal" value={r.batchSize ?? ""} onChange={(e) => set({ ...r, batchSize: numOrNull(e.target.value) })} />
                </Field>
                <Field label="Minimum run" hint="Never less than this, when there is any order.">
                  <input className={`${inputCls} nums`} inputMode="decimal" value={r.minRun ?? ""} onChange={(e) => set({ ...r, minRun: numOrNull(e.target.value) })} />
                </Field>
                <Field label="Buffer %" hint="Extra for walk-ins, van stock, breakage.">
                  <input className={`${inputCls} nums`} inputMode="decimal" value={r.bufferPct || ""} onChange={(e) => set({ ...r, bufferPct: Number(e.target.value) || 0 })} />
                </Field>
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Shelf life (days)" hint="For the EXP date on each lot.">
                  <input className={`${inputCls} nums`} inputMode="numeric" value={r.shelfLifeDays ?? ""} onChange={(e) => set({ ...r, shelfLifeDays: numOrNull(e.target.value) })} />
                </Field>
                <Field label="One recipe makes" hint={`How many ${r.uom.toLowerCase() || "units"} the recipe below gives. Empty = one batch.`}>
                  <input className={`${inputCls} nums`} inputMode="decimal" value={r.recipeYield ?? ""} onChange={(e) => set({ ...r, recipeYield: numOrNull(e.target.value) })} />
                </Field>
              </div>
              <RecipeEditor recipe={r.recipe} options={ingredients} onChange={(recipe) => set({ ...r, recipe })} />
            </>
          )}
        </>
      )}
    />
  );
}

function RecipeEditor({ recipe, options, onChange }: { recipe: RecipeLine[]; options: Opt[]; onChange: (r: RecipeLine[]) => void }) {
  const upd = (i: number, patch: Partial<RecipeLine>) => onChange(recipe.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  // Raw materials first in the picker.
  const sorted = [...options].sort((a, b) => Number(!a.value.startsWith("RM")) - Number(!b.value.startsWith("RM")) || a.label.localeCompare(b.label));
  return (
    <div>
      <div className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-faint">Recipe — for one recipe</div>
      <div className="space-y-2">
        {recipe.map((x, i) => (
          <div key={i} className="rounded-xl border border-line p-3">
            <div className="flex items-start gap-2">
              <div className="flex-1">
                <Select searchable value={x.ingredient} placeholder="Ingredient…" options={sorted}
                  onChange={(v) => upd(i, { ingredient: v, uom: x.uom || options.find((o) => o.value === v)?.uom || "" })} />
              </div>
              <Btn kind="danger" size="sm" onClick={() => onChange(recipe.filter((_, j) => j !== i))}>✕</Btn>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input className={`${inputCls} nums w-28`} inputMode="decimal" placeholder="Qty" value={x.qty || ""} onChange={(e) => upd(i, { qty: Number(e.target.value) || 0 })} />
              <input className={`${inputCls} w-24`} placeholder="Unit" value={x.uom} onChange={(e) => upd(i, { uom: e.target.value })} />
              <label className="flex items-center gap-2 text-sm text-mute">
                <input type="checkbox" checked={x.prepBefore} onChange={(e) => upd(i, { prepBefore: e.target.checked })} />
                Before production (soak)
              </label>
            </div>
          </div>
        ))}
      </div>
      <Btn kind="ghost" size="sm" className="mt-2"
        onClick={() => onChange([...recipe, { itemCode: "", ingredient: "", qty: 0, uom: "", prepBefore: false, note: null, sort: recipe.length }])}>
        + Add an ingredient
      </Btn>
    </div>
  );
}

function LinesTab({ lines }: { lines: ProdLine[] }) {
  const columns: Column<ProdLine>[] = [
    { key: "c", head: "Code", cell: (l) => <span className="nums font-semibold">{l.code}</span> },
    { key: "n", head: "Line", cell: (l) => l.name },
    { key: "s", head: "Order", num: true, cell: (l) => l.sort },
    { key: "a", head: "Status", cell: (l) => (l.active ? <Chip tone="teal">In use</Chip> : <Chip>Off</Chip>) },
  ];
  return (
    <RecordScreen<ProdLine>
      title="Production lines"
      sub="Stations or rooms, in the order the night runs. The plan prints one sheet per line."
      rows={lines}
      columns={columns}
      searchIn={(l) => `${l.code} ${l.name}`}
      empty="No lines yet."
      addLabel="Add line"
      newRow={() => ({ code: "", name: "", sort: (lines.length + 1) * 10, active: true })}
      editTitle={(l, isNew) => (isNew ? "New line" : l.name)}
      canSave={(l) => (!l.code ? "A short code is needed" : !l.name ? "A name is needed" : null)}
      onSave={(l) => post("/api/production/setup", { kind: "line", ...l })}
      onDelete={(l) => post("/api/production/setup", { kind: "deleteLine", code: l.code })}
      form={(l, set) => (
        <>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Code" hint="Short — EGG, PUFF. Used in lot numbers.">
              <input className={inputCls} value={l.code} onChange={(e) => set({ ...l, code: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, "") })} />
            </Field>
            <Field label="Name"><input className={inputCls} value={l.name} onChange={(e) => set({ ...l, name: e.target.value })} /></Field>
          </div>
          <Field label="Order" hint="Lower runs first."><input className={`${inputCls} nums`} inputMode="numeric" value={l.sort} onChange={(e) => set({ ...l, sort: Math.round(Number(e.target.value) || 0) })} /></Field>
          <Field label="In use?">
            <div className="flex gap-2">
              {[true, false].map((v) => (
                <button key={String(v)} type="button" onClick={() => set({ ...l, active: v })}
                  className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${l.active === v ? "bg-accent text-white" : "border border-line bg-white text-mute"}`}>{v ? "Yes" : "No"}</button>
              ))}
            </div>
          </Field>
        </>
      )}
    />
  );
}

function SettingsTab({ settings }: { settings: ProdSettings }) {
  const router = useRouter();
  const [hour, setHour] = useState(settings.cutoffHour == null ? "" : String(settings.cutoffHour));
  const [pending, setPending] = useState(settings.includePending);
  const [msg, setMsg] = useState<{ tone: "good" | "bad"; text: string } | null>(null);
  async function save() {
    const r = await post("/api/production/setup", { kind: "settings", cutoffHour: hour === "" ? null : Number(hour), includePending: pending });
    setMsg(r.error ? { tone: "bad", text: r.error } : { tone: "good", text: "Saved." });
    if (!r.error) router.refresh();
  }
  return (
    <div className="max-w-xl space-y-5">
      <Field label="Order cut-off (hour, the day before delivery)" hint="Soybeans need about 4–6 hours to soak in Malaysian water, so the quantity must be fixed by mid-afternoon. Orders after this hour are flagged “late” on the plan. Empty = no cut-off.">
        <input className={`${inputCls} nums w-32`} inputMode="numeric" placeholder="15" value={hour} onChange={(e) => setHour(e.target.value.replace(/\D/g, "").slice(0, 2))} />
      </Field>
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" className="mt-1" checked={pending} onChange={(e) => setPending(e.target.checked)} />
        <span><span className="font-semibold">Count orders still waiting for confirmation</span><span className="block text-xs text-mute">Portal orders the office has not confirmed yet. Usually yes — beans have to be soaked before every order is checked.</span></span>
      </label>
      <Btn onClick={() => void save()}>Save</Btn>
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
    </div>
  );
}


