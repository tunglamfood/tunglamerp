// The Million import file. Refuses while anything is still to check — that
// refusal is the whole reason this system can be trusted with wages.
import { requireSession } from "@/lib/supabase-server";
import { loadExtras } from "@/lib/store";
import { isMonthKey, loadMonthView } from "@/lib/month-loader";
import { writeMillionXls } from "@/lib/million-writer";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!(await requireSession())) return new Response("Please sign in.", { status: 401 });

  const monthKey = new URL(request.url).searchParams.get("month");
  if (!isMonthKey(monthKey)) return new Response("Choose a month first.", { status: 400 });

  const [view, extras] = await Promise.all([loadMonthView(monthKey), loadExtras(monthKey)]);

  if (view.flags.length > 0) {
    const n = view.flags.length;
    return new Response(
      `There ${n === 1 ? "is 1 thing" : `are ${n} things`} still to check. ` +
        `Clear the Check & fix list, then download again.`,
      { status: 409 },
    );
  }

  const file = writeMillionXls(view.totals, extras);
  return new Response(new Uint8Array(file), {
    headers: {
      "Content-Type": "application/vnd.ms-excel",
      "Content-Disposition": `attachment; filename="MILLION_IMPORT_${monthKey}.xls"`,
    },
  });
}
