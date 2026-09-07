"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Btn, Card, Chip, Drawer, Field, Notice, PageHeader, Select, inputCls } from "@/components/ui";
import { post, remove } from "@/lib/api";
import { Customer, OrderLine, OrderStatus, PriceRow, Product, SalesOrder } from "@/lib/types";
import { lineAmount, nextOrderNo, orderTotal, priceFor } from "@/lib/pricing";

const money = (n: number) => n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const today = () => new Date().toISOString().slice(0, 10);

const STATUS: { value: OrderStatus; label: string; tone: "gray" | "blue" | "teal" | "red" }[] = [
  { value: "draft", label: "Draft", tone: "gray" },
  { value: "confirmed", label: "Confirmed", tone: "blue" },
  { value: "delivered", label: "Delivered", tone: "teal" },
  { value: "cancelled", label: "Cancelled", tone: "red" },
];

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
    const found = priceFor(order.customerCode ?? "", item, prices, order.orderDate);
    const lines = [...order.lines];
    lines[index] = {
      ...lines[index],
      itemCode,
      uom: item?.uom ?? lines[index].uom,
      price: found.price,
    };
    return { ...order, lines };
  }

  /** Changing the customer or the date re-prices every line for them. */
  function reprice(order: SalesOrder): SalesOrder {
    return {
      ...order,
      lines: order.lines.map((l) => {
        if (!l.itemCode) return l;
        const found = priceFor(order.customerCode ?? "", productOf.get(l.itemCode), prices, order.orderDate);
        return { ...l, price: found.price };
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

  const total = editing ? orderTotal(editing.lines) : 0;

  return (
    <>
      <PageHeader
        title="Sales orders"
        sub={<span className="nums">{orders.length} orders</span>}
        right={<Btn onClick={startNew}>New order</Btn>}
      />

      {problem && !editing && <div className="mb-4"><Notice tone="bad">{problem}</Notice></div>}

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
                const s = STATUS.find((x) => x.value === o.status)!;
                return (
                  <tr key={o.orderNo}
                    onClick={() => { setEditing(o); setIsNew(false); setProblem(null); }}
                    className="cursor-pointer border-b border-line last:border-0 hover:bg-accent-soft/40">
                    <td className="nums px-4 py-2.5 font-semibold">{o.orderNo}</td>
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
                    <td className="px-4 py-2.5"><Chip tone={s.tone}>{s.label}</Chip></td>
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
                  const found = priceFor(editing.customerCode ?? "", item, prices, editing.orderDate);
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
                              lines[i] = { ...line, price: Number(e.target.value) || 0 };
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
          </div>
        )}
      </Drawer>
    </>
  );
}
