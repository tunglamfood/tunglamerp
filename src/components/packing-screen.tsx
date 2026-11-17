"use client";
// Packing & delivery for one day. One card per route (lorry): its stops in order, what
// to pack for each dealer in the units they ordered, a tick when packed, and what the
// lorry carries in all. Prints one trip sheet per route. After the trip, mark the
// route delivered.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Btn, Card, Chip, Notice, PageHeader, Stat } from "@/components/ui";
import type { RouteDay } from "@/lib/packing";

const fmt = (n: number) => n.toLocaleString("en-MY", { maximumFractionDigits: 2 });
const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86400_000).toISOString().slice(0, 10);
const longDay = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-MY", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

async function send(body: Record<string, unknown>): Promise<{ error?: string; value?: { delivered?: number } }> {
  try {
    const res = await fetch("/api/production/packing", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await res.json().catch(() => ({}));
    return res.ok ? { value: j.value } : { error: j.error ?? "That did not save." };
  } catch {
    return { error: "Could not reach the system. Check your internet and try again." };
  }
}

export function PackingScreen({
  delivery, today, day, includePending, hasRoutes,
}: {
  delivery: string;
  today: string;
  day: { routes: RouteDay[]; orders: number; packed: number; dealers: number };
  includePending: boolean;
  hasRoutes: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loadOpen, setLoadOpen] = useState<string | null>(null);
  // Ticks show at once; the server catches up behind them.
  const [packedNow, setPackedNow] = useState<Record<number, boolean>>({});
  const isPacked = (id: number, saved: boolean) => packedNow[id] ?? saved;
  const go = (date: string, pending = includePending) => router.push(`/production/packing?date=${date}&pending=${pending ? 1 : 0}`);

  async function act(body: Record<string, unknown>, done?: (v?: { delivered?: number }) => void) {
    setBusy(true);
    setError(null);
    const r = await send(body);
    setBusy(false);
    if (r.error) return setError(r.error);
    done?.(r.value);
    router.refresh();
  }

  return (
    <>
      <PageHeader
        title="Packing & delivery"
        sub={<>For delivery on <strong>{longDay(delivery)}</strong>{delivery === addDays(today, 1) ? " (tomorrow)" : delivery === today ? " (today)" : ""} · in the units each dealer ordered</>}
        right={
          <div className="no-print flex flex-wrap items-center gap-2">
            <Btn kind="ghost" size="sm" onClick={() => go(addDays(delivery, -1))}>← Day before</Btn>
            <input type="date" className="nums w-[150px] rounded-xl border border-line bg-white px-3 py-2 text-sm transition focus:border-accent" value={delivery} onChange={(e) => e.target.value && go(e.target.value)} />
            <Btn kind="ghost" size="sm" onClick={() => go(addDays(delivery, 1))}>Next day →</Btn>
            <Btn kind="ghost" size="sm" onClick={() => window.print()}>Print trip sheets</Btn>
          </div>
        }
      />
      {error && <div className="mb-3"><Notice tone="bad">{error}</Notice></div>}
      {notice && <div className="mb-3"><Notice tone="good">{notice}</Notice></div>}
      {!hasRoutes && (
        <div className="no-print mb-4"><Notice tone="info">No routes yet — everything is under “No route yet”. <Link href="/production/routes" className="underline underline-offset-2">Set up routes (lorries) and their dealers</Link> to get one trip sheet per lorry.</Notice></div>
      )}

      <div className="no-print mb-5 grid gap-3 sm:grid-cols-4">
        <Stat label="Orders" value={String(day.orders)} sub={`${day.dealers} stops`} />
        <Stat label="Packed" value={`${day.packed} / ${day.orders}`} tone={day.orders && day.packed === day.orders ? "text-good" : ""} />
        <Stat label="Routes" value={String(day.routes.filter((r) => r.code).length)} />
        <Card className="flex items-center p-4">
          <label className="flex items-center gap-2 text-sm text-mute">
            <input type="checkbox" checked={includePending} onChange={(e) => go(delivery, e.target.checked)} />
            Include orders still waiting for confirmation
          </label>
        </Card>
      </div>

      {day.routes.length === 0 && <Card className="px-6 py-14 text-center text-sm text-mute">Nothing to deliver on this day.</Card>}

      <div className="space-y-6">
        {day.routes.map((r) => {
          const ids = r.stops.flatMap((s) => s.orders.map((o) => o.id));
          const confirmedIds = r.stops.flatMap((s) => s.orders.filter((o) => o.status === "confirmed").map((o) => o.id));
          const key = r.code ?? "none";
          return (
            <Card key={key} className="overflow-hidden print:break-before-page print:border-0">
              <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-3.5">
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg font-extrabold tracking-tight">{r.name}</h2>
                  <p className="text-sm text-mute">
                    {[r.driver && `Driver ${r.driver}`, r.lorry && `Lorry ${r.lorry}`, `${r.stops.length} stop${r.stops.length === 1 ? "" : "s"}`, `${r.packed}/${r.orders} packed`].filter(Boolean).join(" · ")}
                    <span className="hidden print:inline"> · {longDay(delivery)}</span>
                  </p>
                </div>
                <div className="no-print flex flex-wrap gap-2">
                  <Btn kind="ghost" size="sm" onClick={() => setLoadOpen(loadOpen === key ? null : key)}>{loadOpen === key ? "Hide" : "Show"} lorry load</Btn>
                  {r.packed < r.orders && <Btn kind="ghost" size="sm" disabled={busy} onClick={() => { setPackedNow((m) => ({ ...m, ...Object.fromEntries(ids.map((id) => [id, true])) })); void act({ action: "packed", orderIds: ids, packed: true }); }}>Mark all packed</Btn>}
                  {confirmedIds.length > 0 && (
                    <Btn size="sm" disabled={busy} onClick={() => {
                      if (!window.confirm(`Mark ${confirmedIds.length} confirmed order(s) on ${r.name} as delivered?`)) return;
                      void act({ action: "delivered", orderIds: confirmedIds }, (v) => setNotice(`${v?.delivered ?? 0} order(s) on ${r.name} marked delivered.`));
                    }}>Mark route delivered</Btn>
                  )}
                </div>
              </div>

              {/* What the lorry carries: always on paper, on screen when asked */}
              <div className={`${loadOpen === key ? "" : "hidden"} border-b border-line bg-gray-50/60 px-5 py-3 print:block`}>
                <div className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-faint">Lorry load</div>
                <div className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2 lg:grid-cols-3">
                  {r.load.map((l) => (
                    <div key={`${l.itemCode}|${l.uom}`} className="flex justify-between gap-3">
                      <span className="truncate">{l.description}</span>
                      <span className="nums shrink-0 font-semibold">{fmt(l.qty)} {l.uom.toLowerCase()}</span>
                    </div>
                  ))}
                </div>
              </div>

              <ol className="divide-y divide-line">
                {r.stops.map((s, i) => (
                  <li key={s.customerCode} className="px-5 py-4 print:break-inside-avoid">
                    <div className="flex flex-wrap items-start gap-3">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold text-white">{i + 1}</span>
                      <div className="min-w-0 flex-1">
                        <div className="font-bold">{s.name} <span className="nums text-xs font-normal text-faint">{s.customerCode}</span></div>
                        <div className="text-xs text-mute">{[s.address?.replace(/\s*[\r\n]+\s*/g, ", "), s.contact].filter(Boolean).join(" · ")}</div>
                        {s.terms && <div className="text-xs text-mute">Terms: {s.terms}</div>}
                      </div>
                    </div>
                    <div className="mt-2.5 space-y-2 sm:pl-10">
                      {s.orders.map((o) => (
                        <div key={`${o.id}-${s.customerCode}`} className={`rounded-xl border p-3 ${isPacked(o.id, o.packed) ? "border-good/30 bg-good-soft/30" : "border-line"}`}>
                          <div className="mb-1.5 flex flex-wrap items-center gap-2 text-xs">
                            <span className="nums font-semibold">{o.orderNo}</span>
                            {o.theirRef && <span className="text-mute">PO {o.theirRef}</span>}
                            {o.status !== "confirmed" && <Chip tone={o.status === "delivered" ? "teal" : "amber"}>{o.status === "delivered" ? "delivered" : "waiting confirmation"}</Chip>}
                            <label className="no-print ml-auto flex cursor-pointer items-center gap-1.5 font-semibold">
                              <input type="checkbox" checked={isPacked(o.id, o.packed)}
                                onChange={(e) => { const v = e.target.checked; setPackedNow((m) => ({ ...m, [o.id]: v })); void act({ action: "packed", orderIds: [o.id], packed: v }); }} />
                              Packed
                            </label>
                            <span className="hidden print:inline">☐ packed ☐ delivered</span>
                          </div>
                          <table className="w-full text-sm">
                            <tbody>
                              {o.lines.map((l) => (
                                <tr key={`${l.itemCode}|${l.uom}`}>
                                  <td className="py-0.5">{l.description} <span className="nums text-xs text-faint">{l.itemCode}</span></td>
                                  <td className="nums py-0.5 text-right font-bold">{fmt(l.qty)} <span className="font-medium text-mute">{l.uom.toLowerCase()}</span></td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {o.note && <p className="mt-1.5 text-xs text-mute">Note: {o.note}</p>}
                        </div>
                      ))}
                    </div>
                  </li>
                ))}
              </ol>
              <div className="hidden px-5 py-4 text-sm print:block">Driver signature: ____________________ &nbsp; Time out: ________ &nbsp; Time back: ________</div>
            </Card>
          );
        })}
      </div>
    </>
  );
}
