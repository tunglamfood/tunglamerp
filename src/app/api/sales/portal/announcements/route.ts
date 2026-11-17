// Notices the office shows dealers on the portal's home page.
import { deleteAnnouncement, saveAnnouncement } from "@/lib/store-portal";
import { attempt, guard, problem, readBody, str, strOrNull } from "@/lib/route-helpers";

export const runtime = "nodejs";

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const day = (v: unknown) => {
  const s = str(v);
  return DAY.test(s) ? s : null;
};

export async function POST(request: Request) {
  const stop = await guard("sales");
  if (stop) return stop;
  const b = await readBody(request);
  if (!b) return problem("Could not read what was sent.");

  const titleEn = str(b.titleEn).slice(0, 120);
  if (!titleEn) return problem("Every announcement needs an English title.");
  const startsOn = day(b.startsOn);
  const endsOn = day(b.endsOn);
  if (startsOn && endsOn && endsOn < startsOn) return problem("It cannot end before it starts.");
  const id = Number(b.id);

  return attempt(() =>
    saveAnnouncement({
      id: Number.isInteger(id) && id > 0 ? id : undefined,
      titleEn,
      titleMs: strOrNull(b.titleMs)?.slice(0, 120) ?? null,
      titleZh: strOrNull(b.titleZh)?.slice(0, 120) ?? null,
      bodyEn: str(b.bodyEn).slice(0, 2000),
      bodyMs: strOrNull(b.bodyMs)?.slice(0, 2000) ?? null,
      bodyZh: strOrNull(b.bodyZh)?.slice(0, 2000) ?? null,
      startsOn,
      endsOn,
      active: b.active !== false,
    }),
  );
}

export async function DELETE(request: Request) {
  const stop = await guard("sales");
  if (stop) return stop;
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) return problem("Which announcement should be removed?");
  return attempt(() => deleteAnnouncement(id));
}
