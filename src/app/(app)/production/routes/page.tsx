// Production → Routes: each lorry's route, driver and dealers in stop order.
import { requireArea } from "@/lib/auth";
import { listRoutes } from "@/lib/store-packing";
import { listCustomers } from "@/lib/store-sales";
import { Notice } from "@/components/ui";
import { RoutesScreen } from "@/components/routes-screen";

export const dynamic = "force-dynamic";

async function load() {
  try {
    const [routes, customers] = await Promise.all([listRoutes(), listCustomers()]);
    return { data: { routes, customers }, problem: null };
  } catch (e) {
    return { data: null, problem: (e as Error).message };
  }
}

export default async function RoutesPage() {
  await requireArea("production");
  const { data, problem } = await load();
  if (!data) return <Notice tone="bad">Could not load the routes. {problem}</Notice>;
  return (
    <RoutesScreen
      routes={data.routes}
      dealers={data.customers.filter((c) => c.active).map((c) => ({ code: c.code, name: c.shortName || c.name, state: c.state, routeCode: c.routeCode ?? null }))}
    />
  );
}
