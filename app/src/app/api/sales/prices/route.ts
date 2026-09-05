// What each dealer pays for each product, from which date.
import { deletePrice, listPrices, setPrice } from "@/lib/store-sales";
import { attempt, guard, num, problem, readBody, str, strOrNull } from "@/lib/route-helpers";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const stop = await guard();
  if (stop) return stop;
  const customer = new URL(request.url).searchParams.get("customer") ?? "";
  return attempt(async () => ({ prices: await listPrices(customer || undefined) }));
}

export async function POST(request: Request) {
  const stop = await guard();
  if (stop) return stop;
  const b = await readBody(request);
  if (!b) return problem("Could not read what was sent.");
  const customerCode = str(b.customerCode);
  const itemCode = str(b.itemCode).toUpperCase();
  const from = str(b.effectiveFrom);
  if (!customerCode) return problem("Which customer is this price for?");
  if (!itemCode) return problem("Which product is this price for?");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from)) return problem("From which date does this price apply?");
  const price = num(b.price, -1);
  if (price < 0) return problem("A price cannot be less than nothing.");
  return attempt(() =>
    setPrice({ customerCode, itemCode, price, effectiveFrom: from, note: strOrNull(b.note) }),
  );
}

export async function DELETE(request: Request) {
  const stop = await guard();
  if (stop) return stop;
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!id) return problem("Which price should be removed?");
  return attempt(() => deletePrice(id));
}
