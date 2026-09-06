// The company's public holidays.
import { deleteHoliday, listHolidays, saveHoliday } from "@/lib/store-holidays";
import { attempt, guard, problem, readBody, str, strOrNull } from "@/lib/route-helpers";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const stop = await guard();
  if (stop) return stop;
  const year = new URL(request.url).searchParams.get("year") ?? "";
  return attempt(async () => ({ holidays: await listHolidays(year || undefined) }));
}

export async function POST(request: Request) {
  const stop = await guard();
  if (stop) return stop;
  const b = await readBody(request);
  if (!b) return problem("Could not read what was sent.");
  const onDate = str(b.onDate);
  const name = str(b.name);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(onDate)) return problem("Which day is the holiday?");
  if (!name) return problem("What is the holiday called?");
  return attempt(() =>
    saveHoliday({
      onDate,
      name,
      compulsory: b.compulsory === true,
      note: strOrNull(b.note),
    }),
  );
}

export async function DELETE(request: Request) {
  const stop = await guard();
  if (stop) return stop;
  const onDate = new URL(request.url).searchParams.get("date") ?? "";
  if (!onDate) return problem("Which holiday should be removed?");
  return attempt(() => deleteHoliday(onDate));
}
