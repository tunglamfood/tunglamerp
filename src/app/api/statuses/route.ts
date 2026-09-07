// The statuses a worker can have, and the one thing each of them decides:
// whether those people are paid this month.
import { requireSession } from "@/lib/supabase-server";
import { listStatuses, upsertStatus } from "@/lib/store";

export const runtime = "nodejs";

export async function GET() {
  if (!(await requireSession())) {
    return Response.json({ error: "Please sign in again." }, { status: 401 });
  }
  try {
    return Response.json({ statuses: await listStatuses() });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!(await requireSession())) {
    return Response.json({ error: "Please sign in again." }, { status: 401 });
  }
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Could not read what was sent." }, { status: 400 });
  }

  const name = String(body.name ?? "").trim();
  if (!name) return Response.json({ error: "A status needs a name." }, { status: 400 });
  if (name.length > 40) {
    return Response.json({ error: "That status name is too long." }, { status: 400 });
  }

  try {
    await upsertStatus({
      name,
      countsAsWorking: body.countsAsWorking === true,
      sortOrder: Number(body.sortOrder) || 100,
    });
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
