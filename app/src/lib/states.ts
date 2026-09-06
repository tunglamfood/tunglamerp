// Working out which state a customer is in, from an address typed by hand over
// many years by many people.
//
// This matters more than it looks: prices are set state by state, so "PERAK"
// and "Perak" counted separately means two half-answers to every question about
// Perak. And Penang is written "Pulau Pinang" throughout, so looking for the
// word "Penang" finds nothing at all.

/** The states and territories, each with the ways they actually appear. */
const STATES: { name: string; spellings: string[] }[] = [
  { name: "Johor", spellings: ["johor", "johore"] },
  { name: "Kedah", spellings: ["kedah"] },
  { name: "Kelantan", spellings: ["kelantan"] },
  { name: "Melaka", spellings: ["melaka", "malacca"] },
  { name: "Negeri Sembilan", spellings: ["negeri sembilan", "n sembilan", "n. sembilan"] },
  { name: "Pahang", spellings: ["pahang"] },
  { name: "Penang", spellings: ["pulau pinang", "p pinang", "p. pinang", "penang", "pinang"] },
  { name: "Perak", spellings: ["perak"] },
  { name: "Perlis", spellings: ["perlis"] },
  { name: "Sabah", spellings: ["sabah"] },
  { name: "Sarawak", spellings: ["sarawak"] },
  { name: "Selangor", spellings: ["selangor"] },
  { name: "Terengganu", spellings: ["terengganu", "trengganu"] },
  { name: "Kuala Lumpur", spellings: ["kuala lumpur", "w.p. kuala lumpur", "wilayah persekutuan"] },
  { name: "Putrajaya", spellings: ["putrajaya"] },
  { name: "Labuan", spellings: ["labuan"] },
  { name: "Singapore", spellings: ["singapore", "singapura"] },
];

/**
 * The state an address is in, or "" when none can be found.
 *
 * The whole address is searched rather than only its last line, because the
 * state is written in a different place in almost every record — sometimes on
 * its own line, sometimes after the postcode, sometimes before "Malaysia".
 */
export function stateFromAddress(address: string | null | undefined): string {
  const text = String(address ?? "")
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ");
  if (!text.trim()) return "";

  // Longest spelling first, so "negeri sembilan" is not beaten by a stray word.
  // Padded and matched on whole words, so "perak" cannot match inside
  // "perakaunan" — and there is no escaping to get wrong.
  const padded = ` ${text.trim()} `;
  const found = STATES.flatMap((s) => s.spellings.map((sp) => ({ name: s.name, sp })))
    .sort((a, b) => b.sp.length - a.sp.length)
    .find((s) => padded.includes(` ${s.sp} `));

  return found?.name ?? "";
}

/**
 * Tidies a state somebody typed by hand into the one spelling the system uses,
 * so "PERAK", "perak" and "Perak" are one thing and not three.
 */
export function tidyState(value: string | null | undefined): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const known = stateFromAddress(raw);
  if (known) return known;
  // Not a state we know — keep the words, drop postcodes and stray punctuation,
  // and give it a consistent shape rather than throwing it away.
  const cleaned = raw
    .replace(/\d+/g, " ")
    .replace(/[^A-Za-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "";
  return cleaned
    .toLowerCase()
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
