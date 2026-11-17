// Packing and delivery: mark orders packed, mark a route delivered, set up routes.
import { currentUser } from "@/lib/supabase-server";
import { deleteRoute, markDelivered, saveRoute, setPacked } from "@/lib/store-packing";
import { attempt, guard, num, problem, readBody, str, strOrNull } from "@/lib/route-helpers";

export const runtime = "nodejs";

const ids = (v: unknown) => (Array.isArray(v) ? v.map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, 2000) : []);

export async function POST(request: Request) {
  const stop = await guard("production");
  if (stop) return stop;
  const b = await readBody(request);
  if (!b) return problem("Could not read what was sent.");
  const by = (await currentUser())?.name ?? "Office";

  switch (str(b.action)) {
    case "packed":
      return attempt(() => setPacked(ids(b.orderIds), b.packed !== false, by));
    case "delivered":
      return attempt(async () => ({ delivered: await markDelivered(ids(b.orderIds), by) }));
    case "route": {
      const code = str(b.code).toUpperCase().replace(/[^A-Z0-9_-]/g, "");
      if (!code) return problem("Give the route a short code, like IPOH1.");
      if (!str(b.name)) return problem("Give the route a name.");
      const customerCodes = Array.isArray(b.customerCodes) ? [...new Set((b.customerCodes as unknown[]).map(String))] : [];
      return attempt(() => saveRoute({
        code, name: str(b.name), driver: strOrNull(b.driver), lorry: strOrNull(b.lorry),
        sort: Math.round(num(b.sort, 0)), active: b.active !== false, customerCodes,
      }));
    }
    case "deleteRoute":
      return attempt(() => deleteRoute(str(b.code)));
    default:
      return problem("What should be done?");
  }
}
