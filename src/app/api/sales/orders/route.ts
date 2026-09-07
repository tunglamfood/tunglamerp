// Sales orders and their lines.
import { deleteOrder, listOrders, saveOrder } from "@/lib/store-sales";
import { attempt, guard, num, problem, readBody, str, strOrNull } from "@/lib/route-helpers";
import { OrderLine, OrderStatus } from "@/lib/types";

export const runtime = "nodejs";

const STATUSES: OrderStatus[] = ["draft", "confirmed", "delivered", "cancelled"];

export async function GET() {
  const stop = await guard();
  if (stop) return stop;
  return attempt(async () => ({ orders: await listOrders() }));
}

export async function POST(request: Request) {
  const stop = await guard();
  if (stop) return stop;
  const b = await readBody(request);
  if (!b) return problem("Could not read what was sent.");

  const orderNo = str(b.orderNo);
  const customerCode = str(b.customerCode);
  const orderDate = str(b.orderDate);
  if (!orderNo) return problem("The order needs a number.");
  if (!customerCode) return problem("Which customer is this order for?");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(orderDate)) return problem("What date is the order?");

  const status = str(b.status, "draft") as OrderStatus;
  if (!STATUSES.includes(status)) return problem("That is not a status an order can have.");

  const rawLines = Array.isArray(b.lines) ? (b.lines as Record<string, unknown>[]) : [];
  const lines: OrderLine[] = rawLines.map((l, i) => ({
    lineNo: i + 1,
    itemCode: str(l.itemCode).toUpperCase(),
    qty: num(l.qty),
    uom: str(l.uom),
    price: num(l.price),
    note: strOrNull(l.note),
  }));
  const usable = lines.filter((l) => l.itemCode && l.qty > 0);
  if (usable.length === 0) return problem("An order needs at least one product with a quantity.");

  return attempt(() =>
    saveOrder({
      id: b.id ? Number(b.id) : undefined,
      orderNo,
      customerCode,
      orderDate,
      deliverOn: strOrNull(b.deliverOn),
      status,
      theirRef: strOrNull(b.theirRef),
      note: strOrNull(b.note),
      lines: usable,
    }),
  );
}

export async function DELETE(request: Request) {
  const stop = await guard();
  if (stop) return stop;
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!id) return problem("Which order should be removed?");
  return attempt(() => deleteOrder(id));
}
