// The SKU list: what we sell, in what pack, at what list price.
import { listProducts, upsertProduct } from "@/lib/store-sales";
import { attempt, guard, num, problem, readBody, str, strOrNull } from "@/lib/route-helpers";

export const runtime = "nodejs";

export async function GET() {
  const stop = await guard();
  if (stop) return stop;
  return attempt(async () => ({ products: await listProducts() }));
}

export async function POST(request: Request) {
  const stop = await guard();
  if (stop) return stop;
  const b = await readBody(request);
  if (!b) return problem("Could not read what was sent.");
  const itemCode = str(b.itemCode).toUpperCase();
  const description = str(b.description);
  if (!itemCode) return problem("Every product needs its item code, like AD120.");
  if (!description) return problem("Every product needs a description.");
  return attempt(() =>
    upsertProduct({
      itemCode,
      description,
      barcode: strOrNull(b.barcode),
      itemGroup: str(b.itemGroup),
      itemType: str(b.itemType),
      uom: str(b.uom),
      packSize: str(b.packSize),
      basePrice: num(b.basePrice),
      cost: num(b.cost),
      active: b.active !== false,
    }),
  );
}
