// Reading AutoCount exports: outstanding invoices (for aging and dealer statements)
// and stock balances. AutoCount reports put a title, the company name and the date
// above the column headings, and the headings differ a little between versions, so
// the heading row is found by its words rather than by position.

export type Cell = string | number | boolean | Date | null | undefined;

const norm = (v: Cell) => String(v ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

type Wanted = Record<string, { names: string[]; required: boolean }>;

export const AR_FIELDS: Wanted = {
  customer: { names: ["debtor code", "debtor", "customer code", "cust code", "account no", "acc no", "account code", "code"], required: true },
  docNo: { names: ["doc no", "document no", "invoice no", "inv no", "doc number", "document number"], required: true },
  docDate: { names: ["doc date", "document date", "invoice date", "date"], required: true },
  dueDate: { names: ["due date", "due"], required: false },
  amount: { names: ["local net total", "net total", "invoice amount", "doc amount", "original amount", "amount", "total"], required: false },
  outstanding: { names: ["outstanding", "outstanding amount", "local outstanding", "os amount", "o s amount", "balance", "balance amount", "unpaid"], required: true },
  docType: { names: ["doc type", "document type", "type"], required: false },
  ref: { names: ["ref", "ref no", "their ref", "reference"], required: false },
};

export const STOCK_FIELDS: Wanted = {
  item: { names: ["item code", "stock code", "product code", "item", "code"], required: true },
  qty: { names: ["balance qty", "bal qty", "qty on hand", "on hand", "closing qty", "stock balance", "balance", "quantity", "qty"], required: true },
  uom: { names: ["uom", "unit"], required: false },
};

/** Where each wanted field sits in a heading row; exact names win over partial ones. */
export function mapHeadings(row: Cell[], wanted: Wanted): Record<string, number> | null {
  const heads = row.map(norm);
  const used = new Set<number>();
  const out: Record<string, number> = {};
  for (const [field, { names }] of Object.entries(wanted)) {
    let at = -1;
    for (const n of names) {
      at = heads.findIndex((h, i) => !used.has(i) && h === n);
      if (at >= 0) break;
    }
    if (at < 0) {
      for (const n of names) {
        if (n.length < 4) continue;
        at = heads.findIndex((h, i) => !used.has(i) && h.includes(n));
        if (at >= 0) break;
      }
    }
    if (at >= 0) {
      out[field] = at;
      used.add(at);
    }
  }
  const missing = Object.entries(wanted).filter(([f, w]) => w.required && out[f] === undefined);
  return missing.length ? null : out;
}

/** The first row (of the first 25) that has every required heading. */
export function findHeadingRow(rows: Cell[][], wanted: Wanted): { index: number; map: Record<string, number> } | null {
  for (let i = 0; i < Math.min(rows.length, 25); i++) {
    const map = mapHeadings(rows[i] ?? [], wanted);
    if (map) return { index: i, map };
  }
  return null;
}

/** yyyy-mm-dd from an Excel date number, a Date, dd/MM/yyyy, yyyy-mm-dd or 15-Nov-2026. */
export function parseDate(v: Cell): string | null {
  if (v == null || v === "") return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v.toISOString().slice(0, 10);
  if (typeof v === "number") {
    if (v < 20000 || v > 80000) return null;
    return new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400_000).toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  if (m) return iso(+m[1], +m[2], +m[3]);
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/.exec(s);
  if (m) return iso(m[3].length === 2 ? 2000 + +m[3] : +m[3], +m[2], +m[1]);
  m = /^(\d{1,2})[\s-]([A-Za-z]{3})[a-z]*[\s-](\d{2,4})$/.exec(s);
  if (m) {
    const mon = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"].indexOf(m[2].toLowerCase());
    if (mon >= 0) return iso(m[3].length === 2 ? 2000 + +m[3] : +m[3], mon + 1, +m[1]);
  }
  return null;
}

function iso(y: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 2000 || y > 2100) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCMonth() === m - 1 ? date.toISOString().slice(0, 10) : null;
}

/** 1,234.50 · (1,234.50) · 1234.50 CR → a number; blank or words → null. */
export function parseNum(v: Cell): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (v == null) return null;
  let s = String(v).trim().toUpperCase().replace(/RM|S\$|MYR|SGD|,|\s/g, "");
  if (!s) return null;
  let sign = 1;
  if (/^\(.*\)$/.test(s)) { sign = -1; s = s.slice(1, -1); }
  if (s.endsWith("CR")) { sign = -1; s = s.slice(0, -2); } else if (s.endsWith("DR")) s = s.slice(0, -2);
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  return sign * Number(s);
}

export interface ArRow { customerCode: string; docNo: string; docType: string; docDate: string; dueDate: string | null; amount: number; outstanding: number; ref: string | null }
export interface StockRow { itemCode: string; qty: number; uom: string | null }
export interface Skip { line: number; reason: string }

export function readAr(rows: Cell[][]): { rows: ArRow[]; skipped: Skip[]; error?: string } {
  const head = findHeadingRow(rows, AR_FIELDS);
  if (!head) return { rows: [], skipped: [], error: "Could not find the columns. The file needs Debtor Code, Doc No, Doc Date and Outstanding (or Balance) headings." };
  const out: ArRow[] = [];
  const skipped: Skip[] = [];
  const seen = new Set<string>();
  const m = head.map;
  for (let i = head.index + 1; i < rows.length; i++) {
    const r = rows[i] ?? [];
    const customerCode = String(r[m.customer] ?? "").trim();
    const docNo = String(r[m.docNo] ?? "").trim();
    if (!customerCode && !docNo) continue; // blank or total lines
    if (!customerCode || !docNo || /total/i.test(customerCode)) { skipped.push({ line: i + 1, reason: "no debtor code or document number" }); continue; }
    const docDate = parseDate(r[m.docDate]);
    const outstanding = parseNum(r[m.outstanding]);
    if (!docDate) { skipped.push({ line: i + 1, reason: `${docNo}: date not readable` }); continue; }
    if (outstanding == null) { skipped.push({ line: i + 1, reason: `${docNo}: outstanding amount not readable` }); continue; }
    const key = `${customerCode}|${docNo}`;
    if (seen.has(key)) { skipped.push({ line: i + 1, reason: `${docNo}: listed twice` }); continue; }
    seen.add(key);
    out.push({
      customerCode,
      docNo,
      docType: m.docType !== undefined ? String(r[m.docType] ?? "").trim().toUpperCase().slice(0, 10) || "IV" : "IV",
      docDate,
      dueDate: m.dueDate !== undefined ? parseDate(r[m.dueDate]) : null,
      amount: (m.amount !== undefined ? parseNum(r[m.amount]) : null) ?? outstanding,
      outstanding,
      ref: m.ref !== undefined ? String(r[m.ref] ?? "").trim().slice(0, 60) || null : null,
    });
  }
  return { rows: out, skipped };
}

export function readStock(rows: Cell[][]): { rows: StockRow[]; skipped: Skip[]; error?: string } {
  const head = findHeadingRow(rows, STOCK_FIELDS);
  if (!head) return { rows: [], skipped: [], error: "Could not find the columns. The file needs Item Code and Balance Qty (or Qty) headings." };
  const byItem = new Map<string, StockRow>();
  const skipped: Skip[] = [];
  const m = head.map;
  for (let i = head.index + 1; i < rows.length; i++) {
    const r = rows[i] ?? [];
    const itemCode = String(r[m.item] ?? "").trim().toUpperCase();
    if (!itemCode || /total/i.test(itemCode)) continue;
    const qty = parseNum(r[m.qty]);
    if (qty == null) { skipped.push({ line: i + 1, reason: `${itemCode}: quantity not readable` }); continue; }
    // The same item in several locations adds up.
    const prev = byItem.get(itemCode);
    byItem.set(itemCode, { itemCode, qty: (prev?.qty ?? 0) + qty, uom: (m.uom !== undefined ? String(r[m.uom] ?? "").trim() : "") || prev?.uom || null });
  }
  return { rows: [...byItem.values()], skipped };
}

export interface AgingRow { customerCode: string; current: number; d30: number; d60: number; d90: number; over90: number; total: number; oldest: string | null }

/** Outstanding by customer, by days past due (or past the document date when there is no due date). */
export function aging(invoices: { customerCode: string; docDate: string; dueDate: string | null; outstanding: number }[], today: string): AgingRow[] {
  const t = Date.parse(`${today}T00:00:00Z`);
  const by = new Map<string, AgingRow>();
  for (const inv of invoices) {
    if (!inv.outstanding) continue;
    const row = by.get(inv.customerCode) ?? { customerCode: inv.customerCode, current: 0, d30: 0, d60: 0, d90: 0, over90: 0, total: 0, oldest: null };
    const days = Math.floor((t - Date.parse(`${inv.dueDate ?? inv.docDate}T00:00:00Z`)) / 86400_000);
    const key = days <= 0 ? "current" : days <= 30 ? "d30" : days <= 60 ? "d60" : days <= 90 ? "d90" : "over90";
    row[key] = Math.round((row[key] + inv.outstanding) * 100) / 100;
    row.total = Math.round((row.total + inv.outstanding) * 100) / 100;
    if (!row.oldest || inv.docDate < row.oldest) row.oldest = inv.docDate;
    by.set(inv.customerCode, row);
  }
  return [...by.values()].sort((a, b) => b.over90 - a.over90 || b.total - a.total);
}
