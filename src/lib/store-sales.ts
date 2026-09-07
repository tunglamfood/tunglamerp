// Customers, products, dealer prices and sales orders.
import "server-only";
import { serverSupabase } from "./supabase-server";
import {
  Customer, OrderLine, PriceRow, Product, SalesOrder, OrderStatus,
} from "./types";

function fail(what: string, error: { message: string } | null): void {
  if (error) throw new Error(`${what}: ${error.message}`);
}

/* ── Customers ────────────────────────────────────────────────────────────── */

type CustomerRow = {
  code: string; name: string; short_name: string; state: string;
  address: string | null; contact: string | null; email: string | null;
  attn: string | null; income_taxno: string | null; active: boolean;
};

const toCustomer = (r: CustomerRow): Customer => ({
  code: r.code, name: r.name, shortName: r.short_name, state: r.state,
  address: r.address, contact: r.contact, email: r.email, attn: r.attn,
  incomeTaxNo: r.income_taxno, active: r.active,
});

export async function listCustomers(): Promise<Customer[]> {
  const { data, error } = await serverSupabase()
    .from("sales_customers").select("*").order("code");
  fail("Could not load the customer list", error);
  return ((data ?? []) as CustomerRow[]).map(toCustomer);
}

export async function upsertCustomer(c: Customer): Promise<void> {
  const { error } = await serverSupabase().from("sales_customers").upsert(
    {
      code: c.code, name: c.name, short_name: c.shortName, state: c.state,
      address: c.address, contact: c.contact, email: c.email, attn: c.attn,
      income_taxno: c.incomeTaxNo, active: c.active,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "code" },
  );
  fail(`Could not save ${c.name}`, error);
}

/* ── Products ─────────────────────────────────────────────────────────────── */

type ProductRow = {
  item_code: string; description: string; barcode: string | null;
  item_group: string; item_type: string; uom: string; pack_size: string;
  base_price: number; cost: number; active: boolean;
};

const toProduct = (r: ProductRow): Product => ({
  itemCode: r.item_code, description: r.description, barcode: r.barcode,
  itemGroup: r.item_group, itemType: r.item_type, uom: r.uom,
  packSize: r.pack_size, basePrice: Number(r.base_price), cost: Number(r.cost),
  active: r.active,
});

export async function listProducts(): Promise<Product[]> {
  const { data, error } = await serverSupabase()
    .from("sales_products").select("*").order("item_code");
  fail("Could not load the product list", error);
  return ((data ?? []) as ProductRow[]).map(toProduct);
}

export async function upsertProduct(p: Product): Promise<void> {
  const { error } = await serverSupabase().from("sales_products").upsert(
    {
      item_code: p.itemCode, description: p.description, barcode: p.barcode,
      item_group: p.itemGroup, item_type: p.itemType, uom: p.uom,
      pack_size: p.packSize, base_price: p.basePrice, cost: p.cost,
      active: p.active, updated_at: new Date().toISOString(),
    },
    { onConflict: "item_code" },
  );
  fail(`Could not save ${p.itemCode}`, error);
}

/* ── Dealer prices ────────────────────────────────────────────────────────── */

type PriceDbRow = {
  id: number; customer_code: string; item_code: string;
  price: number; effective_from: string; note: string | null;
};

const toPrice = (r: PriceDbRow): PriceRow => ({
  id: r.id, customerCode: r.customer_code, itemCode: r.item_code,
  price: Number(r.price), effectiveFrom: r.effective_from, note: r.note,
});

export async function listPrices(customerCode?: string): Promise<PriceRow[]> {
  let q = serverSupabase().from("sales_prices").select("*");
  if (customerCode) q = q.eq("customer_code", customerCode);
  const { data, error } = await q.order("effective_from", { ascending: false });
  fail("Could not load the price list", error);
  return ((data ?? []) as PriceDbRow[]).map(toPrice);
}

/**
 * A price change is a new dated row, not an overwrite — an order written last
 * month must keep the price it was actually sold at. Setting a price twice on
 * the same day corrects that day rather than stacking up.
 */
export async function setPrice(row: PriceRow): Promise<void> {
  const { error } = await serverSupabase().from("sales_prices").upsert(
    {
      customer_code: row.customerCode, item_code: row.itemCode,
      price: row.price, effective_from: row.effectiveFrom, note: row.note,
    },
    { onConflict: "customer_code,item_code,effective_from" },
  );
  fail("Could not save that price", error);
}

export async function deletePrice(id: number): Promise<void> {
  const { error } = await serverSupabase().from("sales_prices").delete().eq("id", id);
  fail("Could not remove that price", error);
}

/* ── Sales orders ─────────────────────────────────────────────────────────── */

type OrderRow = {
  id: number; order_no: string; customer_code: string; order_date: string;
  deliver_on: string | null; status: string; their_ref: string | null; note: string | null;
};
type LineRow = {
  id: number; order_id: number; line_no: number; item_code: string;
  qty: number; uom: string; price: number; note: string | null;
};

export async function listOrders(limit = 200): Promise<SalesOrder[]> {
  const db = serverSupabase();
  const { data, error } = await db
    .from("sales_orders").select("*").order("order_date", { ascending: false }).limit(limit);
  fail("Could not load the orders", error);
  const orders = (data ?? []) as OrderRow[];
  if (orders.length === 0) return [];

  const { data: lineData, error: lineError } = await db
    .from("sales_order_lines").select("*")
    .in("order_id", orders.map((o) => o.id)).order("line_no");
  fail("Could not load the order lines", lineError);

  const byOrder = new Map<number, OrderLine[]>();
  for (const l of (lineData ?? []) as LineRow[]) {
    if (!byOrder.has(l.order_id)) byOrder.set(l.order_id, []);
    byOrder.get(l.order_id)!.push({
      id: l.id, lineNo: l.line_no, itemCode: l.item_code,
      qty: Number(l.qty), uom: l.uom, price: Number(l.price), note: l.note,
    });
  }

  return orders.map((o) => ({
    id: o.id, orderNo: o.order_no, customerCode: o.customer_code,
    orderDate: o.order_date, deliverOn: o.deliver_on,
    status: o.status as OrderStatus, theirRef: o.their_ref, note: o.note,
    lines: byOrder.get(o.id) ?? [],
  }));
}

/** Saves the order and replaces its lines wholesale — simpler than diffing, and
 *  an order is never big enough for that to matter. */
export async function saveOrder(order: SalesOrder): Promise<number> {
  const db = serverSupabase();
  const head = {
    order_no: order.orderNo, customer_code: order.customerCode,
    order_date: order.orderDate, deliver_on: order.deliverOn,
    status: order.status, their_ref: order.theirRef, note: order.note,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await db
    .from("sales_orders").upsert(head, { onConflict: "order_no" }).select("id").single();
  fail("Could not save the order", error);
  const orderId = (data as { id: number }).id;

  const { error: wipe } = await db.from("sales_order_lines").delete().eq("order_id", orderId);
  fail("Could not clear the old order lines", wipe);

  const lines = order.lines.filter((l) => l.itemCode && l.qty > 0);
  if (lines.length > 0) {
    const { error: ins } = await db.from("sales_order_lines").insert(
      lines.map((l, i) => ({
        order_id: orderId, line_no: i + 1, item_code: l.itemCode,
        qty: l.qty, uom: l.uom, price: l.price, note: l.note,
      })),
    );
    fail("Could not save the order lines", ins);
  }
  return orderId;
}

export async function deleteOrder(id: number): Promise<void> {
  const { error } = await serverSupabase().from("sales_orders").delete().eq("id", id);
  fail("Could not remove that order", error);
}
