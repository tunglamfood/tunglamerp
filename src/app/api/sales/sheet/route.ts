// The order form the factory picks and packs from.
import {
  listAliases, listGroupPrices, listOrders, listPrices, listProducts, loadOrder,
  outletsOf, saveBatches, saveOrder,
} from "@/lib/store-sales";
import { attempt, guard, problem, readBody, str } from "@/lib/route-helpers";
import { nextOrderNo } from "@/lib/pricing";
import { OrderBatch, OrderLine } from "@/lib/types";

export const runtime = "nodejs";

const isDate = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d);

/**
 * Everything one sheet needs, in a single call.
 *
 * Either an existing order by its number, or the makings of a new one for a
 * group and a delivery date. Both hand back the same shape, so the screen has
 * one path rather than two.
 */
export async function GET(request: Request) {
  const stop = await guard();
  if (stop) return stop;

  const url = new URL(request.url);
  const orderNo = str(url.searchParams.get("order"));
  const groupCode = str(url.searchParams.get("group"));
  const customerCode = str(url.searchParams.get("customer"));
  const date = str(url.searchParams.get("date"));

  return attempt(async () => {
    const [products, aliases] = await Promise.all([listProducts(), listAliases()]);

    if (orderNo) {
      const order = await loadOrder(orderNo);
      if (!order) return { missing: true };
      const outlets = order.groupCode ? await outletsOf(order.groupCode) : [];
      const prices = order.groupCode
        ? await listGroupPrices(order.groupCode)
        : await listPrices(order.customerCode ?? undefined);
      return { order, outlets, products, prices, aliases };
    }

    if (!groupCode && !customerCode) return { products, aliases, outlets: [], prices: [] };

    const outlets = groupCode ? await outletsOf(groupCode) : [];
    const prices = groupCode
      ? await listGroupPrices(groupCode)
      : await listPrices(customerCode);
    const existing = (await listOrders(500)).map((o) => o.orderNo);
    const on = isDate(date) ? date : new Date().toISOString().slice(0, 10);

    return {
      order: {
        orderNo: nextOrderNo(existing, on),
        customerCode: groupCode ? null : customerCode,
        groupCode: groupCode || null,
        orderDate: on,
        deliverOn: on,
        status: "draft" as const,
        theirRef: null,
        note: null,
        lines: [] as OrderLine[],
        batches: [] as OrderBatch[],
      },
      outlets, products, prices, aliases,
    };
  });
}

/** Saves the sheet and its batch codes together — they are one document. */
export async function POST(request: Request) {
  const stop = await guard();
  if (stop) return stop;
  const b = await readBody(request);
  if (!b) return problem("Could not read what was sent.");

  const orderNo = str(b.orderNo);
  const groupCode = str(b.groupCode);
  const customerCode = str(b.customerCode);
  const deliverOn = str(b.deliverOn);

  if (!orderNo) return problem("The sheet has no order number.");
  if (!groupCode && !customerCode) return problem("Whose order is this?");
  if (groupCode && customerCode) {
    return problem("A sheet belongs to one customer or to one group, not both.");
  }
  if (!isDate(deliverOn)) return problem("When is this being delivered?");
  if (!Array.isArray(b.lines)) return problem("No lines were sent.");

  const lines: OrderLine[] = [];
  for (const raw of b.lines as Record<string, unknown>[]) {
    const itemCode = str(raw.itemCode);
    const qty = Number(raw.qty);
    if (!itemCode || !Number.isFinite(qty) || qty <= 0) continue;
    lines.push({
      lineNo: lines.length + 1,
      itemCode,
      qty,
      uom: str(raw.uom),
      price: Number(raw.price) || 0,
      note: null,
      outletCode: str(raw.outletCode) || null,
    });
  }

  const batches: OrderBatch[] = [];
  for (const raw of (Array.isArray(b.batches) ? b.batches : []) as Record<string, unknown>[]) {
    const itemCode = str(raw.itemCode);
    const batchCode = str(raw.batchCode).trim();
    if (!itemCode || !batchCode) continue;
    batches.push({
      itemCode,
      batchCode,
      source: str(raw.source) === "photo" ? "photo" : "typed",
      confirmed: raw.confirmed === true,
    });
  }

  return attempt(async () => {
    const id = await saveOrder({
      orderNo,
      customerCode: customerCode || null,
      groupCode: groupCode || null,
      orderDate: str(b.orderDate) || deliverOn,
      deliverOn,
      status: (str(b.status) || "draft") as "draft",
      theirRef: str(b.theirRef) || null,
      note: str(b.note) || null,
      lines,
    });
    await saveBatches(id, batches);
    return { orderNo, saved: lines.length, batches: batches.length };
  });
}
