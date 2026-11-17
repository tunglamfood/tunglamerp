// Outstanding invoices and stock balances from AutoCount. Each import replaces the
// last one: the export is a snapshot of what is owed / held on that day.
import "server-only";
import { serverSupabase } from "./supabase-server";
import { fail } from "./db-error";
import type { ArRow, Skip, StockRow } from "./ar-import";

export interface Invoice { customerCode: string; docNo: string; docType: string; docDate: string; dueDate: string | null; amount: number; outstanding: number; ref: string | null }
export interface ImportInfo { kind: "ar" | "stock"; fileName: string | null; rows: number; skipped: number; asOf: string; byName: string | null; at: string }

const today = () => new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10);

async function knownCodes(table: "sales_customers" | "sales_products", column: "code" | "item_code"): Promise<Set<string>> {
  const { data, error } = await serverSupabase().from(table).select(column).limit(20000);
  fail("Could not check the codes", error);
  return new Set(((data ?? []) as Record<string, string>[]).map((r) => r[column]));
}

async function inBatches<T>(rows: T[], insert: (chunk: T[]) => PromiseLike<{ error: unknown }>) {
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await insert(rows.slice(i, i + 500));
    fail("Could not save the imported rows", error as never);
  }
}

export async function replaceInvoices(rows: ArRow[], skipped: Skip[], fileName: string, by: string) {
  const db = serverSupabase();
  const known = await knownCodes("sales_customers", "code");
  const keep = rows.filter((r) => known.has(r.customerCode));
  const unknown = [...new Set(rows.filter((r) => !known.has(r.customerCode)).map((r) => r.customerCode))];
  if (keep.length === 0 && rows.length > 0) {
    throw new Error(`None of the debtor codes in the file are customers here (for example ${unknown.slice(0, 3).join(", ")}). Check that the codes match the Customers screen.`);
  }
  const { error } = await db.from("ar_invoices").delete().gte("id", 0);
  fail("Could not clear the old invoices", error);
  await inBatches(keep, (chunk) => db.from("ar_invoices").insert(chunk.map((r) => ({
    customer_code: r.customerCode, doc_no: r.docNo, doc_type: r.docType, doc_date: r.docDate, due_date: r.dueDate,
    amount: r.amount, outstanding: r.outstanding, ref: r.ref,
  }))));
  await db.from("data_imports").insert({ kind: "ar", file_name: fileName, rows: keep.length, skipped: skipped.length + (rows.length - keep.length), as_of: today(), by_name: by });
  return { imported: keep.length, skipped, unknown };
}

export async function replaceStock(rows: StockRow[], skipped: Skip[], fileName: string, by: string) {
  const db = serverSupabase();
  const known = await knownCodes("sales_products", "item_code");
  const keep = rows.filter((r) => known.has(r.itemCode));
  const unknown = rows.filter((r) => !known.has(r.itemCode)).map((r) => r.itemCode);
  if (keep.length === 0 && rows.length > 0) {
    throw new Error(`None of the item codes in the file are products here (for example ${unknown.slice(0, 3).join(", ")}).`);
  }
  const { error } = await db.from("stock_levels").delete().neq("item_code", "");
  fail("Could not clear the old stock", error);
  await inBatches(keep, (chunk) => db.from("stock_levels").insert(chunk.map((r) => ({ item_code: r.itemCode, qty: r.qty, uom: r.uom }))));
  await db.from("data_imports").insert({ kind: "stock", file_name: fileName, rows: keep.length, skipped: skipped.length + unknown.length, as_of: today(), by_name: by });
  return { imported: keep.length, skipped, unknown };
}

export async function listInvoices(): Promise<Invoice[]> {
  const { data, error } = await serverSupabase().from("ar_invoices").select("*").order("doc_date").limit(20000);
  fail("Could not load the invoices", error);
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    customerCode: r.customer_code as string, docNo: r.doc_no as string, docType: r.doc_type as string,
    docDate: r.doc_date as string, dueDate: (r.due_date as string) ?? null,
    amount: Number(r.amount), outstanding: Number(r.outstanding), ref: (r.ref as string) ?? null,
  }));
}

export async function lastImports(): Promise<Partial<Record<"ar" | "stock", ImportInfo>>> {
  const { data, error } = await serverSupabase().from("data_imports").select("*").order("at", { ascending: false }).limit(20);
  fail("Could not load the import history", error);
  const out: Partial<Record<"ar" | "stock", ImportInfo>> = {};
  for (const r of (data ?? []) as Record<string, unknown>[]) {
    const kind = r.kind as "ar" | "stock";
    if (out[kind]) continue;
    out[kind] = { kind, fileName: (r.file_name as string) ?? null, rows: r.rows as number, skipped: r.skipped as number, asOf: r.as_of as string, byName: (r.by_name as string) ?? null, at: r.at as string };
  }
  return out;
}

export async function stockSummary(): Promise<{ items: number; out: number }> {
  const { data, error } = await serverSupabase().from("stock_levels").select("qty").limit(20000);
  fail("Could not load the stock", error);
  const rows = (data ?? []) as { qty: number }[];
  return { items: rows.length, out: rows.filter((r) => Number(r.qty) <= 0).length };
}
