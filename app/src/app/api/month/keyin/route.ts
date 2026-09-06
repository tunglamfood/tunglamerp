// A month keyed in by hand, one worker at a time.
import { saveCorrections } from "@/lib/store";
import { isMonthKey, loadMonthView } from "@/lib/month-loader";
import { loadMonth } from "@/lib/store";
import { attempt, guard, problem, readBody, str } from "@/lib/route-helpers";
import { normalizeTime } from "@/lib/time";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const stop = await guard();
  if (stop) return stop;
  const url = new URL(request.url);
  const month = url.searchParams.get("month") ?? "";
  const code = str(url.searchParams.get("code"));
  if (!isMonthKey(month)) return problem("Which month?");
  if (!code) return problem("Which worker?");

  return attempt(async () => {
    const all = await loadMonth(month);
    return { days: all.get(code) ?? [] };
  });
}

export async function POST(request: Request) {
  const stop = await guard();
  if (stop) return stop;
  const b = await readBody(request);
  if (!b) return problem("Could not read what was sent.");

  const month = str(b.month);
  const code = str(b.code).toUpperCase();
  if (!isMonthKey(month)) return problem("Which month?");
  if (!code) return problem("Which worker?");
  if (!Array.isArray(b.days)) return problem("No days were sent.");

  const days: { date: string; first: string | null; last: string | null; absent: boolean }[] = [];
  for (const raw of b.days as Record<string, unknown>[]) {
    const date = str(raw.date);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !date.startsWith(month)) continue;
    const absent = raw.absent === true;
    // "1930" and "19.30" both mean half past seven; normalizeTime settles it.
    const first = absent ? null : normalizeTime(str(raw.first));
    const last = absent ? null : normalizeTime(str(raw.last));
    if (!absent && ((raw.first && !first) || (raw.last && !last))) {
      return problem(
        `"${str(raw.first) || str(raw.last)}" on ${date} is not a time. Type it like 07:00, ` +
          "or just 700.",
      );
    }
    days.push({ date, first, last, absent });
  }

  return attempt(async () => {
    await saveCorrections(month, code, days);
    // Hand back the recalculated month so the screen shows the new totals.
    const view = await loadMonthView(month);
    return { totals: view.totals.find((t) => t.code === code) ?? null };
  });
}
