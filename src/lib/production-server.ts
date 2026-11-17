// Loads everything one day's production plan needs and works it out — the page shows
// it, and locking re-computes it here rather than trusting numbers from the browser.
import "server-only";
import { listCustomers, listOrders, listProducts } from "./store-sales";
import { getPlan, getSettings, listItems, listLines, listRecipes } from "./store-production";
import { buildPlan, type Override } from "./production";

const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86400_000).toISOString().slice(0, 10);

export async function computePlan(delivery: string, includePending?: boolean) {
  const [orders, products, items, recipes, lines, saved, settings, customers] = await Promise.all([
    listOrders(5000, addDays(delivery, -21)),
    listProducts(),
    listItems(),
    listRecipes(),
    listLines(),
    getPlan(delivery),
    getSettings(),
    listCustomers(),
  ]);
  const pendingToo = includePending ?? settings.includePending;
  const overrides: Record<string, Override> = {};
  for (const l of saved?.lines ?? []) {
    if (l.stockQty || l.extraQty) overrides[l.itemCode] = { stockQty: l.stockQty, extraQty: l.extraQty };
  }
  const names = Object.fromEntries(customers.map((c) => [c.code, c.shortName || c.name]));
  const plan = buildPlan({
    orders, products, items, recipes, lines, overrides, delivery,
    includePending: pendingToo, cutoffHour: settings.cutoffHour, names,
  });
  return { plan, saved, settings, lines, items, products, includePending: pendingToo };
}
