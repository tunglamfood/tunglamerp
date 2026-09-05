import { requireSession } from "@/lib/supabase-server";
import { loadExtras } from "@/lib/store";
import { isMonthKey, loadMonthView } from "@/lib/month-loader";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!(await requireSession())) {
    return Response.json({ error: "Please sign in again." }, { status: 401 });
  }
  const monthKey = new URL(request.url).searchParams.get("month");
  if (!isMonthKey(monthKey)) {
    return Response.json({ error: "Choose a month first." }, { status: 400 });
  }
  try {
    const [view, extras] = await Promise.all([loadMonthView(monthKey), loadExtras(monthKey)]);
    return Response.json({ ...view, extras: Object.fromEntries(extras) });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
