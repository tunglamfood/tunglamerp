"use client";
// Enquiries from tunglamfood.my. New ones carry a red number in the sidebar
// until someone picks them up. A would-be dealer becomes a customer — with a
// portal login if wanted — without retyping anything.
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Btn, Card, Chip, Drawer, Field, Notice, PageHeader, Select, inputCls } from "@/components/ui";
import { normalisePhone, showPhone } from "@/lib/phone";
import { WEBSITE_URL } from "@/lib/areas";
import type { Lead, LeadStatus } from "@/lib/store-leads";

const STATUS: Record<LeadStatus, { label: string; tone: "red" | "blue" | "teal" | "gray" | "amber" }> = {
  new: { label: "New", tone: "red" },
  contacted: { label: "Contacted", tone: "blue" },
  won: { label: "Won", tone: "teal" },
  lost: { label: "Lost", tone: "gray" },
  spam: { label: "Spam", tone: "amber" },
};
const ORDER: LeadStatus[] = ["new", "contacted", "won", "lost", "spam"];

const KIND: Record<Lead["kind"], string> = {
  wholesale: "Wants to be a dealer",
  product: "About a product",
  general: "General",
};

const LANG: Record<string, string> = { en: "English", ms: "Bahasa Melayu", zh: "中文" };

function when(iso: string) {
  return new Date(iso).toLocaleString("en-MY", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

/** wa.me wants digits only, with the country code. */
const waLink = (phone: string) => {
  const e164 = normalisePhone(phone);
  return e164 ? `https://wa.me/${e164.slice(1)}` : null;
};

async function send(body: unknown): Promise<{ error?: string; value?: { customerCode?: string; portal?: boolean } }> {
  try {
    const res = await fetch("/api/sales/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { error: data.error ?? "That did not save. Please try again." };
    return { value: data.value ?? undefined };
  } catch {
    return { error: "Could not reach the system. Check your internet and try again." };
  }
}

export function LeadsScreen({ leads, customers }: { leads: Lead[]; customers: { code: string; name: string }[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<LeadStatus | "all">(leads.some((l) => l.status === "new") ? "new" : "all");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<Lead | null>(null);
  const customerName = useMemo(() => new Map(customers.map((c) => [c.code, c.name])), [customers]);

  const counts = useMemo(() => {
    const m: Record<string, number> = { all: leads.length };
    for (const l of leads) m[l.status] = (m[l.status] ?? 0) + 1;
    return m;
  }, [leads]);

  const shown = leads.filter((l) => {
    if (tab !== "all" && l.status !== tab) return false;
    const needle = q.trim().toLowerCase();
    return !needle || `${l.name} ${l.company ?? ""} ${l.phone ?? ""} ${l.email ?? ""} ${l.message ?? ""}`.toLowerCase().includes(needle);
  });

  return (
    <>
      <PageHeader
        title="Enquiries"
        sub="From the contact forms on tunglamfood.my. Pick one up, note what happened, and turn would-be dealers into customers."
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {(["all", ...ORDER] as const).map((s) => {
          const on = tab === s;
          return (
            <button key={s} type="button" onClick={() => setTab(s)}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-semibold transition ${on ? "bg-accent text-white" : "border border-line bg-white text-mute hover:text-ink"}`}>
              {s === "all" ? "All" : STATUS[s].label}
              <span className={`nums rounded-md px-1.5 text-[11px] ${on ? "bg-white/20" : s === "new" && counts.new ? "bg-red-500 text-white" : "bg-gray-100 text-faint"}`}>
                {counts[s] ?? 0}
              </span>
            </button>
          );
        })}
        <input className={`${inputCls} ml-auto max-w-xs`} placeholder="Search name, phone, message…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {shown.length === 0 ? (
        <Card className="px-6 py-14 text-center text-sm text-mute">
          {leads.length === 0
            ? "No enquiries yet. They arrive here the moment someone sends the form on tunglamfood.my."
            : "Nothing here."}
        </Card>
      ) : (
        <>
          {/* Desktop table */}
          <Card className="hidden overflow-hidden md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-gray-50/70 text-left text-[10px] font-bold uppercase tracking-[0.1em] text-faint">
                  <th className="px-4 py-2.5">Received</th>
                  <th className="px-4 py-2.5">From</th>
                  <th className="px-4 py-2.5">About</th>
                  <th className="px-4 py-2.5">Contact</th>
                  <th className="px-4 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((l) => (
                  <tr key={l.id} onClick={() => setOpen(l)} className="cursor-pointer border-b border-line last:border-0 hover:bg-accent-soft/40">
                    <td className="nums whitespace-nowrap px-4 py-3 text-mute">{when(l.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="font-semibold">{l.name}</div>
                      {l.company && <div className="text-xs text-mute">{l.company}</div>}
                    </td>
                    <td className="max-w-[320px] px-4 py-3">
                      <div className="text-xs font-semibold text-mute">{KIND[l.kind]}</div>
                      {l.message && <div className="line-clamp-1 text-[13px]">{l.message}</div>}
                    </td>
                    <td className="nums whitespace-nowrap px-4 py-3 text-mute">{l.phone || l.email || "—"}</td>
                    <td className="px-4 py-3">
                      <Chip tone={STATUS[l.status].tone}>{STATUS[l.status].label}</Chip>
                      {l.customerCode && <div className="mt-1 text-xs text-mute">{customerName.get(l.customerCode) ?? l.customerCode}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {/* Phone list */}
          <div className="space-y-2.5 md:hidden">
            {shown.map((l) => (
              <button key={l.id} type="button" onClick={() => setOpen(l)} className="block w-full text-left">
                <Card className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold">{l.name}</div>
                      <div className="text-xs text-mute">{[l.company, KIND[l.kind]].filter(Boolean).join(" · ")}</div>
                    </div>
                    <Chip tone={STATUS[l.status].tone}>{STATUS[l.status].label}</Chip>
                  </div>
                  {l.message && <p className="mt-2 line-clamp-2 text-[13px] text-ink/80">{l.message}</p>}
                  <div className="nums mt-2 text-xs text-faint">{when(l.createdAt)}</div>
                </Card>
              </button>
            ))}
          </div>
        </>
      )}

      {open && (
        <LeadDrawer
          key={open.id}
          lead={open}
          customers={customers}
          customerName={open.customerCode ? customerName.get(open.customerCode) ?? open.customerCode : null}
          onClose={() => setOpen(null)}
          onSaved={() => { setOpen(null); router.refresh(); }}
        />
      )}
    </>
  );
}

function LeadDrawer({
  lead, customers, customerName, onClose, onSaved,
}: {
  lead: Lead;
  customers: { code: string; name: string }[];
  customerName: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [status, setStatus] = useState<LeadStatus>(lead.status === "new" ? "contacted" : lead.status);
  const [note, setNote] = useState(lead.note ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [converting, setConverting] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const [mode, setMode] = useState<"new" | "existing">("new");
  const [existing, setExisting] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState((lead.company || lead.name).toUpperCase());
  const [shortName, setShortName] = useState("");
  const [state, setState] = useState("");
  const [portal, setPortal] = useState(!!lead.phone);
  const [portalPhone, setPortalPhone] = useState(lead.phone ?? "");

  const wa = lead.phone ? waLink(lead.phone) : null;
  const portalOk = !portal || !!normalisePhone(portalPhone);
  const convertBlocked =
    mode === "existing" ? (!existing ? "Pick the customer" : null)
      : !/^\d{4}\/\d{4}$/.test(code.trim()) ? "Type the customer code, like 3030/0123"
        : !name.trim() ? "The customer needs a name" : null;

  async function save() {
    setBusy(true);
    setError(null);
    const res = await send({ id: lead.id, status, note });
    setBusy(false);
    if (res.error) return setError(res.error);
    onSaved();
  }

  async function convert() {
    if (convertBlocked || !portalOk) return;
    setBusy(true);
    setError(null);
    const res = await send({
      id: lead.id,
      convert: {
        existingCode: mode === "existing" ? existing : null,
        code: code.trim(),
        name: name.trim(),
        shortName: shortName.trim(),
        state,
        phone: lead.phone,
        email: lead.email,
        portal,
        portalPhone,
        portalName: lead.name,
      },
    });
    setBusy(false);
    if (res.error) return setError(res.error);
    setDone(
      `${res.value?.customerCode ?? "The customer"} is saved${res.value?.portal ? ", and can now sign in to the dealer portal with that phone number" : ""}. ` +
      "Set their prices and payment terms under Price lists and Customers.",
    );
  }

  return (
    <Drawer
      open
      title={lead.name}
      sub={`${KIND[lead.kind]} · ${when(lead.createdAt)}`}
      onClose={done ? onSaved : onClose}
      footer={
        done ? (
          <Btn onClick={onSaved}>Done</Btn>
        ) : (
          <>
            <Btn onClick={() => void save()} disabled={busy}>{busy ? "Saving…" : "Save"}</Btn>
            <Btn kind="ghost" onClick={onClose} disabled={busy}>Cancel</Btn>
            {lead.handledBy && <span className="ml-auto text-xs text-faint">Last handled by {lead.handledBy}</span>}
          </>
        )
      }
    >
      <div className="space-y-5">
        {error && <Notice tone="bad">{error}</Notice>}
        {done && <Notice tone="good">{done}</Notice>}

        {/* Who */}
        <Card className="p-4">
          <dl className="grid grid-cols-[6rem_1fr] gap-x-3 gap-y-2 text-sm">
            {lead.company && <><dt className="text-faint">Company</dt><dd className="font-medium">{lead.company}</dd></>}
            {lead.phone && <><dt className="text-faint">Phone</dt><dd className="nums font-medium">{normalisePhone(lead.phone) ? showPhone(normalisePhone(lead.phone)!) : lead.phone}</dd></>}
            {lead.email && <><dt className="text-faint">Email</dt><dd className="break-all font-medium">{lead.email}</dd></>}
            {lead.locale && <><dt className="text-faint">Wrote in</dt><dd>{LANG[lead.locale] ?? lead.locale}</dd></>}
            {lead.productSlug && (
              <>
                <dt className="text-faint">Product</dt>
                <dd><a className="font-medium text-accent underline underline-offset-2" href={`${WEBSITE_URL}/products/${lead.productSlug}`} target="_blank" rel="noopener">{lead.productSlug}</a></dd>
              </>
            )}
            {lead.pageUrl && <><dt className="text-faint">Sent from</dt><dd className="break-all text-mute">{lead.pageUrl}</dd></>}
          </dl>
          <div className="mt-4 flex flex-wrap gap-2">
            {wa && (
              <a href={wa} target="_blank" rel="noopener" className="rounded-xl bg-[#25D366] px-3.5 py-2 text-sm font-semibold text-white transition hover:brightness-95">
                WhatsApp
              </a>
            )}
            {lead.phone && <a href={`tel:${lead.phone.replace(/[^\d+]/g, "")}`} className="rounded-xl border border-line bg-white px-3.5 py-2 text-sm font-semibold transition hover:bg-gray-50">Call</a>}
            {lead.email && <a href={`mailto:${lead.email}`} className="rounded-xl border border-line bg-white px-3.5 py-2 text-sm font-semibold transition hover:bg-gray-50">Email</a>}
          </div>
        </Card>

        {lead.message && (
          <div>
            <div className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-faint">Their message</div>
            <p className="whitespace-pre-wrap rounded-xl bg-gray-50 p-3.5 text-sm leading-relaxed">{lead.message}</p>
          </div>
        )}

        {!done && (
          <>
            <Field label="Status">
              <div className="flex flex-wrap gap-1.5">
                {ORDER.map((s) => (
                  <button key={s} type="button" onClick={() => setStatus(s)}
                    className={`rounded-xl px-3 py-1.5 text-sm font-semibold transition ${status === s ? "bg-accent text-white" : "border border-line bg-white text-mute hover:text-ink"}`}>
                    {STATUS[s].label}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Note" hint="What was said, what happens next. Everyone in sales sees it.">
              <textarea className={`${inputCls} h-24`} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>
          </>
        )}

        {/* Make them a dealer */}
        {!done && (lead.customerCode ? (
          <Notice tone="good">Customer: {customerName}. Prices and payment terms are set under Price lists and Customers.</Notice>
        ) : !converting ? (
          <div className="rounded-xl border border-dashed border-accent-line p-4">
            <div className="text-sm font-semibold">Becoming a dealer?</div>
            <p className="mt-0.5 text-xs text-mute">Make them a customer — and let them order on the dealer portal — without retyping anything.</p>
            <Btn kind="ghost" size="sm" className="mt-3" onClick={() => setConverting(true)}>Make them a dealer…</Btn>
          </div>
        ) : (
          <div className="space-y-4 rounded-xl border border-accent-line bg-accent-soft/30 p-4">
            <div className="text-sm font-bold">Make them a dealer</div>
            <div className="flex gap-2">
              {(["new", "existing"] as const).map((m) => (
                <button key={m} type="button" onClick={() => setMode(m)}
                  className={`rounded-xl px-3 py-1.5 text-sm font-semibold transition ${mode === m ? "bg-accent text-white" : "border border-line bg-white text-mute"}`}>
                  {m === "new" ? "A new customer" : "An existing customer"}
                </button>
              ))}
            </div>
            {mode === "existing" ? (
              <Field label="Customer">
                <Select searchable value={existing} placeholder="Choose the customer…" onChange={setExisting}
                  options={customers.map((c) => ({ value: c.code, label: c.name, note: c.code }))} />
              </Field>
            ) : (
              <>
                <Field label="Customer code" hint="Open the debtor in Million / AutoCount first, then type the same code here.">
                  <input className={`${inputCls} nums`} placeholder="3030/0123" value={code} onChange={(e) => setCode(e.target.value)} />
                </Field>
                <Field label="Name (as invoiced)">
                  <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Short name">
                    <input className={inputCls} value={shortName} onChange={(e) => setShortName(e.target.value)} />
                  </Field>
                  <Field label="State">
                    <input className={inputCls} placeholder="Perak" value={state} onChange={(e) => setState(e.target.value)} />
                  </Field>
                </div>
              </>
            )}
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" className="mt-0.5" checked={portal} onChange={(e) => setPortal(e.target.checked)} />
              <span>
                <span className="font-semibold">Let them order on the dealer portal</span>
                <span className="block text-xs text-mute">They sign in at tunglamfood.my/portal with a code sent to this phone.</span>
              </span>
            </label>
            {portal && (
              <Field label="Portal phone number">
                <input className={`${inputCls} nums`} inputMode="tel" value={portalPhone} onChange={(e) => setPortalPhone(e.target.value)} />
              </Field>
            )}
            {!portalOk && <p className="text-sm font-medium text-bad">That phone number does not look right.</p>}
            <div className="flex items-center gap-2">
              <Btn onClick={() => void convert()} disabled={busy || !!convertBlocked || !portalOk}>
                {busy ? "Saving…" : "Make them a dealer"}
              </Btn>
              <Btn kind="ghost" onClick={() => setConverting(false)} disabled={busy}>Not now</Btn>
              {convertBlocked && <span className="text-xs text-faint">{convertBlocked}</span>}
            </div>
          </div>
        ))}
      </div>
    </Drawer>
  );
}
