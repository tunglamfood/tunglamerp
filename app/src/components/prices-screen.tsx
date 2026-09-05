"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Btn, Card, Chip, Drawer, Field, Notice, PageHeader, Select, inputCls } from "@/components/ui";
import { post, remove } from "@/lib/api";
import { Customer, PriceRow, Product } from "@/lib/types";
import { currentListFor } from "@/lib/pricing";

const money = (n: number) => n.toFixed(2);
const today = () => new Date().toISOString().slice(0, 10);

/**
 * One dealer's price list.
 *
 * The same product costs a different price to every dealer, and those prices
 * move. A change is never an overwrite — it is a new row with the date it
 * starts, so an order written last month keeps the price it was sold at, and
 * the history of what a dealer used to pay stays readable.
 */
export function PricesScreen({
  customers,
  products,
  prices,
}: {
  customers: Customer[];
  products: Product[];
  prices: PriceRow[];
}) {
  const router = useRouter();
  const selling = customers.filter((c) => c.active);
  const [customer, setCustomer] = useState(selling[0]?.code ?? "");
  const [search, setSearch] = useState("");
  const [only, setOnly] = useState<"all" | "set" | "unset">("all");
  const [editing, setEditing] = useState<PriceRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const current = useMemo(() => currentListFor(customer, prices, today()), [customer, prices]);
  const chosen = customers.find((c) => c.code === customer);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products
      .filter((p) => p.active)
      .filter((p) => {
        const has = current.has(p.itemCode);
        if (only === "set" && !has) return false;
        if (only === "unset" && has) return false;
        return !q || `${p.itemCode} ${p.description} ${p.packSize}`.toLowerCase().includes(q);
      });
  }, [products, current, search, only]);

  const history = useMemo(
    () =>
      editing
        ? prices
            .filter((p) => p.customerCode === customer && p.itemCode === editing.itemCode)
            .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))
        : [],
    [prices, customer, editing],
  );

  async function save() {
    if (!editing) return;
    setBusy(true);
    setProblem(null);
    const res = await post("/api/sales/prices", editing);
    setBusy(false);
    if (res.error) return setProblem(res.error);
    setEditing(null);
    router.refresh();
  }

  async function drop(id: number) {
    setBusy(true);
    setProblem(null);
    const res = await remove(`/api/sales/prices?id=${id}`);
    setBusy(false);
    if (res.error) return setProblem(res.error);
    router.refresh();
  }

  const setCount = current.size;

  return (
    <>
      <PageHeader
        title="Price lists"
        sub={
          <span className="nums">
            {setCount} of {products.filter((p) => p.active).length} products priced for this dealer
          </span>
        }
      />

      {problem && !editing && <div className="mb-4"><Notice tone="bad">{problem}</Notice></div>}

      <Card className="mb-4 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[280px] flex-1">
            <div className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-faint">
              Whose prices are you looking at?
            </div>
            <Select
              value={customer}
              onChange={setCustomer}
              searchable
              placeholder="Choose a customer"
              options={selling.map((c) => ({
                value: c.code,
                label: c.shortName || c.name,
                note: c.state || undefined,
              }))}
            />
          </div>
          {chosen && (
            <div className="pb-2 text-sm text-mute">
              <span className="nums font-semibold text-ink">{chosen.code}</span>
              {chosen.state && ` · ${chosen.state}`}
            </div>
          )}
        </div>
      </Card>

      {!customer ? (
        <Notice tone="info">Choose a customer above to see and change their prices.</Notice>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="relative min-w-[220px] flex-1">
              <input
                className={`${inputCls}`}
                placeholder="Search a product code or description…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select
              className="w-[190px]"
              value={only}
              onChange={(v) => setOnly(v as typeof only)}
              options={[
                { value: "all", label: "All products", note: String(products.filter((p) => p.active).length) },
                { value: "set", label: "Has a price", note: String(setCount) },
                { value: "unset", label: "No price yet", note: String(products.filter((p) => p.active).length - setCount) },
              ]}
            />
          </div>

          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line bg-gray-50/70 text-left text-[10px] font-bold uppercase tracking-[0.1em] text-faint">
                    <th className="px-4 py-2.5">Item</th>
                    <th className="px-4 py-2.5">Description</th>
                    <th className="px-4 py-2.5">Unit</th>
                    <th className="px-4 py-2.5 text-right">Cost</th>
                    <th className="px-4 py-2.5 text-right">List</th>
                    <th className="px-4 py-2.5 text-right">This dealer pays</th>
                    <th className="px-4 py-2.5">From</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p) => {
                    const row = current.get(p.itemCode);
                    const margin = row ? row.price - p.cost : null;
                    return (
                      <tr
                        key={p.itemCode}
                        onClick={() =>
                          setEditing(
                            row
                              ? { ...row, effectiveFrom: today() }
                              : {
                                  customerCode: customer,
                                  itemCode: p.itemCode,
                                  price: p.basePrice,
                                  effectiveFrom: today(),
                                  note: null,
                                },
                          )
                        }
                        className="cursor-pointer border-b border-line last:border-0 hover:bg-accent-soft/40"
                      >
                        <td className="nums px-4 py-2.5 font-semibold">{p.itemCode}</td>
                        <td className="px-4 py-2.5">
                          <div>{p.description}</div>
                          {p.packSize && <div className="text-xs text-mute">{p.packSize}</div>}
                        </td>
                        <td className="px-4 py-2.5 text-mute">{p.uom}</td>
                        <td className="nums px-4 py-2.5 text-right text-mute">{money(p.cost)}</td>
                        <td className="nums px-4 py-2.5 text-right text-faint">
                          {p.basePrice > 0 ? money(p.basePrice) : "—"}
                        </td>
                        <td className="nums px-4 py-2.5 text-right">
                          {row ? (
                            <span className="font-bold">{money(row.price)}</span>
                          ) : (
                            <span className="text-faint">not set</span>
                          )}
                          {margin != null && margin < 0 && (
                            <div className="text-[11px] font-semibold text-bad">below cost</div>
                          )}
                        </td>
                        <td className="nums px-4 py-2.5 text-xs text-faint">
                          {row?.effectiveFrom ?? ""}
                        </td>
                      </tr>
                    );
                  })}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-mute">
                        Nothing matches that.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      <Drawer
        open={editing !== null}
        title={editing ? `Price for ${editing.itemCode}` : ""}
        sub={chosen ? (chosen.shortName || chosen.name) : undefined}
        onClose={() => setEditing(null)}
        footer={
          <>
            <Btn onClick={() => void save()} disabled={busy}>
              {busy ? "Saving…" : "Save this price"}
            </Btn>
            <Btn kind="ghost" onClick={() => setEditing(null)} disabled={busy}>Cancel</Btn>
            <span className="ml-auto text-xs text-faint">Esc to close</span>
          </>
        }
      >
        {problem && <div className="mb-4"><Notice tone="bad">{problem}</Notice></div>}
        {editing && (
          <div className="space-y-5">
            <div className="rounded-xl border border-line bg-gray-50/70 p-4 text-sm">
              <div className="font-semibold">
                {products.find((p) => p.itemCode === editing.itemCode)?.description}
              </div>
              <div className="nums mt-1 text-mute">
                Costs us {money(products.find((p) => p.itemCode === editing.itemCode)?.cost ?? 0)}
                {editing.price > 0 && (
                  <> · margin {money(editing.price - (products.find((p) => p.itemCode === editing.itemCode)?.cost ?? 0))}</>
                )}
              </div>
            </div>

            <Field label="Price for this dealer">
              <input className={`${inputCls} nums text-lg font-bold`} inputMode="decimal"
                value={String(editing.price)}
                onChange={(e) => setEditing({ ...editing, price: Number(e.target.value) || 0 })} />
            </Field>

            <Field label="From which date"
              hint="Orders written before this date keep the price they were sold at.">
              <input type="date" className={`${inputCls} nums`} value={editing.effectiveFrom}
                onChange={(e) => setEditing({ ...editing, effectiveFrom: e.target.value })} />
            </Field>

            <Field label="Why it changed" hint="Optional, but it saves an argument later.">
              <input className={inputCls} value={editing.note ?? ""} placeholder="Raw material up"
                onChange={(e) => setEditing({ ...editing, note: e.target.value || null })} />
            </Field>

            {history.length > 0 && (
              <div>
                <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.1em] text-faint">
                  What they have paid before
                </div>
                <div className="overflow-hidden rounded-xl border border-line">
                  <table className="w-full text-sm">
                    <tbody>
                      {history.map((h, i) => (
                        <tr key={h.id} className="border-b border-line last:border-0">
                          <td className="nums px-3 py-2 font-semibold">{money(h.price)}</td>
                          <td className="nums px-3 py-2 text-xs text-mute">from {h.effectiveFrom}</td>
                          <td className="px-3 py-2 text-xs text-mute">{h.note}</td>
                          <td className="px-3 py-2 text-right">
                            {i === 0 && <Chip tone="teal">in force</Chip>}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {h.id && (
                              <button onClick={() => void drop(h.id!)} disabled={busy}
                                className="text-xs font-semibold text-bad hover:underline">
                                Remove
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </Drawer>
    </>
  );
}
