// The sales report: plain arithmetic on orders already loaded, so it can be
// tested without a database. Cancelled orders and office drafts never count.
import type { Customer, Product, SalesOrder } from "./types";

export interface PortalLogin {
  customerCode: string | null;
  groupCode: string | null;
  role: string;
  active: boolean;
  lastLoginAt: string | null;
}

export interface Bucket { start: string; label: string; orders: number; value: number }
export interface DealerRow { key: string; name: string; orders: number; value: number; portalShare: number }
export interface ProductRow { itemCode: string; description: string; qty: number; uom: string; value: number }
export interface QuietDealer { key: string; name: string; lastOrder: string; daysSince: number; usualGap: number; orders: number }

export interface SalesReport {
  orders: number;
  value: number;
  avgValue: number;
  dealers: number;
  /** Lines with no price yet — their value is not in the totals. */
  unpricedLines: number;
  bySource: { portal: number; rep: number; office: number };
  series: Bucket[];
  bucket: "day" | "week";
  topDealers: DealerRow[];
  topProducts: ProductRow[];
  adoption: { dealersWithLogin: number; signedIn30d: number; orderedOnPortal: number };
  quiet: QuietDealer[];
}

const DAY = 86400_000;
const toDate = (iso: string) => new Date(`${iso}T00:00:00Z`);
const iso = (d: Date) => d.toISOString().slice(0, 10);
const days = (a: string, b: string) => Math.round((toDate(b).getTime() - toDate(a).getTime()) / DAY);
const lineValue = (o: SalesOrder) => o.lines.reduce((s, l) => s + l.qty * l.price, 0);
const round2 = (n: number) => Math.round(n * 100) / 100;
const counts = (o: SalesOrder) => o.status !== "cancelled" && o.status !== "draft";
const dealerKey = (o: SalesOrder) => o.customerCode ?? (o.groupCode ? `group:${o.groupCode}` : "unknown");

function monday(d: Date) {
  const day = (d.getUTCDay() + 6) % 7;
  return new Date(d.getTime() - day * DAY);
}

export function salesReport({
  orders, customers, products, logins, from, to, today, groupNames = {},
}: {
  orders: SalesOrder[];
  customers: Customer[];
  products: Product[];
  logins: PortalLogin[];
  from: string;
  to: string;
  today: string;
  groupNames?: Record<string, string>;
}): SalesReport {
  const custName = new Map(customers.map((c) => [c.code, c.shortName || c.name]));
  const nameOf = (key: string) =>
    key.startsWith("group:") ? groupNames[key.slice(6)] ?? key.slice(6) : custName.get(key) ?? key;
  const product = new Map(products.map((p) => [p.itemCode, p]));

  const inRange = orders.filter((o) => counts(o) && o.orderDate >= from && o.orderDate <= to);
  const value = round2(inRange.reduce((s, o) => s + lineValue(o), 0));
  const bySource = { portal: 0, rep: 0, office: 0 };
  for (const o of inRange) {
    if (o.source === "portal") bySource.portal++;
    else if (o.source === "rep") bySource.rep++;
    else bySource.office++;
  }

  // Day by day for a month or less, week by week beyond that.
  const span = days(from, to) + 1;
  const bucket: "day" | "week" = span <= 31 ? "day" : "week";
  const series: Bucket[] = [];
  const index = new Map<string, Bucket>();
  for (let d = bucket === "day" ? toDate(from) : monday(toDate(from)); iso(d) <= to; d = new Date(d.getTime() + (bucket === "day" ? 1 : 7) * DAY)) {
    const start = iso(d);
    const b: Bucket = {
      start,
      label: d.toLocaleDateString("en-MY", { day: "numeric", month: "short", timeZone: "UTC" }),
      orders: 0,
      value: 0,
    };
    series.push(b);
    index.set(start, b);
  }
  for (const o of inRange) {
    const k = bucket === "day" ? o.orderDate : iso(monday(toDate(o.orderDate)));
    const b = index.get(k);
    if (!b) continue;
    b.orders++;
    b.value = round2(b.value + lineValue(o));
  }

  const dealers = new Map<string, DealerRow & { portal: number }>();
  for (const o of inRange) {
    const key = dealerKey(o);
    const row = dealers.get(key) ?? { key, name: nameOf(key), orders: 0, value: 0, portalShare: 0, portal: 0 };
    row.orders++;
    row.value = round2(row.value + lineValue(o));
    if (o.source === "portal" || o.source === "rep") row.portal++;
    dealers.set(key, row);
  }
  const topDealers = [...dealers.values()]
    .map(({ portal, ...r }) => ({ ...r, portalShare: r.orders ? portal / r.orders : 0 }))
    .sort((a, b) => b.value - a.value || b.orders - a.orders)
    .slice(0, 10);

  const items = new Map<string, ProductRow>();
  let unpricedLines = 0;
  for (const o of inRange) {
    for (const l of o.lines) {
      if (!(l.price > 0)) unpricedLines++;
      const row = items.get(l.itemCode) ?? {
        itemCode: l.itemCode,
        description: product.get(l.itemCode)?.description ?? l.itemCode,
        qty: 0,
        uom: l.uom || product.get(l.itemCode)?.uom || "",
        value: 0,
      };
      row.qty += l.qty;
      row.value = round2(row.value + l.qty * l.price);
      items.set(l.itemCode, row);
    }
  }
  const topProducts = [...items.values()].sort((a, b) => b.qty - a.qty).slice(0, 10);

  // Portal adoption, counted in dealers (a chain group counts once).
  const loginKeys = new Set<string>();
  const recentKeys = new Set<string>();
  const since30 = new Date(toDate(today).getTime() - 30 * DAY).toISOString();
  for (const l of logins) {
    if (!l.active || l.role !== "dealer") continue;
    const key = l.customerCode ?? (l.groupCode ? `group:${l.groupCode}` : null);
    if (!key) continue;
    loginKeys.add(key);
    if (l.lastLoginAt && l.lastLoginAt >= since30) recentKeys.add(key);
  }
  const orderedOnPortal = new Set(inRange.filter((o) => o.source === "portal").map(dealerKey)).size;

  // Going quiet: dealers who order regularly but have not for much longer than usual.
  const window = orders.filter((o) => counts(o) && o.orderDate <= today && days(o.orderDate, today) <= 120);
  const datesBy = new Map<string, string[]>();
  for (const o of window) {
    const key = dealerKey(o);
    const list = datesBy.get(key) ?? [];
    if (!list.includes(o.orderDate)) list.push(o.orderDate);
    datesBy.set(key, list);
  }
  const quiet: QuietDealer[] = [];
  for (const [key, list] of datesBy) {
    if (list.length < 3) continue;
    list.sort();
    const gaps = list.slice(1).map((d, i) => days(list[i], d)).sort((a, b) => a - b);
    const usualGap = gaps[Math.floor(gaps.length / 2)];
    const lastOrder = list[list.length - 1];
    const daysSince = days(lastOrder, today);
    if (daysSince >= 7 && daysSince > Math.max(usualGap * 2, usualGap + 7)) {
      quiet.push({ key, name: nameOf(key), lastOrder, daysSince, usualGap, orders: list.length });
    }
  }
  quiet.sort((a, b) => b.daysSince / Math.max(1, b.usualGap) - a.daysSince / Math.max(1, a.usualGap));

  return {
    orders: inRange.length,
    value,
    avgValue: inRange.length ? round2(value / inRange.length) : 0,
    dealers: dealers.size,
    unpricedLines,
    bySource,
    series,
    bucket,
    topDealers,
    topProducts,
    adoption: { dealersWithLogin: loginKeys.size, signedIn30d: recentKeys.size, orderedOnPortal },
    quiet: quiet.slice(0, 12),
  };
}

/** The periods the report offers, as [from, to] in Malaysian dates. */
export function periodRange(p: string, today: string): { key: string; from: string; to: string; label: string } {
  const t = toDate(today);
  if (p === "last") {
    const first = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() - 1, 1));
    const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), 0));
    return { key: "last", from: iso(first), to: iso(last), label: first.toLocaleDateString("en-MY", { month: "long", year: "numeric", timeZone: "UTC" }) };
  }
  if (p === "90") {
    return { key: "90", from: iso(new Date(t.getTime() - 89 * DAY)), to: today, label: "Last 90 days" };
  }
  const first = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), 1));
  return { key: "month", from: iso(first), to: today, label: first.toLocaleDateString("en-MY", { month: "long", year: "numeric", timeZone: "UTC" }) };
}
