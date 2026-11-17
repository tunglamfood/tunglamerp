// Promotions for the dealer portal.
import { deletePromotion, savePromotion } from "@/lib/store-promotions";
import { attempt, guard, num, problem, readBody, str, strOrNull } from "@/lib/route-helpers";

export const runtime = "nodejs";
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(request: Request) {
  const stop = await guard("sales");
  if (stop) return stop;
  const b = await readBody(request);
  if (!b) return problem("Could not read what was sent.");

  const titleEn = str(b.titleEn);
  const itemCode = str(b.itemCode).toUpperCase();
  const kind = str(b.kind) === "percent" ? "percent" : "price";
  const value = num(b.value);
  const minQty = Math.floor(num(b.minQty, 1));
  const startsOn = str(b.startsOn);
  const endsOn = strOrNull(b.endsOn);
  if (!titleEn) return problem("Give the promotion a name dealers will see, like “Raya special”.");
  if (titleEn.length > 80) return problem("Keep the name under 80 characters.");
  if (!itemCode) return problem("Which item is on promotion?");
  if (!(value > 0)) return problem(kind === "percent" ? "How many % off?" : "What is the promotion price?");
  if (kind === "percent" && value >= 100) return problem("A discount must be under 100%.");
  if (!(minQty >= 1)) return problem("The minimum quantity is at least 1.");
  if (!DATE.test(startsOn)) return problem("When does it start?");
  if (endsOn && (!DATE.test(endsOn) || endsOn < startsOn)) return problem("It ends before it starts.");

  return attempt(() =>
    savePromotion({
      id: b.id ? Number(b.id) : undefined,
      titleEn,
      titleMs: strOrNull(b.titleMs),
      titleZh: strOrNull(b.titleZh),
      itemCode,
      kind,
      value: Math.round(value * 100) / 100,
      minQty,
      customerCode: strOrNull(b.customerCode),
      groupCode: strOrNull(b.groupCode),
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
  if (!id) return problem("Which promotion?");
  return attempt(() => deletePromotion(id));
}
