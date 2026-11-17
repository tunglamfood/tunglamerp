"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Btn, Card, Chip, Drawer, Field, Notice, PageHeader, Select, inputCls } from "@/components/ui";
import { post, remove } from "@/lib/api";
import { Customer, OrderLine, OrderStatus, PriceRow, Product, SalesOrder } from "@/lib/types";
import { lineAmount, nextOrderNo, orderTotal, priceFor } from "@/lib/pricing";

const money = (n: number) => n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const today = () => new Date().toISOString().slice(0, 10);

const STATUS: { value: OrderStatus; label: string; tone: "gray" | "blue" | "teal" | "red" | "amber" }[] = [
  { value: "submitted", label: "New from portal", tone: "amber" },
  { value: "on_hold", label: "On hold (credit)", tone: "red" },
  { value: "draft", label: "Draft", tone: "gray" },
  { value: "confirmed", label: "Confirmed", tone: "blue" },
  { value: "delivered", label: "Delivered", tone: "teal" },
  { value: "cancelled", label: "Cancelled", tone: "red" },
];

/** A status this screen does not know yet still shows, rather than breaking the list. */
const statusOf = (value: string) =>
  STATUS.find((x) => x.value === value) ?? { value: value as OrderStatus, label: value, tone: "gray" as const };

const SOURCE: Record<string, string> = { portal: "Portal", rep: "Rep" };

const firstOfMonth = () => `${today().slice(0, 8)}01`;

const blankLine = (): OrderLine => ({ lineNo: 1, itemCode: "", qty: 0, uom: "", price: 0, note: null });

export function OrdersScreen({
  orders, customers, products, prices,
}: {
  orders: SalesOrder[]; customers: Customer[]; products: Product[]; prices: PriceRow[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<SalesOrder | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [exporting, setExporting] = useState(false);
  const [range, setRange] = useState({ from: firstOfMonth(), to: today(), include: false });
  const [exportNote, setExportNote] = useState<string | null>(null);

  const customerOf = useMemo(() => new Map(customers.map((c) => [c.code, c])), [customers]);
  const productOf = useMemo(() => new Map(products.map((p) => [p.itemCode, p])), [products]);

  const shown = orders.filter((o) => {
    if (status !== "all" && o.status !== status) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    const c = customerOf.get(o.customerCode ?? "");
    return `${o.orderNo} ${o.theirRef ?? ""} ${c?.name ?? ""} ${c?.shortName ?? ""}`
      .toLowerCase().includes(q);
  });

  function startNew() {
    setEditing({
      orderNo: nextOrderNo(orders.map((o) => o.orderNo), today()),
      customerCode: customers.find((c) => c.active)?.code ?? "",
      orderDate: today(),
      deliverOn: null,
      status: "draft",
      theirRef: null,
      note: null,
      lines: [blankLine()],
    });
    setIsNew(true);
    setProblem(null);
  }

  /** Picking a product fills in its unit and this dealer's own price. */
  function fillLine(order: SalesOrder, index: number, itemCode: string): SalesOrder {
    const item = productOf.get(itemCode);
    const found = priceFor(order.customerCode ?? "", item, prices, order.orderDate,
      customerOf.get(order.customerCode ?? "")?.groupCode);
    const lines = [...order.lines];
    lines[index] = {
      ...lines[index],
      itemCode,
      uom: item?.uom ?? lines[index].uom,
      price: found.price,
      priceSource: found.source,
    };
    return { ...order, lines };
  }

  /** Changing the customer or the date re-prices every line for them. */
  function reprice(order: SalesOrder): SalesOrder {
    return {
      ...order,
      lines: order.lines.map((l) => {
        if (!l.itemCode) return l;
        const found = priceFor(order.customerCode ?? "", productOf.get(l.itemCode), prices, order.orderDate,
          customerOf.get(order.customerCode ?? "")?.groupCode);
        return { ...l, price: found.price, priceSource: found.source };
      }),
    };
  }

  async function save() {
    if (!editing) return;
    setBusy(true);
    setProblem(null);
    const res = await post("/api/sales/orders", editing);
    setBusy(false);
    if (res.error) return setProblem(res.error);
    setEditing(null);
    router.refresh();
  }

  async function drop() {
    if (!editing?.id) return;
    setBusy(true);
    const res = await remove(`/api/sales/orders?id=${editing.id}`);
    setBusy(false);
    if (res.error) return setProblem(res.error);
    setEditing(null);
    router.refresh();
  }

  /** Downloads the AutoCount file; the server marks those orders as exported. */
  async function exportForAutoCount() {
    setBusy(true);
    setProblem(null);
    setExportNote(null);
    try {
      const form = new FormData();
      form.set("from", range.from);
      form.set("to", range.to);
      if (range.include) form.set("include", "yes");
      const res = await fetch("/api/sales/export", { method: "POST", body: form });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setProblem(data.error ?? "The export did not work. Please try again.");
        return;
      }
      const blob = await res.blob();
      const name = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") ?? "")?.[1] ?? "autocount.xlsx";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
      const count = Number(res.headers.get("X-Orders") ?? 0);
      const unpriced = Number(res.headers.get("X-Unpriced-Lines") ?? 0);
      setExportNote(`Saved ${name} with ${count} order${count === 1 ? "" : "s"}. They are now marked as exported.`);
      if (unpriced > 0) {
        setProblem(`${unpriced} line${unpriced === 1 ? " has" : "s have"} no price (${res.headers.get("X-Unpriced-Orders")}). `
          + "Fix the price in AutoCount, or set it here, press \u201cExport it again next time\u201d on the order and export again.");
      }
      router.refresh();
    } catch {
      setProblem("Could not reach the system. Check your internet and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function unmarkExported() {
    if (!editing?.id) return;
    setBusy(true);
    const res = await remove(`/api/sales/export?id=${editing.id}`);
    setBusy(false);
    if (res.error) return setProblem(res.error);
    setEditing({ ...editing, exportedAt: null, exportRef: null });
    router.refresh();
  }

  const total = editing ? orderTotal(editing.lines) : 0;
  const editingCustomer = editing ? customerOf.get(editing.customerCode ?? "") : undefined;
  const waiting = orders.filter((o) => (o.status === "confirmed" || o.status === "delivered") && !o.exportedAt).length;

  return (
    <>
      <PageHeader
        title="Sales orders"
        sub={<span className="nums">{orders.length} orders</span>}
        right={
          <div className="flex gap-2">
            <Btn kind="ghost" onClick={() => { setExporting(true); setProblem(null); setExportNote(null); }}
              title="Confirmed and delivered orders as an Excel file for AutoCount">
              Export for AutoCount{waiting > 0 ? ` (${waiting})` : ""}
            </Btn>
            <Btn onClick={startNew}>New order</Btn>
          </div>
        }
      />

      {problem && !editing && !exporting && <div className="mb-4"><Notice tone="bad">{problem}</Notice></div>}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input className={`${inputCls} min-w-[220px] flex-1`}
          placeholder="Search an order number, a customer, their PO…"
          value={search} onChange={(e) => setSearch(e.target.value)} />
        <Select className="w-[160px]" value={status} onChange={setStatus}
          options={[
            { value: "all", label: "All orders", note: String(orders.length) },
            ...STATUS.map((s) => ({
              value: s.value, label: s.label, note: String(orders.filter((o) => o.status === s.value).length),
            })),
          ]} />
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-gray-50/70 text-left text-[10px] font-bold uppercase tracking-[0.1em] text-faint">
                <th className="px-4 py-2.5">Order</th>
                <th className="px-4 py-2.5">Customer</th>
                <th className="px-4 py-2.5">Date</th>
                <th className="px-4 py-2.5">Deliver</th>
                <th className="px-4 py-2.5 text-right">Lines</th>
                <th className="px-4 py-2.5 text-right">Value</th>
                <th className="px-4 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((o) => {
                const c = customerOf.get(o.customerCode ?? "");
                const s = statusOf(o.status);
                return (
                  <tr key={o.orderNo}
                    onClick={() => { setEditing(o); setIsNew(false); setProblem(null); }}
                    className="cursor-pointer border-b border-line last:border-0 hover:bg-accent-soft/40">
                    <td className="nums px-4 py-2.5 font-semibold">
                      {o.orderNo}
                      {o.source && SOURCE[o.source] && (
                        <span className="ml-2 align-middle"><Chip tone="blue">{SOURCE[o.source]}</Chip></span>
                      )}
                      {o.placedBy && o.source !== "erp" && (
                        <div className="text-xs font-normal text-mute">by {o.placedBy}</div>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <div>{c?.shortName || c?.name || o.customerCode}</div>
                      {o.theirRef && <div className="text-xs text-mute">their ref {o.theirRef}</div>}
                    </td>
                    <td className="nums px-4 py-2.5 text-mute">{o.orderDate}</td>
                    <td className="nums px-4 py-2.5 text-mute">{o.deliverOn ?? "—"}</td>
                    <td className="nums px-4 py-2.5 text-right">{o.lines.length}</td>
                    <td className="nums px-4 py-2.5 text-right font-semibold">
                      {money(orderTotal(o.lines))}
                    </td>
                    <td className="px-4 py-2.5">
                      <Chip tone={s.tone}>{s.label}</Chip>
                      {o.exportedAt && (
                        <span className="ml-1.5 align-middle" title={o.exportRef ?? undefined}><Chip>Exported</Chip></span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {shown.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-mute">
                    {orders.length === 0
                      ? "No orders yet. Press New order to write the first one."
                      : "Nothing matches that."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Drawer
        open={exporting}
        title="Export for AutoCount"
        sub="Confirmed and delivered orders, one row per line"
        onClose={() => setExporting(false)}
        footer={
          <>
            <Btn onClick={() => void exportForAutoCount()} disabled={busy}>{busy ? "Preparing…" : "Download Excel"}</Btn>
            <Btn kind="ghost" onClick={() => setExporting(false)} disabled={busy}>Close</Btn>
          </>
        }
      >
        <div className="space-y-5">
          {problem && <Notice tone="bad">{problem}</Notice>}
          {exportNote && <Notice tone="good">{exportNote}</Notice>}
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Orders dated from">
              <input type="date" className={`${inputCls} nums`} value={range.from}
                onChange={(e) => setRange({ ...range, from: e.target.value })} />
            </Field>
            <Field label="To">
              <input type="date" className={`${inputCls} nums`} value={range.to}
                onChange={(e) => setRange({ ...range, to: e.target.value })} />
            </Field>
          </div>
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" className="mt-0.5 h-4 w-4" checked={range.include}
              onChange={(e) => setRange({ ...range, include: e.target.checked })} />
            <span>
              <span className="font-semibold">Include orders exported before</span>
              <span className="block text-mute">Leave this off so nothing goes into AutoCount twice.</span>
            </span>
          </label>
          <p className="text-sm text-mute">
            Only confirmed and delivered orders go out. Each one is marked as exported, so the next export starts
            where this one ended. The column names follow AutoCount&apos;s sales order import; if your AutoCount
            template names them differently, they are listed in one place in <span className="nums">src/lib/autocount.ts</span>.
          </p>
        </div>
      </Drawer>

      <Drawer
        open={editing !== null}
        title={editing?.orderNo ?? ""}
        sub={editing ? customerOf.get(editing.customerCode ?? "")?.name : undefined}
        onClose={() => setEditing(null)}
        footer={
          <>
            <Btn onClick={() => void save()} disabled={busy}>{busy ? "Saving…" : "Save order"}</Btn>
            <Btn kind="ghost" onClick={() => setEditing(null)} disabled={busy}>Cancel</Btn>
            {!isNew && editing?.id && (
              <Btn kind="danger" onClick={() => void drop()} disabled={busy}>Remove</Btn>
            )}
            <span className="nums ml-auto text-sm font-bold">RM {money(total)}</span>
          </>
        }
      >
        {problem && <div className="mb-4"><Notice tone="bad">{problem}</Notice></div>}
        {editingCustomer?.onHold && (
          <div className="mb-4">
            <Notice tone="warn">
              {editingCustomer.shortName || editingCustomer.name} is on hold
              {editingCustomer.holdReason ? `: ${editingCustomer.holdReason}` : ""}. Their portal orders wait here as
              &ldquo;On hold&rdquo; until you confirm or cancel them.
            </Notice>
          </div>
        )}
        {editing?.exportedAt && (
          <div className="mb-4">
            <Notice tone="info">
              Exported to AutoCount on {editing.exportedAt.slice(0, 10)}
              {editing.exportRef ? ` (${editing.exportRef})` : ""}. Changes made here now also need making in AutoCount.{" "}
              <button type="button" onClick={() => void unmarkExported()} disabled={busy}
                className="font-semibold underline underline-offset-2">
                Export it again next time
              </button>
            </Notice>
          </div>
        )}
        {editing && (
          <div className="space-y-5">
            <Field label="Customer" hint="Prices below follow whoever is chosen here.">
              <Select
                value={editing.customerCode ?? ""}
                searchable
                placeholder="Choose a customer"
                onChange={(v) => setEditing(reprice({ ...editing, customerCode: v }))}
                options={customers.filter((c) => c.active).map((c) => ({
                  value: c.code, label: c.shortName || c.name, note: c.state || undefined,
                }))}
              />
            </Field>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Order date">
                <input type="date" className={`${inputCls} nums`} value={editing.orderDate}
                  onChange={(e) => setEditing(reprice({ ...editing, orderDate: e.target.value }))} />
              </Field>
              <Field label="Deliver on">
                <input type="date" className={`${inputCls} nums`} value={editing.deliverOn ?? ""}
                  onChange={(e) => setEditing({ ...editing, deliverOn: e.target.value || null })} />
              </Field>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Their order number" hint="The customer's own PO, if they gave one.">
                <input className={inputCls} value={editing.theirRef ?? ""}
                  onChange={(e) => setEditing({ ...editing, theirRef: e.target.value || null })} />
              </Field>
              <Field label="Status">
                <Select value={editing.status}
                  onChange={(v) => setEditing({ ...editing, status: v as OrderStatus })}
                  options={STATUS.map((s) => ({ value: s.value, label: s.label }))} />
              </Field>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-faint">
                  What they are ordering
                </span>
                <button type="button"
                  onClick={() => setEditing({ ...editing, lines: [...editing.lines, blankLine()] })}
                  className="text-[13px] font-semibold text-accent underline underline-offset-2">
                  Add a line
                </button>
              </div>

              <div className="space-y-3">
                {editing.lines.map((line, i) => {
                  const item = productOf.get(line.itemCode);
                  const found = priceFor(editing.customerCode ?? "", item, prices, editing.orderDate,
                    customerOf.get(editing.customerCode ?? "")?.groupCode);
                  return (
                    <div key={i} className="rounded-xl border border-line p-3">
                      <div className="mb-2 flex items-start gap-2">
                        <div className="flex-1">
                          <Select
                            value={line.itemCode}
                            searchable
                            placeholder="Choose a product"
                            onChange={(v) => setEditing(fillLine(editing, i, v))}
                            options={products.filter((p) => p.active).map((p) => ({
                              value: p.itemCode,
                              label: `${p.itemCode} — ${p.description}`,
                              note: p.packSize || p.uom || undefined,
                            }))}
                          />
                        </div>
                        {editing.lines.length > 1 && (
                          <button type="button" aria-label="Remove line"
                            onClick={() => setEditing({
                              ...editing,
                              lines: editing.lines.filter((_, x) => x !== i),
                            })}
                            className="rounded-lg p-2 text-mute hover:bg-gray-100 hover:text-bad">
                            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8"
                              strokeLinecap="round" className="h-4 w-4">
                              <path d="M5 5l10 10M15 5 5 15" />
                            </svg>
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-4 gap-2">
                        <label className="block">
                          <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-faint">Qty</span>
                          <input className={`${inputCls} nums`} inputMode="decimal" value={String(line.qty)}
                            onChange={(e) => {
                              const lines = [...editing.lines];
                              lines[i] = { ...line, qty: Number(e.target.value) || 0 };
                              setEditing({ ...editing, lines });
                            }} />
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-faint">Unit</span>
                          <input className={inputCls} value={line.uom}
                            onChange={(e) => {
                              const lines = [...editing.lines];
                              lines[i] = { ...line, uom: e.target.value };
                              setEditing({ ...editing, lines });
                            }} />
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-faint">Price</span>
                          <input className={`${inputCls} nums`} inputMode="decimal" value={String(line.price)}
                            onChange={(e) => {
                              const lines = [...editing.lines];
                              lines[i] = { ...line, price: Number(e.target.value) || 0, priceSource: "manual" };
                              setEditing({ ...editing, lines });
                            }} />
                        </label>
                        <div>
                          <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-faint">Amount</span>
                          <div className="nums py-2.5 text-right text-sm font-bold">
                            {money(lineAmount(line.qty, line.price))}
                          </div>
                        </div>
                      </div>

                      {line.itemCode && (
                        <div className="mt-2 text-xs">
                          {found.source === "dealer" && (
                            <span className="text-good">
                              Their own price, set {found.from}
                            </span>
                          )}
                          {found.source === "list" && (
                            <span className="text-warn">
                              No price set for this dealer — using the list price
                            </span>
                          )}
                          {found.source === "none" && (
                            <span className="text-bad">
                              No price anywhere for this item. Type one, or set it on Price lists.
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <Field label="Note">
              <textarea className={`${inputCls} h-20`} value={editing.note ?? ""}
                onChange={(e) => setEditing({ ...editing, note: e.target.value || null })} />
            </Field>
            {editing.id && editing.source && editing.source !== "erp" && (
              <Field label="Message to the dealer (optional)"
                hint="Shown on the portal with this change — the dealer sees new quantities and status there anyway.">
                <textarea className={`${inputCls} h-20`} maxLength={500} value={editing.dealerMessage ?? ""}
                  placeholder="Only 20 egg tofu left today — sending 20 instead of 30."
                  onChange={(e) => setEditing({ ...editing, dealerMessage: e.target.value || null })} />
              </Field>
            )}
          </div>
        )}
      </Drawer>
    </>
  );
}
