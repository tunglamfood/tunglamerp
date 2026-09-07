// Allowances, advances, levy, hostel — any money line against a worker.
import { deletePayItem, listPayItems, savePayItem } from "@/lib/store-hr";
import { MONTH_KEY, attempt, guard, num, problem, readBody, str, strOrNull } from "@/lib/route-helpers";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const stop = await guard();
  if (stop) return stop;
  const month = new URL(request.url).searchParams.get("month") ?? "";
  return attempt(async () => ({ items: await listPayItems(month || undefined) }));
}

export async function POST(request: Request) {
  const stop = await guard();
  if (stop) return stop;
  const b = await readBody(request);
  if (!b) return problem("Could not read what was sent.");
  const code = str(b.code);
  const monthKey = str(b.monthKey);
  const kind = str(b.kind);
  if (!code) return problem("Which worker is this for?");
  if (!MONTH_KEY.test(monthKey)) return problem("Which month is this for?");
  if (!kind) return problem("Is this an allowance, an advance or a deduction?");
  return attempt(() =>
    savePayItem({
      id: b.id ? Number(b.id) : undefined,
      monthKey,
      code,
      kind,
      label: str(b.label),
      amount: num(b.amount),
      note: strOrNull(b.note),
    }),
  );
}

export async function DELETE(request: Request) {
  const stop = await guard();
  if (stop) return stop;
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!id) return problem("Which line should be removed?");
  return attempt(() => deletePayItem(id));
}
