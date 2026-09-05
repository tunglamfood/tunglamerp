// What the office should be told the moment they open the system.
//
// Not a wall of statistics — the two or three things that will cost money or
// cause trouble if nobody notices them today.
import { Assignment, Customer, PriceRow, Product, SalesOrder, Worker, WorkerDocument } from "./types";
import { ExpiryLevel, expiryLevel } from "./expiry";
import { currentListFor } from "./pricing";

export interface Alert {
  level: "bad" | "warn" | "info";
  title: string;
  detail: string;
  href: string;
  action: string;
}

export interface Figures {
  workers: number;
  working: number;
  notEnrolled: number;
  customers: number;
  products: number;
  ordersThisMonth: number;
  orderValueThisMonth: number;
  pricedProducts: number;
  belowCost: number;
  /** Priced under a cost so much higher it must be a per-carton figure. */
  costLooksWrong: number;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * A cost this many times the selling price is not a loss — it is a unit
 * mismatch, almost always a carton cost against a packet price.
 */
export const UNIT_MISMATCH_RATIO = 3;

export function figuresFor({
  workers, working, customers, products, orders, prices, today,
}: {
  workers: Worker[];
  working: Set<string>;
  customers: Customer[];
  products: Product[];
  orders: SalesOrder[];
  prices: PriceRow[];
  today: string;
}): Figures {
  const month = today.slice(0, 7);
  const mine = orders.filter((o) => o.orderDate.startsWith(month) && o.status !== "cancelled");

  let belowCost = 0;
  let costLooksWrong = 0;
  const costOf = new Map(products.map((p) => [p.itemCode, p.cost]));
  const pricedItems = new Set<string>();
  for (const c of customers) {
    for (const row of currentListFor(c.code, prices, today).values()) {
      pricedItems.add(row.itemCode);
      const cost = costOf.get(row.itemCode) ?? 0;
      if (cost <= 0 || row.price >= cost) continue;
      if (cost > row.price * UNIT_MISMATCH_RATIO) costLooksWrong++;
      else belowCost++;
    }
  }

  return {
    workers: workers.length,
    working: workers.filter((w) => working.has(w.status)).length,
    notEnrolled: workers.filter((w) => working.has(w.status) && !w.scannerId).length,
    customers: customers.filter((c) => c.active).length,
    products: products.filter((p) => p.active).length,
    ordersThisMonth: mine.length,
    orderValueThisMonth:
      Math.round(
        mine.reduce((t, o) => t + o.lines.reduce((s, l) => s + l.qty * l.price, 0), 0) * 100,
      ) / 100,
    pricedProducts: pricedItems.size,
    belowCost,
    costLooksWrong,
  };
}

export function alertsFor({
  documents, workers, working, customers, products, prices, assignments, today, monthFlags, monthKey,
}: {
  documents: WorkerDocument[];
  workers: Worker[];
  working: Set<string>;
  customers: Customer[];
  products: Product[];
  prices: PriceRow[];
  assignments: Assignment[];
  today: string;
  /** How many things the current month still has to check, or null if untouched. */
  monthFlags: number | null;
  monthKey: string;
}): Alert[] {
  const out: Alert[] = [];
  const nameOf = new Map(workers.map((w) => [w.code, w.name]));

  const at = (level: ExpiryLevel) =>
    documents.filter((d) => expiryLevel(d.expiresOn, today) === level);
  const expired = at("expired");
  const urgent = at("urgent");

  if (expired.length > 0) {
    out.push({
      level: "bad",
      title: `${plural(expired.length, "document")} already expired`,
      detail:
        expired.slice(0, 3).map((d) => `${d.kind} — ${nameOf.get(d.code) ?? d.code}`).join(", ") +
        (expired.length > 3 ? `, and ${expired.length - 3} more` : "") +
        ". Somebody working on an expired permit is a fine waiting to happen.",
      href: "/workers",
      action: "Open documents",
    });
  }

  if (urgent.length > 0) {
    out.push({
      level: "warn",
      title: `${plural(urgent.length, "document")} expiring within a month`,
      detail:
        urgent.slice(0, 3).map((d) => `${d.kind} — ${nameOf.get(d.code) ?? d.code}`).join(", ") +
        (urgent.length > 3 ? `, and ${urgent.length - 3} more` : "") +
        ". Renewals take time; start them now.",
      href: "/workers",
      action: "Open documents",
    });
  }

  // A price under the recorded cost is one of two very different things, and
  // saying "losing money" about both would cry wolf. A small shortfall is a
  // pricing problem. A price a fraction of the cost is almost always the cost
  // being held per carton while the price is per packet — a data problem.
  const costOf = new Map(products.map((p) => [p.itemCode, p.cost]));
  const losing: string[] = [];
  const mismatched: string[] = [];
  for (const c of customers.filter((x) => x.active)) {
    for (const row of currentListFor(c.code, prices, today).values()) {
      const cost = costOf.get(row.itemCode) ?? 0;
      if (cost <= 0 || row.price >= cost) continue;
      const where = `${row.itemCode} to ${c.shortName || c.name}`;
      if (cost > row.price * UNIT_MISMATCH_RATIO) mismatched.push(where);
      else losing.push(where);
    }
  }

  if (losing.length > 0) {
    out.push({
      level: "warn",
      title: `${plural(losing.length, "price")} below what the item costs`,
      detail:
        losing.slice(0, 3).join(", ") +
        (losing.length > 3 ? `, and ${losing.length - 3} more` : "") +
        ". Every one of those sales loses money.",
      href: "/sales/prices",
      action: "Open price lists",
    });
  }

  if (mismatched.length > 0) {
    out.push({
      level: "info",
      title: `${plural(mismatched.length, "item")} with a cost that looks wrong`,
      detail:
        mismatched.slice(0, 3).join(", ") +
        (mismatched.length > 3 ? `, and ${mismatched.length - 3} more` : "") +
        ". The cost is many times the selling price, which usually means it was " +
        "brought in per carton while the price is per packet — worth correcting so " +
        "margins can be trusted.",
      href: "/sales/products",
      action: "Open products",
    });
  }

  if (monthFlags != null && monthFlags > 0) {
    out.push({
      level: "info",
      title: `${plural(monthFlags, "thing")} to check before ${monthKey} can be paid`,
      detail: "The Million file stays locked until the check list is clear.",
      href: "/month",
      action: "Open monthly pay",
    });
  }

  const unenrolled = workers.filter((w) => working.has(w.status) && !w.scannerId).length;
  if (unenrolled > 0) {
    out.push({
      level: "info",
      title: `${plural(unenrolled, "worker")} not on the scanner yet`,
      detail:
        "Their days cannot be counted from the scanner file until they have a number against them.",
      href: "/workers",
      action: "Open workers",
    });
  }

  const homeless = workers.filter(
    (w) => working.has(w.status) && !assignments.some((a) => a.code === w.code && !a.toDate),
  ).length;
  if (homeless > 0 && assignments.length > 0) {
    out.push({
      level: "info",
      title: `${plural(homeless, "worker")} with no hostel or transport recorded`,
      detail: "Worth filling in while the records are being kept anyway.",
      href: "/workers",
      action: "Open hostel & transport",
    });
  }

  return out;
}
