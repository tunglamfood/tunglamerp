"use client";
// The order form, on screen and on paper.
//
// The same grid serves three people, so nothing is hidden behind a tab: packing
// reads an outlet's column, manufacturing reads the Total column, the office
// reads the money line at the foot. The batch column is deliberately last and
// deliberately empty — it is filled in after the packing is done, not before.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Btn, Card, Chip, Notice, Select } from "@/components/ui";
import { PrintButton } from "@/components/print-button";
import {
  SheetOutlet, SheetRow, buildRows, itemQty, priceOf, rowsToBatches, rowsToLines,
  sheetTotals, sheetWarnings,
} from "@/lib/sheet";
import { Customer, CustomerGroup, PriceRow, Product, SalesOrder } from "@/lib/types";

const money = (n: number) =>
  n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const today = () => new Date().toISOString().slice(0, 10);

/** 07/09 (MON) — how the office heads the sheet. */
function deliveryLabel(date: string): string {
  const d = new Date(`${date}T00:00:00`);
  if (Number.isNaN(d.getTime())) return date;
  const day = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"][d.getDay()];
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")} (${day})`;
}

/** SNW, SMY — the short heading, taken from the tail of the Million name. */
function shortOf(c: Customer): string {
  const m = c.name.match(/\b(?:ST\s+)?([A-Z]{2,6})\s*$/);
  if (m && m[1] !== "SDN" && m[1] !== "BHD") return m[1];
  const inside = c.name.match(/\(([^)]{2,20})\)/);
  return (inside ? inside[1] : c.shortName || c.code).trim().slice(0, 12).toUpperCase();
}

export function SheetScreen({
  groups, products,
}: {
  groups: CustomerGroup[];
  products: Product[];
}) {
  const [groupCode, setGroupCode] = useState(groups[0]?.code ?? "");
  const [deliverOn, setDeliverOn] = useState(today());
  const [order, setOrder] = useState<SalesOrder | null>(null);
  const [outlets, setOutlets] = useState<SheetOutlet[]>([]);
  const [prices, setPrices] = useState<PriceRow[]>([]);
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [rows, setRows] = useState<SheetRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [adding, setAdding] = useState("");
  const cellRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const group = groups.find((g) => g.code === groupCode);

  const load = useCallback(async (code: string, date: string) => {
    if (!code) return;
    setBusy(true);
    setProblem(null);
    setSavedAt(null);
    try {
      const res = await fetch(`/api/sales/sheet?group=${encodeURIComponent(code)}&date=${date}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not open the sheet.");
      const v = body.value;
      const cols: SheetOutlet[] = (v.outlets as Customer[]).map((c) => ({
        code: c.code, short: shortOf(c), name: c.shortName || c.name,
      }));
      setOrder(v.order);
      setOutlets(cols);
      setPrices(v.prices ?? []);
      setLabels(v.aliases ?? {});
      setRows(buildRows({
        lines: v.order?.lines ?? [],
        products,
        prices: v.prices ?? [],
        batches: v.order?.batches ?? [],
        owner: { groupCode: code },
        onDate: date,
        labels: v.aliases ?? {},
      }));
    } catch (e) {
      setProblem((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [products]);

  useEffect(() => {
    let alive = true;
    void (async () => {
      if (!alive) return;
      await load(groupCode, deliverOn);
    })();
    return () => {
      alive = false;
    };
  }, [groupCode, deliverOn, load]);

  const totals = useMemo(() => sheetTotals(rows, outlets), [rows, outlets]);
  const warnings = useMemo(() => sheetWarnings(rows, totals), [rows, totals]);

  const chosen = new Set(rows.map((r) => r.itemCode));
  const available = products.filter((p) => p.active && !chosen.has(p.itemCode));

  function addItem(itemCode: string) {
    if (!itemCode || chosen.has(itemCode)) return;
    const p = products.find((x) => x.itemCode === itemCode);
    setRows((all) => [...all, {
      itemCode,
      label: labels[itemCode] ?? p?.description ?? itemCode,
      packSize: p?.packSize ?? "",
      uom: p?.uom ?? "BAG",
      price: priceOf({ groupCode }, p, prices, deliverOn),
      qty: {},
      batchCode: "",
      batchConfirmed: false,
    }]);
    setSavedAt(null);
    setAdding("");
  }

  function setQty(i: number, outlet: string, raw: string) {
    const n = raw.trim() === "" ? 0 : Number(raw);
    if (!Number.isFinite(n) || n < 0) return;
    setRows((all) => all.map((r, x) => (x === i ? { ...r, qty: { ...r.qty, [outlet]: n } } : r)));
    setSavedAt(null);
  }

  function setRow(i: number, patch: Partial<SheetRow>) {
    setRows((all) => all.map((r, x) => (x === i ? { ...r, ...patch } : r)));
    setSavedAt(null);
  }

  /** Down and up walk a column; left and right cross between outlets. */
  function onCellKey(e: React.KeyboardEvent, i: number, col: number) {
    const go = (r: number, c: number) => {
      const box = cellRefs.current[`${r}:${c}`];
      if (!box) return false;
      box.focus();
      box.select();
      return true;
    };
    if (e.key === "Enter" || e.key === "ArrowDown") { e.preventDefault(); go(i + 1, col); }
    else if (e.key === "ArrowUp") { e.preventDefault(); go(i - 1, col); }
    else if (e.key === "ArrowRight") { e.preventDefault(); go(i, col + 1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); go(i, col - 1); }
  }

  async function save() {
    if (!order) return;
    setBusy(true);
    setProblem(null);
    try {
      const res = await fetch("/api/sales/sheet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderNo: order.orderNo,
          groupCode,
          orderDate: order.orderDate,
          deliverOn,
          status: order.status,
          lines: rowsToLines(rows, outlets),
          batches: rowsToBatches(rows),
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not save the sheet.");
      setSavedAt(new Date().toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit" }));
    } catch (e) {
      setProblem((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const cell = "w-[62px] rounded-lg border border-line px-1.5 py-1 text-sm nums text-center";

  return (
    <>
      {/* ── what sheet this is ─────────────────────────────────────────────── */}
      <div className="mb-4 flex flex-wrap items-end gap-3 no-print">
        <div className="min-w-[240px]">
          <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-faint">
            Customer
          </div>
          <Select
            value={groupCode}
            onChange={setGroupCode}
            searchable
            placeholder="Choose a customer"
            options={groups.map((g) => ({ value: g.code, label: g.name }))}
          />
        </div>
        <div>
          <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-faint">
            Delivery on
          </div>
          <input
            type="date"
            className="h-[42px] rounded-xl border border-line bg-white px-3 text-sm"
            value={deliverOn}
            onChange={(e) => setDeliverOn(e.target.value)}
          />
        </div>
        <div className="flex-1" />
        <Btn onClick={() => void save()} disabled={busy || rows.length === 0}>
          {busy ? "Working…" : "Save"}
        </Btn>
        <PrintButton />
      </div>

      {savedAt && (
        <div className="mb-3 text-[12px] font-semibold text-good no-print">Saved at {savedAt}</div>
      )}
      {problem && <div className="mb-4 no-print"><Notice tone="bad">{problem}</Notice></div>}
      {warnings.length > 0 && (
        <div className="mb-4 space-y-2 no-print">
          {warnings.map((w) => <Notice key={w} tone="warn">{w}</Notice>)}
        </div>
      )}

      {/* ── the sheet ──────────────────────────────────────────────────────── */}
      <Card className="overflow-hidden print:border-0">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <div className="text-2xl font-extrabold tracking-tight">
              {group?.name ?? "Order form"}
            </div>
            <div className="text-sm text-mute">Order form · {order?.orderNo ?? ""}</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-faint">
              Delivery on
            </div>
            <div className="nums text-lg font-extrabold">{deliveryLabel(deliverOn)}</div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-gray-50/70 text-left text-[10px] font-bold uppercase tracking-[0.1em] text-faint">
                <th className="px-3 py-2.5">No.</th>
                <th className="px-3 py-2.5">Item description</th>
                <th className="px-3 py-2.5">Pack size</th>
                {outlets.map((o) => (
                  <th key={o.code} className="px-2 py-2.5 text-center" title={o.name}>
                    {o.short}
                  </th>
                ))}
                <th className="px-3 py-2.5 text-center">Total qty</th>
                <th className="px-3 py-2.5"></th>
                <th className="px-3 py-2.5">Batch code</th>
                <th className="px-3 py-2.5 no-print"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.itemCode} className="border-b border-line last:border-0">
                  <td className="nums px-3 py-1.5 text-mute">{i + 1}</td>
                  <td className="px-3 py-1.5 font-semibold">
                    {r.label}
                    {r.price === 0 && (
                      <span className="ml-2 text-[11px] font-normal text-warn">no price</span>
                    )}
                  </td>
                  <td className="nums px-3 py-1.5 text-mute">{r.packSize || "—"}</td>
                  {outlets.map((o, c) => (
                    <td key={o.code} className="px-2 py-1.5 text-center">
                      <input
                        ref={(el) => { cellRefs.current[`${i}:${c}`] = el; }}
                        className={cell}
                        value={r.qty[o.code] ? String(r.qty[o.code]) : ""}
                        onChange={(e) => setQty(i, o.code, e.target.value)}
                        onKeyDown={(e) => onCellKey(e, i, c)}
                        onFocus={(e) => e.currentTarget.select()}
                        inputMode="numeric"
                      />
                    </td>
                  ))}
                  <td className="nums px-3 py-1.5 text-center font-extrabold">
                    {itemQty(r) || ""}
                  </td>
                  <td className="px-3 py-1.5 text-[11px] text-mute">{r.uom}</td>
                  <td className="px-3 py-1.5">
                    <input
                      className="w-[110px] rounded-lg border border-line px-2 py-1 text-sm nums"
                      value={r.batchCode}
                      onChange={(e) => setRow(i, { batchCode: e.target.value })}
                      placeholder="after packing"
                    />
                  </td>
                  <td className="px-3 py-1.5 no-print">
                    <button
                      onClick={() => setRows((all) => all.filter((_, x) => x !== i))}
                      className="text-[12px] font-semibold text-faint hover:text-bad"
                      title="Take this item off the sheet"
                    >
                      remove
                    </button>
                  </td>
                </tr>
              ))}

              {rows.length === 0 && (
                <tr>
                  <td colSpan={outlets.length + 7} className="px-5 py-10 text-center text-sm text-mute">
                    {busy ? "Opening…" : "Nothing on this sheet yet. Add the first item below."}
                  </td>
                </tr>
              )}
            </tbody>

            {rows.length > 0 && (
              <tfoot className="border-t-2 border-line bg-gray-50/70">
                <tr>
                  <td colSpan={3} className="px-3 py-2.5 text-right text-[10px] font-bold uppercase tracking-[0.1em] text-faint">
                    Bags
                  </td>
                  {outlets.map((o) => (
                    <td key={o.code} className="nums px-2 py-2.5 text-center font-extrabold">
                      {totals.perOutlet[o.code]?.qty || ""}
                    </td>
                  ))}
                  <td className="nums px-3 py-2.5 text-center font-extrabold">{totals.qty}</td>
                  <td colSpan={3}></td>
                </tr>
                <tr>
                  <td colSpan={3} className="px-3 py-2.5 text-right text-[10px] font-bold uppercase tracking-[0.1em] text-faint">
                    Amount (RM)
                  </td>
                  {outlets.map((o) => (
                    <td key={o.code} className="nums px-2 py-2.5 text-center font-semibold">
                      {totals.perOutlet[o.code]?.amount
                        ? money(totals.perOutlet[o.code].amount)
                        : ""}
                    </td>
                  ))}
                  <td className="nums px-3 py-2.5 text-center font-extrabold">
                    {totals.amount ? money(totals.amount) : ""}
                  </td>
                  <td colSpan={3}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* ── adding an item ───────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-end gap-3 border-t border-line px-5 py-4 no-print">
          <div className="min-w-[320px] flex-1">
            <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-faint">
              Add an item
            </div>
            <Select
              value={adding}
              onChange={addItem}
              searchable
              placeholder="Search by name or code"
              options={available.map((p) => ({
                value: p.itemCode,
                label: labels[p.itemCode] ? `${labels[p.itemCode]} — ${p.description}` : p.description,
                note: p.itemCode,
              }))}
            />
          </div>
          <Chip>{rows.length} items</Chip>
          <Chip>{outlets.length} outlets</Chip>
        </div>
      </Card>

      <p className="mt-3 text-[11px] leading-relaxed text-faint no-print">
        The <strong>Total qty</strong> column is what manufacturing makes. Each outlet&rsquo;s
        column is what packing puts on that lorry. The <strong>Amount</strong> line is what the
        office checks against that outlet&rsquo;s invoice. <strong>Batch codes</strong> are filled
        in after packing, not before.
      </p>
    </>
  );
}
