// Brings the Sales module's starting data in from the Million exports:
// the debtor list, the SKU list, and the Penang price list.
//
// Run it with the app already running:  npm run dev,  then  node scripts/import-sales.mjs
import * as XLSX from "xlsx";
import fs from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const DIR = "c:/Users/USER/OneDrive/Desktop/TungLam/";
const CUSTOMERS = DIR + "IT_CUSTOMER LIST.xlsx";
const PRODUCTS = DIR + "IT_ITEM DESCRIPTION LIST.xlsx";
const PENANG = DIR + "IT_PRODUCT_COST_PENANG_CLEANED.xlsx";

function readEnv(name) {
  const text = fs.readFileSync(".env.local", "utf8");
  const line = text.split(/\r?\n/).find((l) => l.startsWith(`${name}=`));
  if (!line) throw new Error(`${name} is not set in .env.local`);
  return line.slice(name.length + 1).trim();
}

function grid(path) {
  const wb = XLSX.read(fs.readFileSync(path), { type: "buffer", raw: true });
  return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: null });
}

/** Million pads its exports with trailing spaces and carriage returns. */
const clean = (v) =>
  String(v ?? "").replace(/_x000D_/g, "\n").replace(/\r/g, "").trim();

/** Find the header row by a column name we know is on it. */
function headerRow(rows, name) {
  const i = rows.findIndex(
    (r) => Array.isArray(r) && r.some((c) => clean(c).toLowerCase() === name.toLowerCase()),
  );
  if (i < 0) throw new Error(`Could not find a "${name}" column in that file.`);
  return i;
}

const col = (header, name) =>
  header.findIndex((c) => clean(c).toLowerCase() === name.toLowerCase());

/** The address usually ends with ", State, Malaysia" — pull the state out. */
function stateFrom(address) {
  const parts = clean(address).split(/\n|,/).map((p) => p.trim()).filter(Boolean);
  const last = parts[parts.length - 1] ?? "";
  const state = /malaysia/i.test(last) ? parts[parts.length - 2] : last;
  return (state ?? "").replace(/\s+/g, " ").trim();
}

const login = await fetch(`${BASE}/api/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ password: readEnv("APP_PASSWORD") }),
});
if (!login.ok) throw new Error(`Could not sign in: ${(await login.json()).error}`);
const cookie = login.headers.get("set-cookie")?.split(";")[0] ?? "";

async function send(url, body) {
  const res = await fetch(`${BASE}${url}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie },
    body: JSON.stringify(body),
  });
  if (res.ok) return null;
  return (await res.json()).error ?? "unknown problem";
}

// ── Customers ────────────────────────────────────────────────────────────────
const cRows = grid(CUSTOMERS);
const cHead = cRows[headerRow(cRows, "Custcode")].map(clean);
const cStart = headerRow(cRows, "Custcode") + 1;
const cIdx = {
  code: col(cHead, "Custcode"), name: col(cHead, "Name"), addr: col(cHead, "Addr"),
  contact: col(cHead, "Contact"), email: col(cHead, "Email"), attn: col(cHead, "Attn"),
  business: col(cHead, "Business"), tax: col(cHead, "Income_taxno"),
};

let customers = 0;
const customerProblems = [];
for (const row of cRows.slice(cStart)) {
  if (!Array.isArray(row)) continue;
  const code = clean(row[cIdx.code]);
  const name = clean(row[cIdx.name]);
  if (!code || !name) continue;
  const address = clean(row[cIdx.addr]);
  const problem = await send("/api/sales/customers", {
    code,
    name,
    shortName: clean(row[cIdx.business]) || name,
    state: stateFrom(address),
    address: address || null,
    contact: clean(row[cIdx.contact]) || null,
    email: clean(row[cIdx.email]) || null,
    attn: clean(row[cIdx.attn]) || null,
    incomeTaxNo: clean(row[cIdx.tax]) || null,
    active: true,
  });
  if (problem) customerProblems.push(`${code}: ${problem}`);
  else customers++;
}

// ── Products ─────────────────────────────────────────────────────────────────
const pRows = grid(PRODUCTS);
const pStart = headerRow(pRows, "ItemCode") + 1;
const pHead = pRows[headerRow(pRows, "ItemCode")].map(clean);
const pIdx = {
  code: col(pHead, "ItemCode"), desc: col(pHead, "Description"), desc2: col(pHead, "Desc2"),
  group: col(pHead, "ItemGroup"), uom: col(pHead, "UOM"),
  price: col(pHead, "Price"), cost: col(pHead, "Cost"),
};
// The sheet has unlabelled spacer columns; ItemType sits two right of ItemGroup.
const typeIdx = pIdx.group + 2;

let products = 0;
const productProblems = [];
const known = new Set();
for (const row of pRows.slice(pStart)) {
  if (!Array.isArray(row)) continue;
  const itemCode = clean(row[pIdx.code]).toUpperCase();
  const description = clean(row[pIdx.desc]);
  if (!itemCode || !description) continue;
  const barcode = clean(row[pIdx.desc2]).replace(/^B\/C:\s*/i, "");
  const problem = await send("/api/sales/products", {
    itemCode,
    description,
    barcode: barcode || null,
    itemGroup: clean(row[pIdx.group]),
    itemType: clean(row[typeIdx]),
    uom: clean(row[pIdx.uom]),
    packSize: "",
    basePrice: Number(row[pIdx.price]) || 0,
    cost: Number(row[pIdx.cost]) || 0,
    active: true,
  });
  if (problem) productProblems.push(`${itemCode}: ${problem}`);
  else {
    products++;
    known.add(itemCode);
  }
}

// ── Penang prices ────────────────────────────────────────────────────────────
const prRows = grid(PENANG);
const prHead = prRows[0].map(clean);
const prIdx = {
  date: col(prHead, "Date"), acc: col(prHead, "Acc No"),
  price: col(prHead, "Cost Price"), item: col(prHead, "Item Code"),
};

let priced = 0;
const priceProblems = [];
const skipped = new Set();
for (const row of prRows.slice(1)) {
  if (!Array.isArray(row)) continue;
  const customerCode = clean(row[prIdx.acc]);
  const itemCode = clean(row[prIdx.item]).toUpperCase();
  if (!customerCode || !itemCode) continue;
  if (!known.has(itemCode)) {
    skipped.add(itemCode);
    continue;
  }
  const raw = row[prIdx.date];
  const effectiveFrom =
    typeof raw === "string" && /^\d{4}-\d{2}-\d{2}/.test(raw)
      ? raw.slice(0, 10)
      : new Date((Number(raw) - 25569) * 86400000).toISOString().slice(0, 10);

  const problem = await send("/api/sales/prices", {
    customerCode,
    itemCode,
    price: Number(row[prIdx.price]) || 0,
    effectiveFrom,
    note: "From the Penang cost sheet",
  });
  if (problem) priceProblems.push(`${customerCode} ${itemCode}: ${problem}`);
  else priced++;
}

console.log(`Customers saved : ${customers}`);
console.log(`Products saved  : ${products}`);
console.log(`Prices saved    : ${priced}`);
for (const [label, list] of [
  ["customers", customerProblems],
  ["products", productProblems],
  ["prices", priceProblems],
]) {
  if (list.length) {
    console.log(`\n${list.length} ${label} could not be saved:`);
    for (const p of list.slice(0, 10)) console.log("  " + p);
    if (list.length > 10) console.log(`  …and ${list.length - 10} more`);
  }
}
if (skipped.size) {
  console.log(
    `\n${skipped.size} priced items are not in the SKU list, so their prices were skipped:`,
  );
  console.log("  " + [...skipped].slice(0, 12).join(", "));
}
