// Production → Packing & delivery: one delivery day by route (lorry) and stop.
import { requireArea } from "@/lib/auth";
import { listCustomers, listOrders, listProducts } from "@/lib/store-sales";
import { listRoutes } from "@/lib/store-packing";
import { getSettings } from "@/lib/store-production";
import { buildPacking } from "@/lib/packing";
import { Notice } from "@/components/ui";
import { PackingScreen } from "@/components/packing-screen";

export const dynamic = "force-dynamic";

const myDate = (offset = 0) => new Date(Date.now() + 8 * 3600_000 + offset * 86400_000).toISOString().slice(0, 10);
const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86400_000).toISOString().slice(0, 10);

async function load(delivery: string, pending: boolean | undefined) {
  try {
    const [orders, customers, products, routes, settings] = await Promise.all([
      listOrders(5000, addDays(delivery, -21)), listCustomers(), listProducts(), listRoutes(), getSettings(),
    ]);
    const includePending = pending ?? settings.includePending;
    return { day: buildPacking({ orders, customers, products, routes, delivery, includePending }), includePending, hasRoutes: routes.length > 0, problem: null };
  } catch (e) {
    return { day: null, includePending: false, hasRoutes: false, problem: (e as Error).message };
  }
}

export default async function PackingPage({ searchParams }: { searchParams: Promise<{ date?: string; pending?: string }> }) {
  await requireArea("production");
  const sp = await searchParams;
  const delivery = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : myDate(1);
  const { day, includePending, hasRoutes, problem } = await load(delivery, sp.pending === "1" ? true : sp.pending === "0" ? false : undefined);
  if (!day) return <Notice tone="bad">Could not load packing. {problem}</Notice>;
  return <PackingScreen delivery={delivery} today={myDate()} day={day} includePending={includePending} hasRoutes={hasRoutes} />;
}
