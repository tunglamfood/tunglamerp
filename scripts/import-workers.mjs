// Brings the 85 workers into the system.
//
// Codes, names, sites and groups come from the June key-in sheet, which is the
// one file that carries the Million code beside every name. Scanner IDs come
// from the CheckTime enrolment list, matched on name.
//
// Run it with the app already running:  npm run dev,  then  node scripts/import-workers.mjs
import * as XLSX from "xlsx";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const KEYIN = fileURLToPath(
  new URL("../reference/MillionPayroll_KeyIn_June2026.xlsx", import.meta.url),
);
const ENROLLED = fileURLToPath(
  new URL("../data/CHECKTIME _WORKER NAME LIST _FORMAT.xls", import.meta.url),
);

const NATIONALITY = { B: "Bangladesh", M: "Myanmar", N: "Nepal" };

function readEnv(name) {
  const text = fs.readFileSync(".env.local", "utf8");
  const line = text.split(/\r?\n/).find((l) => l.startsWith(`${name}=`));
  if (!line) throw new Error(`${name} is not set in .env.local`);
  return line.slice(name.length + 1).trim();
}

// Names are keyed by different people in different files, in different word
// orders, and the scanner truncates at 24 characters. Compare on the sorted
// words, then fall back to a prefix match for the truncated ones.
const words = (s) =>
  String(s ?? "").toUpperCase().replace(/[^A-Z ]/g, " ").split(/\s+/).filter(Boolean);
const nameKey = (s) => words(s).sort().join(" ");
const squashed = (s) => words(s).join("");

function grid(path) {
  return XLSX.utils.sheet_to_json(
    XLSX.read(fs.readFileSync(path), { type: "buffer", raw: true }).Sheets[
      XLSX.read(fs.readFileSync(path), { type: "buffer", raw: true }).SheetNames[0]
    ],
    { header: 1, defval: null },
  );
}

// ── the worker list, from the June key-in sheet ──────────────────────────────
const keyIn = grid(KEYIN);
const header = keyIn.findIndex((r) => Array.isArray(r) && String(r[1] ?? "").trim() === "CODE");
if (header < 0) throw new Error("Could not find the CODE column in the June key-in sheet.");

const workers = [];
for (const row of keyIn.slice(header + 1)) {
  if (!Array.isArray(row)) continue;
  const code = String(row[1] ?? "").trim().toUpperCase();
  const name = String(row[2] ?? "").trim();
  if (!code || !name) continue;
  // GROUP reads like "KB B1" — the site and the group in one cell.
  const [site, group] = String(row[3] ?? "").trim().split(/\s+/);
  workers.push({
    code,
    name,
    site: site === "KL" ? "KL" : "KB",
    group: /^B[1-4]$/.test(group ?? "") ? group : "B1",
    nationality: NATIONALITY[code[0]] ?? "Malaysia",
    scannerId: "",
    status: "active",
  });
}

// ── scanner IDs, matched on name ─────────────────────────────────────────────
const enrolled = [];
for (const row of grid(ENROLLED).slice(1)) {
  if (!Array.isArray(row) || !row[0]) continue;
  enrolled.push({ id: String(row[0]).trim(), key: nameKey(row[1]), flat: squashed(row[1]) });
}

let matched = 0;
const notEnrolled = [];
for (const w of workers) {
  const key = nameKey(w.name);
  const flat = squashed(w.name);
  const hit =
    enrolled.find((e) => e.key === key) ??
    // The scanner cuts long names off at 24 characters, so a truncated entry
    // is still the same person.
    enrolled.find((e) => e.flat.length >= 8 && flat.startsWith(e.flat));
  if (hit) {
    w.scannerId = hit.id;
    matched++;
  } else {
    notEnrolled.push(`${w.code} ${w.name}`);
  }
}

// ── send them in ─────────────────────────────────────────────────────────────
const login = await fetch(`${BASE}/api/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ password: readEnv("APP_PASSWORD") }),
});
if (!login.ok) throw new Error(`Could not sign in: ${(await login.json()).error}`);
const cookie = login.headers.get("set-cookie")?.split(";")[0] ?? "";

let saved = 0;
const failures = [];
for (const w of workers) {
  const res = await fetch(`${BASE}/api/workers`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie },
    body: JSON.stringify(w),
  });
  if (res.ok) saved++;
  else failures.push(`${w.code} ${w.name}: ${(await res.json()).error}`);
}

console.log(`Read ${workers.length} workers from the June key-in sheet.`);
console.log(`Matched ${matched} of them to a scanner ID.`);
console.log(`Saved ${saved}.`);
if (notEnrolled.length) {
  console.log(
    `
${notEnrolled.length} are not on the scanner's enrolment list yet — they will show as ` +
      `"not enrolled" until they scan, or until you set their scanner ID by hand:`,
  );
  for (const n of notEnrolled) console.log("  " + n);
}
if (failures.length) {
  console.log(`\n${failures.length} could not be saved:`);
  for (const f of failures) console.log("  " + f);
}
