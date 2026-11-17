// What dealers see on the portal: products, each made of one or more item codes.
import { deletePortalProduct, savePortalProduct, PortalProduct } from "@/lib/store-portal";
import { attempt, guard, num, problem, readBody, str, strOrNull } from "@/lib/route-helpers";

export const runtime = "nodejs";

const CATEGORIES: PortalProduct["category"][] = ["tofu", "steamboat", "dessert", "grocery"];

export async function POST(request: Request) {
  const stop = await guard("sales");
  if (stop) return stop;
  const b = await readBody(request);
  if (!b) return problem("Could not read what was sent.");

  const nameEn = str(b.nameEn);
  if (!nameEn) return problem("Every product needs an English name.");
  const category = str(b.category) as PortalProduct["category"];
  if (!CATEGORIES.includes(category)) return problem("Pick a category: tofu, steamboat, dessert or grocery.");

  const raw = Array.isArray(b.variants) ? (b.variants as Record<string, unknown>[]) : [];
  const variants = raw
    .map((v, i) => ({
      itemCode: str(v.itemCode).toUpperCase(),
      labelEn: str(v.labelEn),
      labelMs: strOrNull(v.labelMs),
      labelZh: strOrNull(v.labelZh),
      websiteSlug: strOrNull(v.websiteSlug),
      sort: (i + 1) * 10,
      active: v.active !== false,
    }))
    .filter((v) => v.itemCode);
  if (variants.length === 0) return problem("A product needs at least one item code to order.");
  if (variants.some((v) => !v.labelEn)) return problem("Every variant needs a label, like 120g or Carton · 180 pcs.");
  if (new Set(variants.map((v) => v.itemCode)).size !== variants.length) {
    return problem("The same item code is listed twice.");
  }

  return attempt(() =>
    savePortalProduct({
      id: b.id ? Number(b.id) : undefined,
      nameEn,
      nameMs: strOrNull(b.nameMs),
      nameZh: strOrNull(b.nameZh),
      category,
      brand: str(b.brand),
      websiteSlug: strOrNull(b.websiteSlug),
      restricted: b.restricted === true,
      sort: num(b.sort),
      active: b.active !== false,
      variants,
    }),
  );
}

export async function DELETE(request: Request) {
  const stop = await guard("sales");
  if (stop) return stop;
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!id) return problem("Which product should be removed?");
  return attempt(() => deletePortalProduct(id));
}
