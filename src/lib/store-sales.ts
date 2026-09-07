// Customers, products, dealer prices and sales orders.
import "server-only";
import { serverSupabase } from "./supabase-server";
import { fail } from "./db-error";
import {
  Customer, CustomerGroup, OrderBatch, OrderLine, PriceRow, Product, SalesOrder,
  OrderStatus,
} from "./types";

/* ── Customers ────────────────────────────────────────────────────────────── */

type CustomerRow = {
  code: string; name: string; short_name: string; state: string;
  address: string | null; contact: string | null; email: string | null;
  attn: string | null; income_taxno: string | null; active: boolean;
  group_code: string | null; short_code: string | null;
};

const toCustomer = (r: CustomerRow): Customer => ({
  code: r.code, name: r.name, shortName: r.short_name, state: r.state,
  address: r.address, contact: r.contact, email: r.email, attn: r.attn,
  incomeTaxNo: r.income_taxno, active: r.active, groupCode: r.group_code ?? null,
  shortCode: r.short_code ?? null,
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
  id: number; customer_code: string | null; group_code: string | null; item_code: string;
  price: number; effective_from: string; note: string | null;
};

const toPrice = (r: PriceDbRow): PriceRow => ({
  id: r.id, customerCode: r.customer_code, groupCode: r.group_code ?? null,
  itemCode: r.item_code,
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
/** Every price a group's outlets share, plus anything set on one outlet alone. */
export async function listGroupPrices(groupCode: string): Promise<PriceRow[]> {
  const { data, error } = await serverSupabase()
    .from("sales_prices").select("*").eq("group_code", groupCode);
  fail("Could not load the price list", error);
  return (data ?? []).map(toPrice);
}

/**
 * Sets one price, for a whole group or for a single outlet.
 *
 * Which of the two it is decides the uniqueness rule to upsert against: a group
 * price leaves customer_code empty, and in Postgres one empty value never
 * collides with another, so the outlet rule would let duplicates through.
 */
export async function setPrice(row: PriceRow): Promise<void> {
  const forGroup = !!row.groupCode;
  const { error } = await serverSupabase().from("sales_prices").upsert(
    {
      customer_code: forGroup ? null : row.customerCode,
      group_code: forGroup ? row.groupCode : null,
      item_code: row.itemCode,
      price: row.price, effective_from: row.effectiveFrom, note: row.note,
    },
    {
      onConflict: forGroup
        ? "group_code,item_code,effective_from"
        : "customer_code,item_code,effective_from",
    },
  );
  fail("Could not save that price", error);
}

export async function deletePrice(id: number): Promise<void> {
  const { error } = await serverSupabase().from("sales_prices").delete().eq("id", id);
  fail("Could not remove that price", error);
}

/* ── Sales orders ─────────────────────────────────────────────────────────── */

type OrderRow = {
  id: number; order_no: string; customer_code: string | null; group_code: string | null;
  order_date: string; deliver_on: string | null; status: string;
  their_ref: string | null; note: string | null;
};
type LineRow = {
  id: number; order_id: number; line_no: number; item_code: string;
  qty: number; uom: string; price: number; note: string | null;
  outlet_code: string | null;
};
type BatchRow = {
  order_id: number; item_code: string; batch_code: string;
  source: string; confirmed: boolean; noted_at: string;
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
      outletCode: l.outlet_code,
    });
  }

  return orders.map((o) => ({
    id: o.id, orderNo: o.order_no, customerCode: o.customer_code, groupCode: o.group_code,
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
    order_no: order.orderNo,
    customer_code: order.customerCode ?? null,
    group_code: order.groupCode ?? null,
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
        outlet_code: l.outletCode ?? null,
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

/* ── Groups of outlets ────────────────────────────────────────────────────── */

export async function listGroups(): Promise<CustomerGroup[]> {
  const { data, error } = await serverSupabase()
    .from("sales_groups").select("*").order("name");
  fail("Could not load the customer groups", error);
  return ((data ?? []) as { code: string; name: string; active: boolean }[])
    .map((g) => ({ code: g.code, name: g.name, active: g.active }));
}

/** The outlets that order together under one group, in a settled order. */
export async function outletsOf(groupCode: string): Promise<Customer[]> {
  const { data, error } = await serverSupabase()
    .from("sales_customers").select("*").eq("group_code", groupCode).order("code");
  fail("Could not load that group's outlets", error);
  return ((data ?? []) as CustomerRow[]).map(toCustomer);
}

export async function setCustomerGroup(code: string, groupCode: string | null): Promise<void> {
  const { error } = await serverSupabase()
    .from("sales_customers").update({ group_code: groupCode }).eq("code", code);
  fail("Could not move that outlet", error);
}

export async function upsertGroup(g: CustomerGroup): Promise<void> {
  const { error } = await serverSupabase().from("sales_groups").upsert({
    code: g.code, name: g.name, active: g.active, updated_at: new Date().toISOString(),
  });
  fail("Could not save that group", error);
}

/* ── Batch codes ──────────────────────────────────────────────────────────── */

export async function listBatches(orderId: number): Promise<OrderBatch[]> {
  const { data, error } = await serverSupabase()
    .from("sales_order_batches").select("*").eq("order_id", orderId).order("item_code");
  fail("Could not load the batch codes", error);
  return ((data ?? []) as BatchRow[]).map((b) => ({
    itemCode: b.item_code, batchCode: b.batch_code,
    source: b.source === "photo" ? "photo" : "typed",
    confirmed: b.confirmed, notedAt: b.noted_at,
  }));
}

/**
 * Replaces the batch codes for an order.
 *
 * An item whose code was rubbed out should leave no record behind, so the whole
 * set is written rather than merged — a stale code is worse than none, because
 * it would be trusted.
 */
export async function saveBatches(orderId: number, batches: OrderBatch[]): Promise<void> {
  const db = serverSupabase();
  const { error: wipe } = await db.from("sales_order_batches").delete().eq("order_id", orderId);
  fail("Could not clear the old batch codes", wipe);
  const keep = batches.filter((b) => b.batchCode.trim() !== "");
  if (keep.length === 0) return;
  const { error } = await db.from("sales_order_batches").insert(
    keep.map((b) => ({
      order_id: orderId, item_code: b.itemCode, batch_code: b.batchCode.trim(),
      source: b.source, confirmed: b.confirmed, noted_at: new Date().toISOString(),
    })),
  );
  fail("Could not save the batch codes", error);
}

/* ── The whole sheet ──────────────────────────────────────────────────────── */

/** One order with its lines and batch codes, ready to be laid out as a sheet. */
export async function loadOrder(orderNo: string): Promise<SalesOrder | null> {
  const db = serverSupabase();
  const { data, error } = await db
    .from("sales_orders").select("*").eq("order_no", orderNo).maybeSingle();
  fail("Could not open that order", error);
  if (!data) return null;
  const o = data as OrderRow;

  const { data: lineData, error: lineError } = await db
    .from("sales_order_lines").select("*").eq("order_id", o.id).order("line_no");
  fail("Could not load the order lines", lineError);

  return {
    id: o.id, orderNo: o.order_no, customerCode: o.customer_code, groupCode: o.group_code,
    orderDate: o.order_date, deliverOn: o.deliver_on, status: o.status as OrderStatus,
    theirRef: o.their_ref, note: o.note,
    lines: ((lineData ?? []) as LineRow[]).map((l) => ({
      id: l.id, lineNo: l.line_no, itemCode: l.item_code, qty: Number(l.qty),
      uom: l.uom, price: Number(l.price), note: l.note, outletCode: l.outlet_code,
    })),
    batches: await listBatches(o.id),
  };
}

/** What the order form calls an item, against what Million calls it. */
export async function listAliases(): Promise<Record<string, string>> {
  const { data, error } = await serverSupabase().from("sales_item_aliases").select("*");
  fail("Could not load the item names", error);
  const out: Record<string, string> = {};
  for (const r of (data ?? []) as { alias: string; item_code: string }[]) {
    // Keyed by item so the sheet can print the office's own shorthand.
    out[r.item_code] = r.alias;
  }
  return out;
}

/** The other names a branch answers to, keyed the way matching looks them up. */
export async function listOutletAliases(): Promise<Record<string, string>> {
  const { data, error } = await serverSupabase().from("sales_outlet_aliases").select("*");
  fail("Could not load the outlet names", error);
  const out: Record<string, string> = {};
  for (const r of (data ?? []) as { alias: string; customer_code: string }[]) {
    out[r.alias.toUpperCase().replace(/[^A-Z0-9]/g, "")] = r.customer_code;
  }
  return out;
}
