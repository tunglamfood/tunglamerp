"use client";
// Routes: one per lorry run. Its dealers in stop order (move them up and down); a
// dealer is on one route at a time, so adding them here takes them off any other.
import { useState } from "react";
import { Btn, Chip, Field, inputCls } from "@/components/ui";
import { Column, RecordScreen } from "@/components/record-screen";
import { post } from "@/lib/api";
import type { Route } from "@/lib/packing";

type Row = Route & { customerCodes: string[] };
type Dealer = { code: string; name: string; state: string; routeCode: string | null };

function StopPicker({ value, dealers, routeCode, onChange }: { value: string[]; dealers: Dealer[]; routeCode: string; onChange: (v: string[]) => void }) {
  const [q, setQ] = useState("");
  const nameOf = new Map(dealers.map((d) => [d.code, d]));
  const needle = q.trim().toLowerCase();
  const chosen = new Set(value);
  const options = dealers
    .filter((d) => !chosen.has(d.code))
    .filter((d) => !needle || `${d.code} ${d.name} ${d.state}`.toLowerCase().includes(needle))
    .slice(0, 60);
  const move = (i: number, by: -1 | 1) => {
    const next = [...value];
    const j = i + by;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  return (
    <div className="space-y-3">
      <ol className="space-y-1">
        {value.map((code, i) => (
          <li key={code} className="flex items-center gap-2 rounded-xl border border-line px-3 py-1.5 text-sm">
            <span className="nums w-6 text-right font-bold text-accent">{i + 1}</span>
            <span className="min-w-0 flex-1 truncate">{nameOf.get(code)?.name ?? code} <span className="nums text-xs text-faint">{code}</span></span>
            <Btn kind="ghost" size="sm" onClick={() => move(i, -1)} disabled={i === 0}>↑</Btn>
            <Btn kind="ghost" size="sm" onClick={() => move(i, 1)} disabled={i === value.length - 1}>↓</Btn>
            <Btn kind="danger" size="sm" onClick={() => onChange(value.filter((c) => c !== code))}>✕</Btn>
          </li>
        ))}
        {value.length === 0 && <li className="text-sm text-mute">No stops yet — add dealers below.</li>}
      </ol>
      <input className={inputCls} placeholder="Find a dealer to add — name, code or state…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="max-h-60 overflow-y-auto rounded-xl border border-line">
        {options.map((d) => (
          <button key={d.code} type="button" onClick={() => onChange([...value, d.code])}
            className="flex w-full items-center gap-3 border-b border-line px-3 py-2 text-left text-sm last:border-0 hover:bg-gray-50">
            <span className="flex-1">{d.name}</span>
            {d.routeCode && d.routeCode !== routeCode && <Chip tone="amber">on {d.routeCode}</Chip>}
            <span className="nums text-xs text-faint">{d.code} · {d.state || "—"}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function RoutesScreen({ routes, dealers }: { routes: Row[]; dealers: Dealer[] }) {
  const unassigned = dealers.filter((d) => !d.routeCode).length;
  const columns: Column<Row>[] = [
    { key: "n", head: "Route", cell: (r) => <div><div className="font-semibold">{r.name}</div><div className="nums text-xs text-faint">{r.code}</div></div> },
    { key: "d", head: "Driver · lorry", cell: (r) => <span className="text-mute">{[r.driver, r.lorry].filter(Boolean).join(" · ") || "—"}</span> },
    { key: "s", head: "Stops", num: true, cell: (r) => r.customerCodes.length },
    { key: "a", head: "Status", cell: (r) => (r.active ? <Chip tone="teal">Running</Chip> : <Chip>Off</Chip>) },
  ];
  return (
    <RecordScreen<Row>
      title="Delivery routes"
      sub={`One per lorry run, with its dealers in stop order. Packing prints one trip sheet per route.${unassigned ? ` ${unassigned} dealers are not on a route yet.` : ""}`}
      rows={routes}
      columns={columns}
      searchIn={(r) => `${r.code} ${r.name} ${r.driver ?? ""} ${r.lorry ?? ""}`}
      empty="No routes yet. Add one for each lorry run — Ipoh town, Kampar–Tapah, Klang Valley…"
      addLabel="Add route"
      newRow={() => ({ code: "", name: "", driver: null, lorry: null, sort: (routes.length + 1) * 10, active: true, customerCodes: [] })}
      editTitle={(r, isNew) => (isNew ? "New route" : r.name)}
      editSub={(r) => `${r.customerCodes.length} stops`}
      canSave={(r) => (!r.code ? "A short code is needed" : !r.name ? "A name is needed" : null)}
      onSave={(r) => post("/api/production/packing", { action: "route", ...r })}
      onDelete={(r) => post("/api/production/packing", { action: "deleteRoute", code: r.code })}
      form={(r, set) => (
        <>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Code" hint="Short — IPOH1, KL.">
              <input className={inputCls} value={r.code} onChange={(e) => set({ ...r, code: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, "") })} />
            </Field>
            <Field label="Name"><input className={inputCls} value={r.name} placeholder="Ipoh town" onChange={(e) => set({ ...r, name: e.target.value })} /></Field>
          </div>
          <div className="grid gap-5 sm:grid-cols-3">
            <Field label="Driver"><input className={inputCls} value={r.driver ?? ""} onChange={(e) => set({ ...r, driver: e.target.value || null })} /></Field>
            <Field label="Lorry"><input className={inputCls} value={r.lorry ?? ""} placeholder="AKB 1234" onChange={(e) => set({ ...r, lorry: e.target.value || null })} /></Field>
            <Field label="Order" hint="Lower first."><input className={`${inputCls} nums`} inputMode="numeric" value={r.sort} onChange={(e) => set({ ...r, sort: Math.round(Number(e.target.value) || 0) })} /></Field>
          </div>
          <Field label="Stops, in delivery order">
            <StopPicker value={r.customerCodes} dealers={dealers} routeCode={r.code} onChange={(customerCodes) => set({ ...r, customerCodes })} />
          </Field>
          <Field label="Running?">
            <div className="flex gap-2">
              {[true, false].map((v) => (
                <button key={String(v)} type="button" onClick={() => set({ ...r, active: v })}
                  className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${r.active === v ? "bg-accent text-white" : "border border-line bg-white text-mute"}`}>{v ? "Yes" : "No"}</button>
              ))}
            </div>
          </Field>
        </>
      )}
    />
  );
}
