// Confirmed orders as an Excel file for AutoCount, marked so they never go out twice.
import * as XLSX from "xlsx";
import { clearExported, listCustomers, listOrders, listProducts, markExported } from "@/lib/store-sales";
import { AUTOCOUNT_COLUMNS, autocountRows, exportable } from "@/lib/autocount";
import { attempt, guard, problem } from "@/lib/route-helpers";

export const runtime = "nodejs";

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(request: Request) {
  const stop = await guard();
  if (stop) return stop;

  const form = await request.formData().catch(() => null);
  const from = String(form?.get("from") ?? "");
  const to = String(form?.get("to") ?? "");
  const includeExported = form?.get("include") === "yes";
  const mark = form?.get("mark") !== "no";
  if (!DAY.test(from) || !DAY.test(to) || from > to) return problem("Pick a start and end date for the export.");

  try {
    const [orders, customers, products] = await Promise.all([listOrders(2000), listCustomers(), listProducts()]);
    const picked = exportable(orders, from, to, includeExported);
    if (picked.length === 0) {
      return problem("No confirmed or delivered orders in those dates that have not been exported already.", 404);
    }
    const rows = autocountRows(
      picked,
      new Map(customers.map((c) => [c.code, c])),
      new Map(products.map((p) => [p.itemCode, p.description])),
    );

    const sheet = XLSX.utils.json_to_sheet(rows, { header: [...AUTOCOUNT_COLUMNS] });
    sheet["!cols"] = AUTOCOUNT_COLUMNS.map((c) => ({ wch: c === "Description" || c === "DebtorName" ? 34 : c === "Remark" ? 24 : 13 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, "Sales Orders");
    const file = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

    const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "");
    const name = `autocount-sales-orders-${from}-to-${to}-${stamp}.xlsx`;
    if (mark) await markExported(picked.map((o) => o.id!).filter(Boolean), name);
    const unpriced = rows.filter((r) => !(Number(r.UnitPrice) > 0));

    return new Response(new Uint8Array(file), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${name}"`,
        "X-Orders": String(picked.length),
        "X-Unpriced-Lines": String(unpriced.length),
        "X-Unpriced-Orders": [...new Set(unpriced.map((r) => String(r.DocNo)))].slice(0, 10).join(" "),
      },
    });
  } catch (e) {
    return problem((e as Error).message, 500);
  }
}

/** Clears the mark on one order, so the next export takes it again. */
export async function DELETE(request: Request) {
  const stop = await guard();
  if (stop) return stop;
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) return problem("Which order?");
  return attempt(() => clearExported([id]));
}
