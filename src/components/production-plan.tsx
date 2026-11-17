"use client";
// The daily production plan. Draft: numbers follow the orders as they come in;
// stock carried over and manual top-ups can be entered. Locked: the factory works to
// these numbers, and later orders show as a difference. After production: what was
// really made, waste, lot number and expiry, per product.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useMemo, useState } from "react";
import { Btn, Card, Chip, Notice, PageHeader, Stat, inputCls } from "@/components/ui";
import type { Plan, PlanRow } from "@/lib/production";
import type { SavedPlan } from "@/lib/store-production";

/** A small number box (the shared input class is full width). */
const numBox = "nums rounded-lg border border-line bg-white px-2 py-1.5 text-right text-sm transition focus:border-accent";

const fmt = (n: number) => n.toLocaleString("en-MY", { maximumFractionDigits: 2 });
const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86400_000).toISOString().slice(0, 10);
const longDay = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-MY", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const when = (iso: string) => new Date(iso).toLocaleString("en-MY", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kuala_Lumpur" });

async function send(body: Record<string, unknown>): Promise<string | null> {
  try {
    const res = await fetch("/api/production/plan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (res.ok) return null;
    const j = await res.json().catch(() => ({}));
    return j.error ?? "That did not save.";
  } catch {
    return "Could not reach the system. Check your internet and try again.";
  }
}

export function ProductionPlanScreen({
  delivery, today, plan, saved, lineOrder, lineNames, shelfLife, includePending, cutoffHour, notes,
}: {
  delivery: string;
  today: string;
  plan: Plan;
  saved: SavedPlan | null;
  lineOrder: string[];
  lineNames: Record<string, string>;
  shelfLife: Record<string, number | null>;
  includePending: boolean;
  cutoffHour: number | null;
  notes: string[];
}) {
  const router = useRouter();
  const status = saved?.status ?? "draft";
  const draft = status === "draft";
  const locked = new Map((saved?.lines ?? []).map((l) => [l.itemCode, l]));
  const [edits, setEdits] = useState<Record<string, { stockQty: number; extraQty: number }>>({});
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const go = (date: string, pending = includePending) => router.push(`/production/plan?date=${date}&pending=${pending ? 1 : 0}`);
  async function act(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    const e = await send({ delivery, ...body });
    setBusy(false);
    if (e) setError(e);
    else {
      setEdits({});
      router.refresh();
    }
  }

  const groups = useMemo(() => {
    const by = new Map<string, PlanRow[]>();
    for (const r of plan.rows) {
      const k = r.lineCode ?? "";
      by.set(k, [...(by.get(k) ?? []), r]);
    }
    return [...by.entries()].sort((a, b) => (lineOrder.indexOf(a[0]) + 1 || 999) - (lineOrder.indexOf(b[0]) + 1 || 999));
  }, [plan.rows, lineOrder]);

  const batches = plan.rows.reduce((s, r) => s + (r.batches ?? 0), 0);
  const notSetUp = plan.rows.filter((r) => r.notSetUp);
  const changedSinceLock = !draft ? plan.rows.filter((r) => (locked.get(r.itemCode)?.planQty ?? 0) !== r.plan) : [];
  const dirty = Object.keys(edits).length > 0;

  return (
    <>
      <PageHeader
        title="Production plan"
        sub={<>For delivery on <strong>{longDay(delivery)}</strong>{delivery === addDays(today, 1) ? " (tomorrow)" : delivery === today ? " (today)" : ""} · made the night before</>}
        right={
          <div className="no-print flex flex-wrap items-center gap-2">
            <Btn kind="ghost" size="sm" onClick={() => go(addDays(delivery, -1))}>← Day before</Btn>
            <input type="date" className={`${inputCls} nums w-[150px]`} value={delivery} onChange={(e) => e.target.value && go(e.target.value)} />
            <Btn kind="ghost" size="sm" onClick={() => go(addDays(delivery, 1))}>Next day →</Btn>
            <Btn kind="ghost" size="sm" onClick={() => window.print()}>Print</Btn>
          </div>
        }
      />

      {notes.map((n) => <div key={n} className="mb-3"><Notice tone="info">{n}</Notice></div>)}
      {error && <div className="mb-3"><Notice tone="bad">{error}</Notice></div>}

      {/* Where the plan stands */}
      <Card className={`no-print mb-5 flex flex-wrap items-center gap-3 p-4 ${draft ? "" : status === "done" ? "border-good/30 bg-good-soft/40" : "border-accent-line bg-accent-soft/40"}`}>
        <div className="min-w-0 flex-1 text-sm">
          {draft && <><strong>Draft.</strong> Numbers follow the orders as they arrive{cutoffHour != null ? ` — the cut-off is ${cutoffHour}:00 the day before` : ""}. Lock the plan when you start soaking, so the factory works to fixed numbers.</>}
          {status === "locked" && <><strong>Locked</strong> {saved?.lockedAt ? `${when(saved.lockedAt)}` : ""}{saved?.lockedBy ? ` by ${saved.lockedBy}` : ""}. The factory works to these numbers.{changedSinceLock.length > 0 && <span className="font-semibold text-warn"> Orders changed since: {changedSinceLock.length} product{changedSinceLock.length === 1 ? "" : "s"} now differ (shown in amber).</span>}</>}
          {status === "done" && <><strong>Done.</strong> Production for this day is recorded.</>}
        </div>
        <label className="flex items-center gap-2 text-sm text-mute">
          <input type="checkbox" checked={includePending} disabled={!draft} onChange={(e) => go(delivery, e.target.checked)} />
          Count orders still waiting for confirmation
        </label>
        {draft && dirty && <Btn kind="ghost" onClick={() => void act({ action: "overrides", overrides: edits })} disabled={busy}>Save stock & extras</Btn>}
        {draft && <Btn onClick={() => void act({ action: "lock", includePending })} disabled={busy || dirty || plan.rows.length === 0} title={dirty ? "Save your changes first" : undefined}>Lock plan</Btn>}
        {status === "locked" && <><Btn kind="ghost" onClick={() => void act({ action: "unlock" })} disabled={busy}>Unlock</Btn><Btn onClick={() => void act({ action: "done" })} disabled={busy}>Mark production done</Btn></>}
        {status === "done" && <Btn kind="ghost" onClick={() => void act({ action: "reopen" })} disabled={busy}>Reopen</Btn>}
      </Card>

      <div className="mb-5 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Orders" value={String(plan.orders)} sub={`${plan.dealers} dealers`} />
        <Stat label="Products to make" value={String(plan.rows.filter((r) => r.plan > 0).length)} />
        <Stat label="Batches" value={fmt(batches)} />
        <Stat label="Waiting confirmation" value={String(plan.pending)} sub={includePending ? "counted" : "not counted"} tone={plan.pending ? "text-warn" : ""} />
        <Stat label="After cut-off" value={String(plan.late)} tone={plan.late ? "text-warn" : ""} />
        <Stat label="No delivery date" value={String(plan.noDate)} sub="counted for the next day" />
      </div>

      {notSetUp.length > 0 && (
        <div className="no-print mb-5">
          <Notice tone="warn">
            {notSetUp.length} product{notSetUp.length === 1 ? " is" : "s are"} made here but not set up yet ({notSetUp.slice(0, 4).map((r) => r.itemCode).join(", ")}{notSetUp.length > 4 ? "…" : ""}) — counted as themselves, with no line, batch size or recipe.{" "}
            <Link href="/production/setup" className="underline underline-offset-2">Set them up</Link>
          </Notice>
        </div>
      )}

      {plan.rows.length === 0 && (
        <Card className="px-6 py-14 text-center text-sm text-mute">No orders for this delivery day yet{includePending ? "" : " (only confirmed orders are counted)"}.</Card>
      )}

      {/* One card per production line, in the order the factory runs them */}
      <div className="space-y-5">
        {groups.map(([code, rows]) => (
          <Card key={code || "none"} className="overflow-hidden print:break-inside-avoid">
            <div className="flex items-baseline justify-between border-b border-line px-5 py-3">
              <h2 className="text-base font-bold tracking-tight">{code ? lineNames[code] ?? code : "Not on a line yet"}</h2>
              <span className="text-xs text-mute">{rows.reduce((s, r) => s + (r.batches ?? 0), 0) || "—"} batches</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[10px] font-bold uppercase tracking-[0.1em] text-faint">
                    <th className="px-5 py-2">Product</th>
                    <th className="px-3 py-2 text-right">Ordered</th>
                    <th className="px-3 py-2 text-right">+ Buffer</th>
                    <th className="px-3 py-2 text-right">+ Extra</th>
                    <th className="px-3 py-2 text-right">− Stock</th>
                    <th className="px-3 py-2 text-right">To make</th>
                    <th className="px-3 py-2 text-right">Batches</th>
                    {!draft && <th className="no-print px-5 py-2">Made · lot</th>}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const lk = locked.get(r.itemCode);
                    const e = edits[r.itemCode];
                    const shownPlan = draft ? r.plan : lk?.planQty ?? r.plan;
                    const differs = !draft && lk && lk.planQty !== r.plan;
                    return (
                      <Fragment key={r.itemCode}>
                        <tr className="border-t border-line align-top">
                          <td className="px-5 py-2.5">
                            <button type="button" onClick={() => setOpen(open === r.itemCode ? null : r.itemCode)} className="text-left">
                              <div className="font-semibold">{r.description}</div>
                              <div className="nums text-xs text-faint">{r.itemCode} · {r.sources.length} order line{r.sources.length === 1 ? "" : "s"} <span className="no-print text-accent">{open === r.itemCode ? "▲" : "▼"}</span></div>
                            </button>
                          </td>
                          <td className="nums px-3 py-2.5 text-right">{fmt(r.ordered)}</td>
                          <td className="nums px-3 py-2.5 text-right text-mute">{r.buffer ? fmt(r.buffer) : "—"}</td>
                          <td className="px-3 py-2.5 text-right">
                            {draft ? (
                              <input className={`${numBox} w-20`} inputMode="numeric" value={e?.extraQty ?? r.extra}
                                onChange={(ev) => setEdits({ ...edits, [r.itemCode]: { stockQty: e?.stockQty ?? r.stock, extraQty: Math.max(0, Number(ev.target.value) || 0) } })} />
                            ) : <span className="nums text-mute">{r.extra ? fmt(r.extra) : "—"}</span>}
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            {draft ? (
                              <input className={`${numBox} w-20`} inputMode="numeric" value={e?.stockQty ?? r.stock}
                                onChange={(ev) => setEdits({ ...edits, [r.itemCode]: { extraQty: e?.extraQty ?? r.extra, stockQty: Math.max(0, Number(ev.target.value) || 0) } })} />
                            ) : <span className="nums text-mute">{r.stock ? fmt(r.stock) : "—"}</span>}
                          </td>
                          <td className="nums px-3 py-2.5 text-right text-base font-extrabold">
                            {fmt(shownPlan)}
                            {differs && <div className="text-xs font-semibold text-warn">orders now: {fmt(r.plan)}</div>}
                          </td>
                          <td className="nums px-3 py-2.5 text-right">{(draft ? r.batches : lk?.batches ?? r.batches) ?? "—"}</td>
                          {!draft && (
                            <td className="no-print px-5 py-2.5">
                              <OutputCell delivery={delivery} itemCode={r.itemCode} lineCode={r.lineCode} rec={lk} shelfLife={shelfLife[r.itemCode] ?? null} onSaved={() => router.refresh()} />
                            </td>
                          )}
                        </tr>
                        {open === r.itemCode && (
                          <tr className="no-print bg-gray-50/70">
                            <td colSpan={draft ? 7 : 8} className="px-5 py-3">
                              <div className="flex flex-wrap gap-1.5">
                                {r.sources.map((s, i) => (
                                  <span key={i} className="inline-flex items-center gap-1 rounded-lg border border-line bg-white px-2 py-1 text-xs">
                                    <span className="font-medium">{s.customer}</span>
                                    <span className="nums text-mute">{fmt(s.qty)}</span>
                                    <span className="nums text-faint">{s.orderNo}</span>
                                    {s.pending && <Chip tone="amber">waiting</Chip>}
                                    {s.late && <Chip tone="red">late</Chip>}
                                  </span>
                                ))}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        ))}
      </div>

      {/* Prep and raw materials */}
      {plan.ingredients.length > 0 && (
        <Card className="mt-5 overflow-hidden print:break-inside-avoid">
          <div className="border-b border-line px-5 py-3">
            <h2 className="text-base font-bold tracking-tight">Prep & raw materials</h2>
            <p className="text-xs text-mute">From the recipes, for the quantities to make. “Before production” items (soaking the soybeans) come first — in Malaysian water, beans need about 4–6 hours.</p>
          </div>
          <table className="w-full text-sm">
            <tbody>
              {plan.ingredients.map((i) => (
                <tr key={`${i.ingredient}|${i.uom}|${i.prepBefore}`} className="border-t border-line first:border-0">
                  <td className="px-5 py-2.5">
                    <div className="font-medium">{i.description} {i.prepBefore && <Chip tone="blue">before production</Chip>}</div>
                    <div className="nums text-xs text-faint">{i.ingredient} · for {i.forItems.join(", ")}</div>
                  </td>
                  <td className="nums px-5 py-2.5 text-right text-base font-bold">{fmt(i.qty)} <span className="text-sm font-medium text-mute">{i.uom}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* Bought-in goods: picked from stock, not produced */}
      {plan.bought.length > 0 && (
        <Card className="mt-5 overflow-hidden print:break-inside-avoid">
          <div className="border-b border-line px-5 py-3">
            <h2 className="text-base font-bold tracking-tight">Bought-in goods for this day</h2>
            <p className="text-xs text-mute">Not produced — make sure there is enough in stock for packing.</p>
          </div>
          <table className="w-full text-sm">
            <tbody>
              {plan.bought.map((b) => (
                <tr key={b.itemCode} className="border-t border-line first:border-0">
                  <td className="px-5 py-2.5"><div className="font-medium">{b.description}</div><div className="nums text-xs text-faint">{b.itemCode} · {b.sources.length} order line{b.sources.length === 1 ? "" : "s"}</div></td>
                  <td className="nums px-5 py-2.5 text-right font-bold">{fmt(b.qty)} <span className="text-sm font-medium text-mute">{b.uom.toLowerCase()}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}

/** After locking: record what was really made; the lot number and expiry fill themselves in. */
function OutputCell({
  delivery, itemCode, lineCode, rec, shelfLife, onSaved,
}: {
  delivery: string;
  itemCode: string;
  lineCode: string | null;
  rec: SavedPlan["lines"][number] | undefined;
  shelfLife: number | null;
  onSaved: () => void;
}) {
  const madeOn = addDays(delivery, -1);
  const [actual, setActual] = useState(rec?.actualQty != null ? String(rec.actualQty) : "");
  const [waste, setWaste] = useState(rec?.wasteQty != null ? String(rec.wasteQty) : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const saved = rec?.actualQty != null;

  async function save() {
    setBusy(true);
    setError(null);
    const e = await send({
      action: "output", delivery, itemCode,
      actualQty: actual === "" ? null : Number(actual), wasteQty: waste === "" ? null : Number(waste),
      producedOn: rec?.producedOn ?? madeOn, lotNo: rec?.lotNo ?? null, expiryDate: rec?.expiryDate ?? null,
    });
    setBusy(false);
    if (e) setError(e);
    else onSaved();
  }

  return (
    <div className="flex min-w-[230px] flex-wrap items-center gap-2">
      <input className={`${numBox} w-20`} inputMode="numeric" placeholder="Made" value={actual} onChange={(e) => setActual(e.target.value.replace(/[^\d.]/g, ""))} />
      <input className={`${numBox} w-16`} inputMode="numeric" placeholder="Waste" value={waste} onChange={(e) => setWaste(e.target.value.replace(/[^\d.]/g, ""))} />
      <Btn size="sm" kind={saved ? "ghost" : "primary"} onClick={() => void save()} disabled={busy || actual === ""}>{busy ? "…" : saved ? "Update" : "Save"}</Btn>
      {saved && (
        <div className="w-full text-[11px] leading-tight text-mute">
          Lot <span className="nums font-semibold text-ink">{rec?.lotNo ?? `${madeOn.slice(2).replace(/-/g, "")}-${lineCode ?? "X"}-${itemCode}`}</span>
          {rec?.expiryDate ? <> · EXP <span className="nums font-semibold text-ink">{rec.expiryDate}</span></> : shelfLife == null ? " · set the shelf life for an expiry date" : ""}
        </div>
      )}
      {error && <div className="w-full text-xs text-bad">{error}</div>}
    </div>
  );
}
