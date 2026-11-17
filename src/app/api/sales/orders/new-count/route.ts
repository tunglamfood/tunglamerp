// How many portal orders are waiting for the office — polled by the sidebar badge.
import { countNewPortalOrders } from "@/lib/store-sales";
import { attempt, guard } from "@/lib/route-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const stop = await guard();
  if (stop) return stop;
  return attempt(async () => ({ count: await countNewPortalOrders() }));
}
