// Turning a customer's own order into the sheet the picking team works from.
//
// Orders arrive in whatever shape the customer keeps: a WhatsApp message, a
// photographed order book, their own spreadsheet. Somebody in the office has
// been retyping those into our format. The model does the reading; this file
// does the resolving.
//
// The split matters. A model asked to produce item codes will produce
// plausible ones — "TK400" for TK4P — and a plausible wrong code is worse than
// no code, because it picks and invoices the wrong thing. So the model is asked
// only for what the order actually says, and every code is resolved here
// against the real catalogue. Anything that cannot be resolved is handed back
// unresolved for a person to settle, never guessed.
import { Customer, Product } from "./types";

/** One line as the model read it off the customer's order. */
export interface ReadLine {
  /** The item exactly as the order writes it. */
  itemText: string;
  /** The outlet as the order writes it, empty when the order is for one shop. */
  outletText: string;
  qty: number;
}

export interface MatchedLine extends ReadLine {
  itemCode: string | null;
  itemName: string | null;
  outletCode: string | null;
  outletName: string | null;
  /** How the item was settled, so the office can see what to double-check. */
  how: "alias" | "code" | "name" | "none";
}

export interface Reading {
  lines: MatchedLine[];
  /** Anything the model noticed that is not an order line — a delivery date, a note. */
  deliverOn: string | null;
  note: string | null;
}

/** Letters and digits only, upper case — so "TK 400GM" and "tk400gm" meet. */
export const key = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");

/**
 * The three groups that hold finished goods.
 *
 * The product list also carries packaging film, raw materials, waste codes and
 * an ADVERTISEMENT line. Without this, "cincau asli 2kg" matched
 * "PE PRINTED BAG - CINCAU ASLI 2KG" — the bag rather than the cincau, which
 * would have been picked, packed and invoiced.
 */
const SELLS = new Set(["KB", "KL", "TRADING"]);

/** Something a customer can actually order. */
export const isSellable = (p: Product) =>
  p.active && SELLS.has((p.itemGroup ?? "").trim().toUpperCase());

/**
 * The catalogue the model is shown.
 *
 * Only what it needs to recognise a line: the office's own shorthand where
 * there is one, because that is what the customer's order is most likely to
 * echo, and the full name behind it.
 */
export function catalogueFor(
  products: Product[],
  aliases: Record<string, string>,
): { code: string; alias: string; name: string }[] {
  return products
    .filter(isSellable)
    .map((p) => ({ code: p.itemCode, alias: aliases[p.itemCode] ?? "", name: p.description }));
}

/**
 * The outlets the model is shown.
 *
 * The short code leads, because that is what an order writes: a column headed
 * SNW, or a line that starts "SEMENYIH:". The full name follows for the cases
 * where it is spelled out.
 */
export function outletsFor(
  customers: Customer[],
): { code: string; short: string; name: string }[] {
  return customers.map((c) => ({
    code: c.code,
    short: c.shortCode ?? "",
    name: c.shortName || c.name,
  }));
}

/**
 * Reads the model's answer without trusting its shape.
 *
 * A reply that is not the agreed shape is a failure to read the order, not
 * something to salvage a few lines out of — half an order picked is worse than
 * none, because nobody would know which half.
 */
export function parseReading(raw: string): { lines: ReadLine[]; deliverOn: string | null; note: string | null } | null {
  let text = raw.trim();
  // Models fence JSON in ```json blocks often enough to be worth handling.
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) text = fence[1].trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;

  const body = parsed as Record<string, unknown>;
  if (!Array.isArray(body.lines)) return null;

  const lines: ReadLine[] = [];
  for (const raw of body.lines as Record<string, unknown>[]) {
    if (!raw || typeof raw !== "object") continue;
    const itemText = String(raw.itemText ?? "").trim();
    const qty = Number(raw.qty);
    if (!itemText || !Number.isFinite(qty) || qty <= 0) continue;
    lines.push({ itemText, outletText: String(raw.outletText ?? "").trim(), qty });
  }

  const deliverOn = String(body.deliverOn ?? "").trim();
  return {
    lines,
    deliverOn: /^\d{4}-\d{2}-\d{2}$/.test(deliverOn) ? deliverOn : null,
    note: String(body.note ?? "").trim() || null,
  };
}

/**
 * Settles each read line against the real catalogue.
 *
 * Tried in order of how sure each match is: the office's own shorthand, then
 * the Million code, then the full name. A line that matches none of them comes
 * back with no code at all — which is what puts it in front of a person.
 */
export function matchReading(
  read: { lines: ReadLine[]; deliverOn: string | null; note: string | null },
  products: Product[],
  aliases: Record<string, string>,
  outlets: Customer[],
  outletAliases: Record<string, string> = {},
): Reading {
  const byAlias = new Map<string, string>();
  for (const [itemCode, alias] of Object.entries(aliases)) {
    if (alias) byAlias.set(key(alias), itemCode);
  }
  // Matching only ever looks at things we sell, so a bag of film can never be
  // mistaken for what goes inside it.
  const sellable = products.filter(isSellable);
  const byCode = new Map(sellable.map((p) => [key(p.itemCode), p.itemCode]));
  const byName = new Map(sellable.map((p) => [key(p.description), p.itemCode]));
  const nameOf = new Map(sellable.map((p) => [p.itemCode, p.description]));

  const lines = read.lines.map((l): MatchedLine => {
    const k = key(l.itemText);
    let itemCode: string | null = null;
    let how: MatchedLine["how"] = "none";

    if (byAlias.has(k)) { itemCode = byAlias.get(k)!; how = "alias"; }
    else if (byCode.has(k)) { itemCode = byCode.get(k)!; how = "code"; }
    else if (byName.has(k)) { itemCode = byName.get(k)!; how = "name"; }
    else {
      // One clear partial match is a match; two or more is a decision, and a
      // decision belongs to the office rather than to a coin toss.
      const hits = sellable.filter(
        (p) => key(p.description).includes(k) || k.includes(key(p.itemCode)),
      );
      if (hits.length === 1) { itemCode = hits[0].itemCode; how = "name"; }
    }

    const outlet = matchOutlet(l.outletText, outlets, outletAliases);
    return {
      ...l,
      itemCode,
      itemName: itemCode ? (nameOf.get(itemCode) ?? null) : null,
      outletCode: outlet?.code ?? null,
      outletName: outlet ? outlet.shortName || outlet.name : null,
      how,
    };
  });

  return { lines, deliverOn: read.deliverOn, note: read.note };
}

/** An outlet named however the customer names it: SNW, Senawang, the full title. */
export function matchOutlet(
  text: string,
  outlets: Customer[],
  /** Other names a branch answers to: SETIAWANGSA, Selayang, TMN EHSAN. */
  outletAliases: Record<string, string> = {},
): Customer | undefined {
  const k = key(text);
  if (!k) return outlets.length === 1 ? outlets[0] : undefined;

  // The everyday name first. A branch is called Setiawangsa by everyone and
  // "ST SW" by nobody, and the Million name contains only the latter.
  const aliased = outletAliases[k];
  if (aliased) {
    const found = outlets.find((o) => o.code === aliased);
    if (found) return found;
  }

  const exact = outlets.find(
    (o) => key(o.code) === k || key(o.shortCode ?? "") === k || key(o.shortName) === k,
  );
  if (exact) return exact;

  const hits = outlets.filter((o) => key(o.name).includes(k) || key(o.shortName).includes(k));
  return hits.length === 1 ? hits[0] : undefined;
}

/** What the office has to settle before this reading can become a sheet. */
export function readingProblems(r: Reading, outletCount: number): string[] {
  const out: string[] = [];
  if (r.lines.length === 0) return ["Nothing on this order could be read as a line."];

  const noItem = r.lines.filter((l) => !l.itemCode);
  if (noItem.length > 0) {
    out.push(
      `${noItem.length} ${noItem.length === 1 ? "line does" : "lines do"} not match any product: ` +
        `${noItem.map((l) => `"${l.itemText}"`).join(", ")}.`,
    );
  }

  if (outletCount > 1) {
    const noOutlet = r.lines.filter((l) => l.itemCode && !l.outletCode);
    if (noOutlet.length > 0) {
      out.push(
        `${noOutlet.length} ${noOutlet.length === 1 ? "line does" : "lines do"} not say which ` +
          "outlet they are for.",
      );
    }
  }

  const byName = r.lines.filter((l) => l.how === "name").length;
  if (byName > 0) {
    out.push(
      `${byName} ${byName === 1 ? "line was" : "lines were"} matched on the product name rather ` +
        "than a code. Worth checking those before saving.",
    );
  }

  return out;
}

/** The instructions the model is given. Kept here so it can be read and argued with. */
export const READER_SYSTEM = `You read a customer's purchase order and report what it says.

You are NOT filling in a form and you are NOT choosing product codes. Report
only what the order actually says, line by line.

Return JSON and nothing else, in exactly this shape:

{
  "lines": [
    { "itemText": "<the item exactly as the order writes it>",
      "outletText": "<the outlet/branch as the order writes it, or empty>",
      "qty": <number> }
  ],
  "deliverOn": "<YYYY-MM-DD if the order states a delivery date, else empty>",
  "note": "<anything else worth passing on, else empty>"
}

Rules:
- One entry per item per outlet. If a grid has an item across several outlet
  columns, that is one entry per column that has a number in it.
- An empty cell is not an order. Do not invent a zero.
- Copy the item text as written. Do not tidy it, translate it or expand it.
- Never guess a quantity you cannot read. Leave the line out and say so in note.
- If the order is for a single shop with no branch named, leave outletText empty.
- A catalogue may be supplied to help you read unclear handwriting. Use it only
  to decide what the text says, never to substitute a different product.`;
