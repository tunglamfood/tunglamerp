// Somebody leaving: when they said, their last day, whether they are settled.
import { listExits, saveExit } from "@/lib/store-hr";
import { attempt, guard, numOrNull, problem, readBody, str, strOrNull } from "@/lib/route-helpers";

export const runtime = "nodejs";

export async function GET() {
  const stop = await guard();
  if (stop) return stop;
  return attempt(async () => ({ exits: await listExits() }));
}

export async function POST(request: Request) {
  const stop = await guard();
  if (stop) return stop;
  const b = await readBody(request);
  if (!b) return problem("Could not read what was sent.");
  const code = str(b.code);
  if (!code) return problem("Which worker is leaving?");
  const told = strOrNull(b.toldOn);
  const last = strOrNull(b.lastDay);
  if (told && last && last < told) {
    return problem("The last day cannot be before the day they told you.");
  }
  return attempt(() =>
    saveExit({
      code,
      toldOn: told,
      lastDay: last,
      reason: strOrNull(b.reason),
      noticeDays: numOrNull(b.noticeDays),
      finalPayNote: strOrNull(b.finalPayNote),
      settled: b.settled === true,
    }),
  );
}
