// Plain arithmetic on order lines, kept apart from the database code so it can be tested.

/** What changed between two versions of an order's lines, item by item. */
export function lineChanges(
  before: { item_code: string; qty: number; uom: string }[],
  after: { itemCode: string; qty: number; uom: string }[],
): { item: string; from: number; to: number; uom: string }[] {
  const sum = (rows: { code: string; qty: number; uom: string }[]) => {
    const m = new Map<string, { qty: number; uom: string }>();
    for (const r of rows) {
      const k = r.code.toUpperCase();
      m.set(k, { qty: (m.get(k)?.qty ?? 0) + Number(r.qty), uom: r.uom });
    }
    return m;
  };
  const a = sum(before.map((l) => ({ code: l.item_code, qty: l.qty, uom: l.uom })));
  const b = sum(after.map((l) => ({ code: l.itemCode, qty: l.qty, uom: l.uom })));
  const out: { item: string; from: number; to: number; uom: string }[] = [];
  for (const code of new Set([...a.keys(), ...b.keys()])) {
    const from = a.get(code)?.qty ?? 0;
    const to = b.get(code)?.qty ?? 0;
    if (from !== to) out.push({ item: code, from, to, uom: b.get(code)?.uom ?? a.get(code)?.uom ?? "" });
  }
  return out;
}
