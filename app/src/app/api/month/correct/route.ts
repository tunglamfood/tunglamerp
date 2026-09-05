// One correction from the Check & fix list.
import { requireSession } from "@/lib/supabase-server";
import { loadExtras, saveCorrection } from "@/lib/store";
import { isMonthKey, loadMonthView } from "@/lib/month-loader";
import { normalizeTime } from "@/lib/time";

export const runtime = "nodejs";

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

  const monthKey = String(body.month ?? "");
  const code = String(body.code ?? "").trim();
  const date = String(body.date ?? "").trim();
  if (!isMonthKey(monthKey)) return Response.json({ error: "Choose a month first." }, { status: 400 });
  if (!code || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return Response.json({ error: "That correction is missing a worker or a date." }, { status: 400 });
  }

  const markedAbsent = body.markedAbsent === true;
  const first = markedAbsent ? null : normalizeTime(body.firstOverride as string);
  const last = markedAbsent ? null : normalizeTime(body.lastOverride as string);

  if (!markedAbsent && (!first || !last)) {
    return Response.json(
      { error: "Give both a start and a finish time, like 07:00 and 19:00 — or mark the day absent." },
      { status: 400 },
    );
  }

  try {
    await saveCorrection(monthKey, code, date, {
      firstOverride: first,
      lastOverride: last,
      markedAbsent,
    });
    const [view, extras] = await Promise.all([loadMonthView(monthKey), loadExtras(monthKey)]);
    return Response.json({ ...view, extras: Object.fromEntries(extras) });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
