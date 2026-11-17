// The red numbers beside "Sales orders" and "Enquiries": portal orders still
// waiting for the office, and website enquiries nobody has picked up yet.
import { countNewPortalOrders } from "@/lib/store-sales";
import { countNewLeads } from "@/lib/store-leads";
import { attempt, guard } from "@/lib/route-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const stop = await guard("sales");
  if (stop) return stop;
  return attempt(async () => {
    const [count, leads] = await Promise.all([countNewPortalOrders(), countNewLeads().catch(() => 0)]);
    return { count, leads };
  });
}
