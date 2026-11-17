// Production → Setup: how each item is supplied, lines, batches, recipes, cut-off.
import { requireArea } from "@/lib/auth";
import { getSettings, listItems, listLines, listRecipes } from "@/lib/store-production";
import { listProducts } from "@/lib/store-sales";
import { defaultMode } from "@/lib/production";
import { Notice } from "@/components/ui";
import { ProductionSetup, type SetupRow } from "@/components/production-setup";

export const dynamic = "force-dynamic";

async function load() {
  try {
    const [items, lines, recipes, products, settings] = await Promise.all([listItems(), listLines(), listRecipes(), listProducts(), getSettings()]);
    return { data: { items, lines, recipes, products, settings }, problem: null };
  } catch (e) {
    return { data: null, problem: (e as Error).message };
  }
}

export default async function ProductionSetupPage() {
  await requireArea("production");
  const { data, problem } = await load();
  if (!data) return <Notice tone="bad">Could not load the production setup. {problem}</Notice>;
  const setup = new Map(data.items.map((i) => [i.itemCode, i]));
  const rows: SetupRow[] = data.products
    .filter((p) => p.active && (setup.has(p.itemCode) || defaultMode(p) !== "none"))
    .map((p) => {
      const s = setup.get(p.itemCode);
      return {
        itemCode: p.itemCode, description: p.description, group: [p.itemGroup, p.itemType].filter(Boolean).join(" · "), uom: p.uom,
        configured: !!s,
        mode: s?.mode ?? defaultMode(p), makesItem: s?.makesItem ?? null, unitsPer: s?.unitsPer ?? 1, lineCode: s?.lineCode ?? null,
        batchSize: s?.batchSize ?? null, minRun: s?.minRun ?? null, bufferPct: s?.bufferPct ?? 0, shelfLifeDays: s?.shelfLifeDays ?? null,
        recipeYield: s?.recipeYield ?? null, sort: s?.sort ?? 0,
        recipe: data.recipes.filter((r) => r.itemCode === p.itemCode),
      };
    })
    .sort((a, b) => a.description.localeCompare(b.description));
  return (
    <ProductionSetup
      rows={rows}
      lines={data.lines}
      settings={data.settings}
      ingredients={data.products.filter((p) => p.active).map((p) => ({ value: p.itemCode, label: p.description, note: p.itemCode, uom: p.uom }))}
    />
  );
}
