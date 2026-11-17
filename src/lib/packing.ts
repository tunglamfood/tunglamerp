// Packing and delivery for one day: every order for the delivery date, by route (lorry)
// and stop, with what to pack per dealer (in the units ordered) and what each lorry
// carries in all. Plain arithmetic, tested without a database.
import { deliveryOf } from "./production";
import type { Customer, Product, SalesOrder } from "./types";

export interface Route { code: string; name: string; driver: string | null; lorry: string | null; sort: number; active: boolean }
export interface CustomerStop { code: string; routeCode: string | null; routeSort: number | null }

export interface PackLine { itemCode: string; description: string; qty: number; uom: string }
export interface PackOrder { id: number; orderNo: string; status: string; packed: boolean; theirRef: string | null; note: string | null; lines: PackLine[] }
export interface Stop { customerCode: string; name: string; address: string | null; contact: string | null; terms: string; orders: PackOrder[] }
export interface RouteDay {
  code: string | null;
  name: string;
  driver: string | null;
  lorry: string | null;
  stops: Stop[];
  load: PackLine[];
  orders: number;
  packed: number;
}

export function buildPacking({
  orders, customers, products, routes, delivery, includePending,
}: {
  orders: SalesOrder[];
  customers: (Customer & { routeCode?: string | null; routeSort?: number | null })[];
  products: Product[];
  routes: Route[];
  delivery: string;
  includePending: boolean;
}): { routes: RouteDay[]; orders: number; packed: number; dealers: number } {
  const cust = new Map(customers.map((c) => [c.code, c]));
  const desc = new Map(products.map((p) => [p.itemCode, p.description]));
  const counted = orders.filter((o) =>
    deliveryOf(o) === delivery &&
    (o.status === "confirmed" || o.status === "delivered" || (includePending && (o.status === "submitted" || o.status === "on_hold"))));

  // A chain group's sheet is packed outlet by outlet: each outlet is its own stop.
  const stops = new Map<string, Stop>();
  for (const o of counted) {
    const byOutlet = new Map<string, PackLine[]>();
    for (const l of o.lines) {
      if (!l.itemCode || !(l.qty > 0)) continue;
      const who = l.outletCode || o.customerCode || o.groupCode || "?";
      const list = byOutlet.get(who) ?? [];
      const same = list.find((x) => x.itemCode === l.itemCode && x.uom === l.uom);
      if (same) same.qty += l.qty;
      else list.push({ itemCode: l.itemCode, description: desc.get(l.itemCode) ?? l.itemCode, qty: l.qty, uom: l.uom });
      byOutlet.set(who, list);
    }
    for (const [who, lines] of byOutlet) {
      const c = cust.get(who);
      const stop = stops.get(who) ?? {
        customerCode: who, name: c?.shortName || c?.name || who, address: c?.address ?? null, contact: c?.contact ?? null,
        terms: c?.paymentTerms ?? "", orders: [],
      };
      stop.orders.push({ id: o.id!, orderNo: o.orderNo, status: o.status, packed: !!o.packedAt, theirRef: o.theirRef, note: o.note, lines });
      stops.set(who, stop);
    }
  }

  const byRoute = new Map<string, RouteDay>();
  const routeOf = new Map(routes.map((r) => [r.code, r]));
  for (const s of stops.values()) {
    const code = cust.get(s.customerCode)?.routeCode ?? null;
    const r = code ? routeOf.get(code) : undefined;
    const key = r ? r.code : "";
    const day = byRoute.get(key) ?? { code: r?.code ?? null, name: r?.name ?? "No route yet", driver: r?.driver ?? null, lorry: r?.lorry ?? null, stops: [], load: [], orders: 0, packed: 0 };
    day.stops.push(s);
    byRoute.set(key, day);
  }

  for (const day of byRoute.values()) {
    day.stops.sort((a, b) => {
      const sa = cust.get(a.customerCode)?.routeSort ?? 9999, sb = cust.get(b.customerCode)?.routeSort ?? 9999;
      return sa - sb || a.name.localeCompare(b.name);
    });
    const load = new Map<string, PackLine>();
    for (const s of day.stops) for (const o of s.orders) {
      day.orders++;
      if (o.packed) day.packed++;
      for (const l of o.lines) {
        const k = `${l.itemCode}|${l.uom}`;
        const cur = load.get(k) ?? { ...l, qty: 0 };
        cur.qty += l.qty;
        load.set(k, cur);
      }
    }
    day.load = [...load.values()].sort((a, b) => a.description.localeCompare(b.description));
  }

  const routeSort = (d: RouteDay) => (d.code ? routeOf.get(d.code)?.sort ?? 0 : 99999);
  const list = [...byRoute.values()].sort((a, b) => routeSort(a) - routeSort(b) || a.name.localeCompare(b.name));
  // A chain's order split over several outlet stops still counts once for the day.
  const all = list.flatMap((d) => d.stops.flatMap((st) => st.orders));
  return {
    routes: list,
    orders: new Set(all.map((o) => o.id)).size,
    packed: new Set(all.filter((o) => o.packed).map((o) => o.id)).size,
    dealers: stops.size,
  };
}
