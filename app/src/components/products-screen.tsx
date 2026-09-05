"use client";
import { Chip, Combobox, Field, inputCls } from "@/components/ui";
import { Column, RecordScreen } from "@/components/record-screen";
import { post } from "@/lib/api";
import { Customer, PriceRow, Product } from "@/lib/types";
import { pricesForItem } from "@/lib/pricing";

const money = (n: number) => n.toFixed(2);

export function ProductsScreen({
  products,
  prices,
  customers,
}: {
  products: Product[];
  prices: PriceRow[];
  customers: Customer[];
}) {
  const groups = [...new Set(products.map((p) => p.itemGroup).filter(Boolean))].sort();
  const uoms = [...new Set(products.map((p) => p.uom).filter(Boolean))].sort();
  const types = [...new Set(products.map((p) => p.itemType).filter(Boolean))].sort();
  const nameOf = new Map(customers.map((c) => [c.code, c.shortName || c.name]));

  /** How many dealers have their own price for this item. */
  const dealerCount = new Map<string, number>();
  for (const row of prices) {
    const seen = `${row.itemCode}|${row.customerCode}`;
    if (!dealerCount.has(seen)) dealerCount.set(seen, 1);
  }
  const dealersFor = (itemCode: string) =>
    new Set(prices.filter((p) => p.itemCode === itemCode).map((p) => p.customerCode)).size;

  const columns: Column<Product>[] = [
    {
      key: "code",
      head: "Item code",
      cell: (p) => <span className="nums font-semibold">{p.itemCode}</span>,
    },
    {
      key: "desc",
      head: "Description",
      cell: (p) => (
        <div>
          <div className="font-medium">{p.description}</div>
          {p.packSize && <div className="text-xs text-mute">{p.packSize}</div>}
        </div>
      ),
    },
    { key: "group", head: "Group", cell: (p) => <span className="text-mute">{p.itemGroup || "—"}</span> },
    { key: "uom", head: "Unit", cell: (p) => <span className="text-mute">{p.uom || "—"}</span> },
    { key: "cost", head: "Cost", num: true, cell: (p) => money(p.cost) },
    {
      key: "price",
      head: "List price",
      num: true,
      cell: (p) => (p.basePrice > 0 ? money(p.basePrice) : <span className="text-faint">not set</span>),
    },
    {
      key: "dealers",
      head: "Dealer prices",
      num: true,
      cell: (p) => {
        const n = dealersFor(p.itemCode);
        return n === 0 ? <span className="text-faint">none</span> : <Chip tone="blue">{n}</Chip>;
      },
    },
    {
      key: "active",
      head: "",
      cell: (p) => (p.active ? null : <Chip>Stopped</Chip>),
    },
  ];

  return (
    <RecordScreen<Product>
      title="Products"
      sub={
        <span className="nums">
          {products.length} items · {products.filter((p) => p.active).length} still sold
        </span>
      }
      rows={products}
      columns={columns}
      searchIn={(p) => `${p.itemCode} ${p.description} ${p.barcode ?? ""} ${p.itemGroup} ${p.itemType} ${p.packSize}`}
      empty="No products yet. Add one, or run scripts/import-sales.mjs to bring in the Million SKU list."
      addLabel="Add product"
      filters={[
        {
          key: "group",
          width: "w-[160px]",
          options: [
            { value: "all", label: "All groups" },
            ...groups.map((g) => ({
              value: g, label: g, note: String(products.filter((p) => p.itemGroup === g).length),
            })),
          ],
          match: (row, v) => (row as Product).itemGroup === v,
        },
        {
          key: "active",
          width: "w-[136px]",
          options: [
            { value: "all", label: "Everything" },
            { value: "yes", label: "Still sold" },
            { value: "no", label: "Stopped" },
          ],
          match: (row, v) => (row as Product).active === (v === "yes"),
        },
        {
          key: "priced",
          width: "w-[168px]",
          options: [
            { value: "all", label: "Any price" },
            { value: "dealer", label: "Has dealer prices" },
            { value: "none", label: "No price at all" },
          ],
          match: (row, v) => {
            const p = row as Product;
            const n = dealersFor(p.itemCode);
            return v === "dealer" ? n > 0 : n === 0 && p.basePrice === 0;
          },
        },
      ]}
      newRow={() => ({
        itemCode: "", description: "", barcode: null, itemGroup: "", itemType: "",
        uom: "", packSize: "", basePrice: 0, cost: 0, active: true,
      })}
      editTitle={(p, isNew) => (isNew ? "New product" : p.itemCode)}
      editSub={(p, isNew) => (isNew ? "Add an item to the SKU list" : p.description)}
      canSave={(p) =>
        !p.itemCode ? "An item code is needed" : !p.description ? "A description is needed" : null
      }
      onSave={(p) => post("/api/sales/products", p)}
      form={(p, set) => {
        const mine = pricesForItem(p.itemCode, prices);
        return (
          <>
            <Field label="Item code" hint="As Million knows it, like AD120">
              <input className={inputCls} value={p.itemCode} placeholder="AD120"
                onChange={(e) => set({ ...p, itemCode: e.target.value.toUpperCase() })} />
            </Field>
            <Field label="Description">
              <input className={inputCls} value={p.description} placeholder="EGG TOFU - AD120GM"
                onChange={(e) => set({ ...p, description: e.target.value })} />
            </Field>
            <Field label="Pack size" hint="However the office says it — 12 x 120GM, 1KG x 10">
              <input className={inputCls} value={p.packSize} placeholder="12 x 120GM"
                onChange={(e) => set({ ...p, packSize: e.target.value })} />
            </Field>
            <Field label="Barcode">
              <input className={inputCls} value={p.barcode ?? ""} placeholder="9555452 100460"
                onChange={(e) => set({ ...p, barcode: e.target.value || null })} />
            </Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Group">
                <Combobox value={p.itemGroup} options={groups} addLabel="Add a group…"
                  placeholder="KB" onChange={(v) => set({ ...p, itemGroup: v })} />
              </Field>
              <Field label="Type">
                <Combobox value={p.itemType} options={types} addLabel="Add a type…"
                  placeholder="TOFU" onChange={(v) => set({ ...p, itemType: v })} />
              </Field>
            </div>
            <div className="grid gap-5 sm:grid-cols-3">
              <Field label="Unit">
                <Combobox value={p.uom} options={uoms} addLabel="Add a unit…"
                  placeholder="PKT" onChange={(v) => set({ ...p, uom: v })} />
              </Field>
              <Field label="Cost">
                <input className={`${inputCls} nums`} value={String(p.cost)} inputMode="decimal"
                  onChange={(e) => set({ ...p, cost: Number(e.target.value) || 0 })} />
              </Field>
              <Field label="List price" hint="Used when a dealer has no price of their own.">
                <input className={`${inputCls} nums`} value={String(p.basePrice)} inputMode="decimal"
                  onChange={(e) => set({ ...p, basePrice: Number(e.target.value) || 0 })} />
              </Field>
            </div>

            {mine.length > 0 && (
              <div>
                <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.1em] text-faint">
                  What each dealer pays
                </div>
                <div className="overflow-hidden rounded-xl border border-line">
                  <table className="w-full text-sm">
                    <tbody>
                      {mine.slice(0, 12).map((row) => (
                        <tr key={row.id} className="border-b border-line last:border-0">
                          <td className="px-3 py-2">{nameOf.get(row.customerCode) ?? row.customerCode}</td>
                          <td className="nums px-3 py-2 text-right font-semibold">{money(row.price)}</td>
                          <td className="nums px-3 py-2 text-right text-xs text-faint">
                            from {row.effectiveFrom}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-2 text-xs text-mute">
                  Change these on the Price lists screen, where you can see one dealer at a time.
                </p>
              </div>
            )}

            <Field label="Still sold?">
              <div className="flex gap-2">
                <button type="button" onClick={() => set({ ...p, active: true })}
                  className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
                    p.active ? "bg-accent text-white" : "border border-line bg-white text-mute"
                  }`}>
                  Yes
                </button>
                <button type="button" onClick={() => set({ ...p, active: false })}
                  className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
                    !p.active ? "bg-accent text-white" : "border border-line bg-white text-mute"
                  }`}>
                  No
                </button>
              </div>
            </Field>
          </>
        );
      }}
    />
  );
}
