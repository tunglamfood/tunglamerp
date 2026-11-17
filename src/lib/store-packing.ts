// Delivery routes (a lorry and its driver, with its dealers in stop order), the
// "packed" mark on orders, and marking a route's orders delivered.
import "server-only";
import { after } from "next/server";
import { serverSupabase } from "./supabase-server";
import { fail } from "./db-error";
import { notifyDealer } from "./sms";
import type { Route } from "./packing";

export async function listRoutes(): Promise<(Route & { customerCodes: string[] })[]> {
  const db = serverSupabase();
  const [{ data, error }, { data: cs, error: ce }] = await Promise.all([
    db.from("delivery_routes").select("*").order("sort"),
    db.from("sales_customers").select("code, route_code, route_sort").not("route_code", "is", null),
  ]);
  fail("Could not load the routes", error);
  fail("Could not load the route stops", ce);
  const stops = ((cs ?? []) as { code: string; route_code: string; route_sort: number | null }[])
    .sort((a, b) => (a.route_sort ?? 9999) - (b.route_sort ?? 9999) || a.code.localeCompare(b.code));
  return ((data ?? []) as Route[]).map((r) => ({
    code: r.code, name: r.name, driver: r.driver, lorry: r.lorry, sort: r.sort, active: r.active,
    customerCodes: stops.filter((s) => s.route_code === r.code).map((s) => s.code),
  }));
}

/** Saves a route; its dealers in `customerCodes` order become its stops 1, 2, 3… */
export async function saveRoute(r: Route & { customerCodes: string[] }): Promise<void> {
  const db = serverSupabase();
  const { error } = await db.from("delivery_routes").upsert({ code: r.code, name: r.name, driver: r.driver, lorry: r.lorry, sort: r.sort, active: r.active });
  fail("Could not save the route", error);
  const { error: clear } = await db.from("sales_customers").update({ route_code: null, route_sort: null }).eq("route_code", r.code);
  fail("Could not update the route's dealers", clear);
  for (const [i, code] of r.customerCodes.entries()) {
    const { error: e } = await db.from("sales_customers").update({ route_code: r.code, route_sort: i + 1 }).eq("code", code);
    fail("Could not update the route's dealers", e);
  }
}

export async function deleteRoute(code: string): Promise<void> {
  const { error } = await serverSupabase().from("delivery_routes").delete().eq("code", code);
  fail("Could not remove the route", error);
}

export async function setPacked(orderIds: number[], packed: boolean, by: string): Promise<void> {
  if (!orderIds.length) return;
  const { error } = await serverSupabase().from("sales_orders")
    .update(packed ? { packed_at: new Date().toISOString(), packed_by: by } : { packed_at: null, packed_by: null })
    .in("id", orderIds);
  fail("Could not mark the orders packed", error);
}

/** After the trip: confirmed orders become delivered, with history (and an SMS when switched on). */
export async function markDelivered(orderIds: number[], by: string): Promise<number> {
  if (!orderIds.length) return 0;
  const db = serverSupabase();
  const { data, error } = await db.from("sales_orders").update({ status: "delivered", updated_at: new Date().toISOString() })
    .in("id", orderIds).eq("status", "confirmed").select("id");
  fail("Could not mark the orders delivered", error);
  const done = ((data ?? []) as { id: number }[]).map((r) => r.id);
  if (done.length) {
    await db.from("sales_order_events").insert(done.map((id) => ({ order_id: id, actor: "Tung Lam", kind: "delivered", detail: { from: "confirmed", by } })));
    after(async () => { for (const id of done) await notifyDealer(id, "delivered"); });
  }
  return done.length;
}
