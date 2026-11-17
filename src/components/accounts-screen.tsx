"use client";
// Accounts & stock: import AutoCount's outstanding invoices and stock balance, then
// see who owes what and for how long. Dealers see their own statement on the portal;
// reps see it for their dealers; the portal marks items that are out of stock.
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Btn, Card, Drawer, Notice, PageHeader, Stat } from "@/components/ui";
import type { AgingRow } from "@/lib/ar-import";
import type { ImportInfo, Invoice } from "@/lib/store-ar";

const money = (n: number) => n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const rm = (n: number) => (n ? money(n) : "—");
const day = (iso: string) => new Date(`${iso}T00:00:00+08:00`).toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" });

type Result = { imported: number; skipped: { line: number; reason: string }[]; unknown: string[] };

function ImportCard({ kind, title, hint, last }: { kind: "ar" | "stock"; title: string; hint: string; last?: ImportInfo }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  async function upload(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    setResult(null);
    const fd = new FormData();
    fd.set("kind", kind);
    fd.set("file", file);
    try {
      const res = await fetch("/api/sales/imports", { method: "POST", body: fd });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) setError(j.error ?? "That did not import.");
      else {
        setResult(j.value);
        router.refresh();
      }
    } catch {
      setError("Could not reach the system. Check your internet and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-5">
      <div className="text-base font-bold tracking-tight">{title}</div>
      <p className="mt-1 text-[13px] text-mute">{hint}</p>
      <p className="mt-3 text-xs text-faint">
        {last ? `Last import ${day(last.asOf)} · ${last.rows} rows${last.skipped ? `, ${last.skipped} left out` : ""}${last.byName ? ` · by ${last.byName}` : ""}` : "Not imported yet."}
      </p>
      <label className={`mt-4 inline-flex cursor-pointer items-center rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-accent-hover ${busy ? "pointer-events-none opacity-50" : ""}`}>
        {busy ? "Importing…" : "Import the export…"}
        <input type="file" accept=".xlsx,.xls,.csv" className="sr-only" onChange={(e) => { void upload(e.target.files?.[0]); e.target.value = ""; }} />
      </label>
      {error && <div className="mt-3"><Notice tone="bad">{error}</Notice></div>}
      {result && (
        <div className="mt-3 space-y-2">
          <Notice tone="good">Imported {result.imported} rows. The previous import was replaced.</Notice>
          {result.unknown.length > 0 && (
            <Notice tone="warn">
              Left out — not found here: {result.unknown.slice(0, 12).join(", ")}{result.unknown.length > 12 ? "…" : ""}
            </Notice>
          )}
          {result.skipped.length > 0 && (
            <Notice tone="warn">
              {result.skipped.length} lines could not be read: {result.skipped.slice(0, 5).map((s) => `line ${s.line} (${s.reason})`).join("; ")}
            </Notice>
          )}
        </div>
      )}
    </Card>
  );
}

export function AccountsScreen({
  rows, invoices, names, imports, stock, today,
}: {
  rows: AgingRow[];
  invoices: Invoice[];
  names: Record<string, string>;
  imports: Partial<Record<"ar" | "stock", ImportInfo>>;
  stock: { items: number; out: number };
  today: string;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const total = rows.reduce((s, r) => s + r.total, 0);
  const overdue = rows.reduce((s, r) => s + r.d30 + r.d60 + r.d90 + r.over90, 0);
  const over90 = rows.reduce((s, r) => s + r.over90, 0);
  const mine = open ? invoices.filter((i) => i.customerCode === open && i.outstanding) : [];

  return (
    <>
      <PageHeader title="Accounts & stock" sub="From AutoCount exports. Dealers see their own statement on the portal; reps see it for their dealers; out-of-stock items are marked on the portal." />
      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <ImportCard kind="ar" title="Outstanding invoices"
          hint="In AutoCount: A/R → Outstanding invoice listing (all debtors), export to Excel. Needs Debtor Code, Doc No, Doc Date, Due Date and Outstanding columns."
          last={imports.ar} />
        <ImportCard kind="stock" title="Stock balance"
          hint="In AutoCount: Stock → Stock balance report, export to Excel. Needs Item Code and Balance Qty columns. Dealers only see “Out of stock”, never the quantity."
          last={imports.stock} />
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-4">
        <Stat label="Owed to us" value={`RM ${money(total)}`} sub={`${rows.length} dealers`} />
        <Stat label="Overdue" value={`RM ${money(overdue)}`} tone={overdue ? "text-warn" : ""} />
        <Stat label="Over 90 days" value={`RM ${money(over90)}`} tone={over90 ? "text-bad" : ""} />
        <Stat label="Out of stock" value={String(stock.out)} sub={`of ${stock.items} items imported`} />
      </div>

      <Card className="overflow-hidden">
        <div className="border-b border-line px-5 py-3 text-sm font-bold">Aging by dealer · as of {day(today)}</div>
        {rows.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-mute">Import the outstanding invoices to see who owes what.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-[10px] font-bold uppercase tracking-[0.1em] text-faint">
                <th className="px-5 py-2">Dealer</th><th className="px-3 py-2 text-right">Not due</th><th className="px-3 py-2 text-right">1–30</th>
                <th className="px-3 py-2 text-right">31–60</th><th className="px-3 py-2 text-right">61–90</th><th className="px-3 py-2 text-right">Over 90</th><th className="px-5 py-2 text-right">Total (RM)</th>
              </tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.customerCode} onClick={() => setOpen(r.customerCode)} className="cursor-pointer border-t border-line hover:bg-accent-soft/40">
                    <td className="px-5 py-2.5"><div className="font-medium">{names[r.customerCode] ?? r.customerCode}</div><div className="nums text-xs text-faint">{r.customerCode}</div></td>
                    <td className="nums px-3 py-2.5 text-right text-mute">{rm(r.current)}</td>
                    <td className="nums px-3 py-2.5 text-right">{rm(r.d30)}</td>
                    <td className="nums px-3 py-2.5 text-right">{rm(r.d60)}</td>
                    <td className="nums px-3 py-2.5 text-right text-warn">{rm(r.d90)}</td>
                    <td className="nums px-3 py-2.5 text-right font-semibold text-bad">{rm(r.over90)}</td>
                    <td className="nums px-5 py-2.5 text-right font-bold">{rm(r.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Drawer open={!!open} title={open ? names[open] ?? open : ""} sub={open ?? undefined} onClose={() => setOpen(null)}
        footer={<Btn kind="ghost" onClick={() => setOpen(null)}>Close</Btn>}>
        <table className="w-full text-sm">
          <thead><tr className="text-left text-[10px] font-bold uppercase tracking-[0.1em] text-faint">
            <th className="py-2">Document</th><th className="py-2">Due</th><th className="py-2 text-right">Outstanding</th>
          </tr></thead>
          <tbody>
            {mine.map((i) => {
              const late = Math.floor((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${i.dueDate ?? i.docDate}T00:00:00Z`)) / 86400_000);
              return (
                <tr key={i.docNo} className="border-t border-line">
                  <td className="py-2.5"><div className="nums font-medium">{i.docNo}</div><div className="text-xs text-mute">{day(i.docDate)} · {i.docType}</div></td>
                  <td className="py-2.5 text-xs">{i.dueDate ? day(i.dueDate) : "—"}{late > 0 && <div className="font-semibold text-bad">{late} days late</div>}</td>
                  <td className="nums py-2.5 text-right font-semibold">{rm(i.outstanding)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Drawer>
    </>
  );
}
