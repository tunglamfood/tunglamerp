"use client";
// Sales rep visits, newest first: who went where, how long they stayed, what came
// of it, the photos they took and where the phone said they were.
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Card, Chip, Drawer, Field, PageHeader, Select, Stat, inputCls } from "@/components/ui";
import type { Visit } from "@/lib/store-visits";

const OUTCOME: Record<string, { label: string; tone: "teal" | "gray" | "blue" | "amber" | "red" }> = {
  ordered: { label: "Took an order", tone: "teal" },
  no_order: { label: "No order", tone: "gray" },
  collected: { label: "Collected payment", tone: "blue" },
  follow_up: { label: "Follow up", tone: "amber" },
  closed: { label: "Shop closed", tone: "red" },
};
const time = (iso: string) => new Date(iso).toLocaleTimeString("en-MY", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kuala_Lumpur" });
const day = (iso: string) => new Date(iso).toLocaleDateString("en-MY", { weekday: "short", day: "numeric", month: "short", timeZone: "Asia/Kuala_Lumpur" });
const mapLink = (v: Visit) => (v.inLat != null && v.inLng != null ? `https://www.google.com/maps?q=${v.inLat},${v.inLng}` : null);

export function VisitsScreen({ visits, from, to }: { visits: Visit[]; from: string; to: string }) {
  const router = useRouter();
  const [rep, setRep] = useState("all");
  const [open, setOpen] = useState<Visit | null>(null);
  const reps = useMemo(() => [...new Map(visits.map((v) => [v.repCode, v.repName])).entries()], [visits]);
  const shown = visits.filter((v) => rep === "all" || v.repCode === rep);
  const done = shown.filter((v) => v.minutes != null);
  const avg = done.length ? Math.round(done.reduce((s, v) => s + (v.minutes ?? 0), 0) / done.length) : 0;
  const go = (f: string, t: string) => router.push(`/sales/visits?from=${f}&to=${t}`);

  return (
    <>
      <PageHeader
        title="Visits"
        sub="Reps check in at a dealer on the portal, add photos and a note, and check out. The location is the phone's, when the rep allows it."
      />
      <div className="mb-5 flex flex-wrap items-end gap-3">
        <Field label="From"><input type="date" className={`${inputCls} nums`} value={from} max={to} onChange={(e) => e.target.value && go(e.target.value, to)} /></Field>
        <Field label="To"><input type="date" className={`${inputCls} nums`} value={to} min={from} onChange={(e) => e.target.value && go(from, e.target.value)} /></Field>
        <div className="w-[200px]">
          <Field label="Rep">
            <Select value={rep} onChange={setRep} options={[{ value: "all", label: "All reps" }, ...reps.map(([code, name]) => ({ value: code, label: name }))]} />
          </Field>
        </div>
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <Stat label="Visits" value={String(shown.length)} sub={`${new Set(shown.map((v) => v.customerCode)).size} dealers`} />
        <Stat label="Took an order" value={String(shown.filter((v) => v.outcome === "ordered").length)} />
        <Stat label="Average stay" value={avg ? `${avg} min` : "—"} sub={shown.some((v) => !v.checkedOutAt) ? "someone is still checked in" : undefined} />
      </div>

      {shown.length === 0 ? (
        <Card className="px-6 py-14 text-center text-sm text-mute">No visits in these dates. Reps record them on the portal under Visits.</Card>
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="hidden md:table-header-group">
              <tr className="border-b border-line bg-gray-50/70 text-left text-[10px] font-bold uppercase tracking-[0.1em] text-faint">
                <th className="px-4 py-2.5">When</th><th className="px-4 py-2.5">Rep</th><th className="px-4 py-2.5">Dealer</th>
                <th className="px-4 py-2.5">Stayed</th><th className="px-4 py-2.5">Outcome</th><th className="px-4 py-2.5">Photos</th><th className="px-4 py-2.5">Where</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((v) => (
                <tr key={v.id} onClick={() => setOpen(v)} className="cursor-pointer border-b border-line last:border-0 hover:bg-accent-soft/40 max-md:grid max-md:grid-cols-2 max-md:gap-1 max-md:p-3">
                  <td className="nums px-4 py-3 text-mute max-md:col-span-2 max-md:p-0">{day(v.checkedInAt)} · {time(v.checkedInAt)}</td>
                  <td className="px-4 py-3 max-md:p-0">{v.repName}</td>
                  <td className="px-4 py-3 font-semibold max-md:p-0">{v.customerName}</td>
                  <td className="nums px-4 py-3 max-md:p-0">{v.minutes != null ? `${v.minutes} min` : <Chip tone="teal">Still there</Chip>}</td>
                  <td className="px-4 py-3 max-md:p-0">{v.outcome ? <Chip tone={OUTCOME[v.outcome]?.tone ?? "gray"}>{OUTCOME[v.outcome]?.label ?? v.outcome}</Chip> : <span className="text-faint">—</span>}</td>
                  <td className="nums px-4 py-3 text-mute max-md:p-0">{v.photos || "—"}</td>
                  <td className="px-4 py-3 max-md:p-0">
                    {mapLink(v) ? (
                      <a href={mapLink(v)!} target="_blank" rel="noopener" onClick={(e) => e.stopPropagation()} className="font-semibold text-accent underline underline-offset-2">Map</a>
                    ) : <span className="text-faint">Not shared</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {open && <VisitDrawer key={open.id} v={open} onClose={() => setOpen(null)} />}
    </>
  );
}

function VisitDrawer({ v, onClose }: { v: Visit; onClose: () => void }) {
  const [photos, setPhotos] = useState<string[] | null>(v.photos ? null : []);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!v.photos) return;
    let alive = true;
    fetch(`/api/sales/visits?id=${v.id}`)
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!alive) return;
        if (!r.ok) setError(j.error ?? "Could not open the photos.");
        else setPhotos(j.value?.photos ?? []);
      })
      .catch(() => alive && setError("Could not reach the system."));
    return () => { alive = false; };
  }, [v.id, v.photos]);

  return (
    <Drawer open title={`${v.customerName} · ${v.repName}`} sub={`${day(v.checkedInAt)}, ${time(v.checkedInAt)}${v.checkedOutAt ? ` – ${time(v.checkedOutAt)} (${v.minutes} min)` : " · still checked in"}`} onClose={onClose}>
      <div className="space-y-5">
        {v.outcome && <Chip tone={OUTCOME[v.outcome]?.tone ?? "gray"}>{OUTCOME[v.outcome]?.label ?? v.outcome}</Chip>}
        {v.note && <p className="whitespace-pre-wrap rounded-xl bg-gray-50 p-3.5 text-sm leading-relaxed">{v.note}</p>}
        {mapLink(v) ? (
          <a href={mapLink(v)!} target="_blank" rel="noopener" className="inline-block text-sm font-semibold text-accent underline underline-offset-2">
            Open the check-in location in Google Maps{v.inAccuracy ? ` (within ${v.inAccuracy} m)` : ""}
          </a>
        ) : <p className="text-sm text-mute">The rep did not share a location for this visit.</p>}
        {error && <p className="text-sm text-bad">{error}</p>}
        {photos === null && <p className="text-sm text-mute">Opening the photos…</p>}
        {photos && photos.length > 0 && (
          <div className="grid grid-cols-2 gap-2">
            {photos.map((src, i) => (
              <a key={i} href={src} target="_blank" rel="noopener" className="block overflow-hidden rounded-xl border border-line bg-gray-50">
                {/* eslint-disable-next-line @next/next/no-img-element -- private, short-lived links */}
                <img src={src} alt={`Visit photo ${i + 1}`} className="aspect-square w-full object-cover" />
              </a>
            ))}
          </div>
        )}
      </div>
    </Drawer>
  );
}
