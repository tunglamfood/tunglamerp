// Which hostel room, which van — the things attached to a worker.
import { deleteAssignment, listAssignments, saveAssignment } from "@/lib/store-hr";
import { attempt, guard, problem, readBody, str, strOrNull } from "@/lib/route-helpers";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const stop = await guard();
  if (stop) return stop;
  const code = new URL(request.url).searchParams.get("code") ?? "";
  return attempt(async () => ({ assignments: await listAssignments(code || undefined) }));
}

export async function POST(request: Request) {
  const stop = await guard();
  if (stop) return stop;
  const b = await readBody(request);
  if (!b) return problem("Could not read what was sent.");
  const code = str(b.code);
  const value = str(b.value);
  if (!code) return problem("Which worker is this for?");
  if (!value) return problem("Which room or van is it?");
  return attempt(() =>
    saveAssignment({
      id: b.id ? Number(b.id) : undefined,
      code,
      kind: str(b.kind, "Hostel"),
      value,
      fromDate: strOrNull(b.fromDate),
      toDate: strOrNull(b.toDate),
      note: strOrNull(b.note),
    }),
  );
}

export async function DELETE(request: Request) {
  const stop = await guard();
  if (stop) return stop;
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!id) return problem("Which record should be removed?");
  return attempt(() => deleteAssignment(id));
}
