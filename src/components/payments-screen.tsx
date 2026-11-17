"use client";
// Bank slips dealers sent from the portal. Open one, look at the slip, and mark
// it Received — or Not accepted with a reason the dealer will read.
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Btn, Card, Chip, Drawer, Field, Notice, PageHeader, inputCls } from "@/components/ui";
import type { PaymentStatus, PortalPayment } from "@/lib/store-payments";

const STATUS: Record<PaymentStatus, { label: string; tone: "red" | "teal" | "gray" }> = {
  submitted: { label: "To check", tone: "red" },
  checked: { label: "Received", tone: "teal" },
  rejected: { label: "Not accepted", tone: "gray" },
};
const ORDER: PaymentStatus[] = ["submitted", "checked", "rejected"];

const money = (n: number, currency: string) =>
  `${currency === "SGD" ? "S$" : "RM"} ${n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const day = (iso: string) => new Date(iso.length === 10 ? `${iso}T00:00:00+08:00` : iso)
  .toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" });

export function PaymentsScreen({ payments }: { payments: PortalPayment[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<PaymentStatus | "all">(payments.some((p) => p.status === "submitted") ? "submitted" : "all");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<PortalPayment | null>(null);
  const counts = useMemo(() => {
    const m: Record<string, number> = { all: payments.length };
    for (const p of payments) m[p.status] = (m[p.status] ?? 0) + 1;
    return m;
  }, [payments]);
  const needle = q.trim().toLowerCase();
  const shown = payments.filter((p) =>
    (tab === "all" || p.status === tab) &&
    (!needle || `${p.customerName} ${p.customerCode} ${p.orderNo ?? ""} ${p.reference ?? ""} ${p.amount}`.toLowerCase().includes(needle)));

  return (
    <>
      <PageTitleBlock />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {(["all", ...ORDER] as const).map((s) => {
          const on = tab === s;
          return (
            <button key={s} type="button" onClick={() => setTab(s)}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-semibold transition ${on ? "bg-accent text-white" : "border border-line bg-white text-mute hover:text-ink"}`}>
              {s === "all" ? "All" : STATUS[s].label}
              <span className={`nums rounded-md px-1.5 text-[11px] ${on ? "bg-white/20" : s === "submitted" && counts.submitted ? "bg-red-500 text-white" : "bg-gray-100 text-faint"}`}>
                {counts[s] ?? 0}
              </span>
            </button>
          );
        })}
        <input className={`${inputCls} ml-auto max-w-xs`} placeholder="Search dealer, order, reference…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {shown.length === 0 ? (
        <Card className="px-6 py-14 text-center text-sm text-mute">
          {payments.length === 0 ? "No slips yet. Dealers upload them on the portal under Payments, or from an order." : "Nothing here."}
        </Card>
      ) : (
        <>
          <Card className="hidden overflow-hidden md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-gray-50/70 text-left text-[10px] font-bold uppercase tracking-[0.1em] text-faint">
                  <th className="px-4 py-2.5">Sent</th>
                  <th className="px-4 py-2.5">Dealer</th>
                  <th className="px-4 py-2.5">Paid on</th>
                  <th className="px-4 py-2.5">Order / ref</th>
                  <th className="px-4 py-2.5 text-right">Amount (as typed)</th>
                  <th className="px-4 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((p) => (
                  <tr key={p.id} onClick={() => setOpen(p)} className="cursor-pointer border-b border-line last:border-0 hover:bg-accent-soft/40">
                    <td className="nums whitespace-nowrap px-4 py-3 text-mute">{day(p.createdAt)}</td>
                    <td className="px-4 py-3"><div className="font-semibold">{p.customerName}</div><div className="nums text-xs text-mute">{p.customerCode}</div></td>
                    <td className="nums whitespace-nowrap px-4 py-3">{day(p.paidOn)}</td>
                    <td className="nums px-4 py-3 text-mute">{[p.orderNo, p.reference].filter(Boolean).join(" · ") || "—"}</td>
                    <td className="nums px-4 py-3 text-right font-semibold">{money(p.amount, p.currency)}</td>
                    <td className="px-4 py-3"><Chip tone={STATUS[p.status].tone}>{STATUS[p.status].label}</Chip></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <div className="space-y-2.5 md:hidden">
            {shown.map((p) => (
              <button key={p.id} type="button" onClick={() => setOpen(p)} className="block w-full text-left">
                <Card className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold">{p.customerName}</div>
                      <div className="nums text-xs text-mute">{day(p.paidOn)}{p.orderNo ? ` · ${p.orderNo}` : ""}</div>
                    </div>
                    <div className="text-right">
                      <div className="nums font-semibold">{money(p.amount, p.currency)}</div>
                      <Chip tone={STATUS[p.status].tone}>{STATUS[p.status].label}</Chip>
                    </div>
                  </div>
                </Card>
              </button>
            ))}
          </div>
        </>
      )}

      {open && <SlipDrawer key={open.id} p={open} onClose={() => setOpen(null)} onSaved={() => { setOpen(null); router.refresh(); }} />}
    </>
  );
}

function PageTitleBlock() {
  return (
    <PageHeader
      title="Payments"
      sub="Bank slips dealers sent from the portal. Check each against the bank statement, then mark it Received — or Not accepted with a reason."
    />
  );
}

function SlipDrawer({ p, onClose, onSaved }: { p: PortalPayment; onClose: () => void; onSaved: () => void }) {
  const [slip, setSlip] = useState<{ url: string; type: string } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [note, setNote] = useState(p.officeNote ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/sales/payments?id=${p.id}`)
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!alive) return;
        if (!r.ok) setLoadError(j.error ?? "Could not open the slip.");
        else setSlip(j.value);
      })
      .catch(() => alive && setLoadError("Could not reach the system."));
    return () => { alive = false; };
  }, [p.id]);

  async function save(status: PaymentStatus) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/sales/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: p.id, status, officeNote: status === "rejected" ? note : null }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) return setError(j.error ?? "That did not save.");
      onSaved();
    } catch {
      setError("Could not reach the system. Check your internet and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Drawer
      open
      title={`${money(p.amount, p.currency)} · ${p.customerName}`}
      sub={`Paid ${day(p.paidOn)} · sent ${day(p.createdAt)}${p.placedBy ? ` by ${p.placedBy}` : ""}`}
      onClose={onClose}
      footer={
        <>
          {p.status !== "checked" && <Btn onClick={() => void save("checked")} disabled={busy}>Received</Btn>}
          {p.status !== "rejected" && (
            <Btn kind="danger" onClick={() => void save("rejected")} disabled={busy || !note.trim()} title={note.trim() ? undefined : "Write the reason first"}>
              Not accepted
            </Btn>
          )}
          {p.status !== "submitted" && <Btn kind="ghost" onClick={() => void save("submitted")} disabled={busy}>Back to “to check”</Btn>}
          <span className="ml-auto text-xs text-faint">{p.checkedBy ? `${STATUS[p.status].label} by ${p.checkedBy}` : "Esc to close"}</span>
        </>
      }
    >
      <div className="space-y-5">
        {error && <Notice tone="bad">{error}</Notice>}
        <div className="overflow-hidden rounded-xl border border-line bg-gray-50">
          {loadError ? (
            <p className="p-4 text-sm text-bad">{loadError}</p>
          ) : !slip ? (
            <p className="p-6 text-center text-sm text-mute">Opening the slip…</p>
          ) : slip.type === "application/pdf" ? (
            <div className="p-4">
              <a href={slip.url} target="_blank" rel="noopener" className="font-semibold text-accent underline underline-offset-2">Open the PDF slip</a>
              <p className="mt-1 text-xs text-mute">The link works for 10 minutes.</p>
            </div>
          ) : (
            <a href={slip.url} target="_blank" rel="noopener" title="Open full size">
              {/* eslint-disable-next-line @next/next/no-img-element -- a private, short-lived link */}
              <img src={slip.url} alt="Payment slip" className="max-h-[60vh] w-full object-contain" />
            </a>
          )}
        </div>
        <dl className="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-2 text-sm">
          <dt className="text-faint">Dealer</dt><dd className="font-medium">{p.customerName} <span className="nums text-mute">{p.customerCode}</span></dd>
          <dt className="text-faint">Amount</dt><dd className="nums font-medium">{money(p.amount, p.currency)} <span className="text-xs text-mute">as typed by the dealer</span></dd>
          <dt className="text-faint">Paid on</dt><dd className="nums">{day(p.paidOn)}</dd>
          {p.orderNo && <><dt className="text-faint">For order</dt><dd className="nums">{p.orderNo}</dd></>}
          {p.reference && <><dt className="text-faint">Bank ref</dt><dd className="nums">{p.reference}</dd></>}
          {p.note && <><dt className="text-faint">Their note</dt><dd className="whitespace-pre-wrap">{p.note}</dd></>}
        </dl>
        {p.status !== "rejected" && (
          <Field label="If not accepted — why" hint="The dealer reads this on the portal, e.g. “Amount on the slip is RM 1,200, not RM 2,100.”">
            <textarea className={`${inputCls} h-20`} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
        )}
        {p.status === "rejected" && p.officeNote && <Notice tone="warn">Told the dealer: {p.officeNote}</Notice>}
      </div>
    </Drawer>
  );
}
