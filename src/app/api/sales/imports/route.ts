// Importing AutoCount exports: outstanding invoices or stock balance (Excel or CSV).
import * as XLSX from "xlsx";
import { currentUser } from "@/lib/supabase-server";
import { readAr, readStock, type Cell } from "@/lib/ar-import";
import { replaceInvoices, replaceStock } from "@/lib/store-ar";
import { guard, problem } from "@/lib/route-helpers";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const stop = await guard("sales");
  if (stop) return stop;
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return problem("Could not read the file that was sent.");
  }
  const kind = form.get("kind") === "stock" ? "stock" : "ar";
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return problem("Choose the AutoCount export first.");
  if (file.size > 8 * 1024 * 1024) return problem("That file is over 8 MB. Export only the columns needed.");

  let rows: Cell[][];
  try {
    const book = XLSX.read(Buffer.from(await file.arrayBuffer()), { type: "buffer", cellDates: true });
    const sheet = book.Sheets[book.SheetNames[0]];
    rows = XLSX.utils.sheet_to_json<Cell[]>(sheet, { header: 1, raw: true, defval: null });
  } catch {
    return problem("That file could not be opened. Save it from AutoCount as Excel (.xlsx) or CSV.");
  }

  const read = kind === "ar" ? readAr(rows) : readStock(rows);
  if (read.error) return problem(read.error);
  if (read.rows.length === 0) return problem("No rows could be read from that file.");
  const me = await currentUser();
  try {
    const result = kind === "ar"
      ? await replaceInvoices(readAr(rows).rows, read.skipped, file.name, me?.name ?? "Office")
      : await replaceStock(readStock(rows).rows, read.skipped, file.name, me?.name ?? "Office");
    return Response.json({ ok: true, value: { imported: result.imported, skipped: result.skipped.slice(0, 50), unknown: result.unknown.slice(0, 50) } });
  } catch (e) {
    return problem((e as Error).message, 500);
  }
}
