// Annual, medical, hospital, unpaid — time off, and whether it is paid.
import { deleteLeave, listLeave, saveLeave } from "@/lib/store-hr";
import { attempt, guard, num, problem, readBody, str, strOrNull } from "@/lib/route-helpers";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const stop = await guard();
  if (stop) return stop;
  const code = new URL(request.url).searchParams.get("code") ?? "";
  return attempt(async () => ({ leave: await listLeave(code || undefined) }));
}

export async function POST(request: Request) {
  const stop = await guard();
  if (stop) return stop;
  const b = await readBody(request);
  if (!b) return problem("Could not read what was sent.");
  const code = str(b.code);
  const from = str(b.fromDate);
  const to = str(b.toDate) || from;
  if (!code) return problem("Which worker is this for?");
  if (!from) return problem("Which day does the leave start?");
  if (to < from) return problem("The last day cannot be before the first day.");
  return attempt(() =>
    saveLeave({
      id: b.id ? Number(b.id) : undefined,
      code,
      kind: str(b.kind, "Annual"),
      fromDate: from,
      toDate: to,
      days: num(b.days, 1),
      paid: b.paid !== false,
      note: strOrNull(b.note),
    }),
  );
}

export async function DELETE(request: Request) {
  const stop = await guard();
  if (stop) return stop;
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!id) return problem("Which record should be removed?");
  return attempt(() => deleteLeave(id));
}
