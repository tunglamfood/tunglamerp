// Production setup: how each item is supplied (with its recipe), lines, settings.
import { deleteLine, saveItem, saveLine, saveSettings } from "@/lib/store-production";
import type { Mode, RecipeLine } from "@/lib/production";
import { attempt, guard, num, numOrNull, problem, readBody, str, strOrNull } from "@/lib/route-helpers";

export const runtime = "nodejs";
const pos = (v: unknown) => { const n = numOrNull(v); return n != null && n > 0 ? n : null; };

export async function POST(request: Request) {
  const stop = await guard("production");
  if (stop) return stop;
  const b = await readBody(request);
  if (!b) return problem("Could not read what was sent.");

  switch (str(b.kind)) {
    case "item": {
      const itemCode = str(b.itemCode).toUpperCase();
      if (!itemCode) return problem("Which item?");
      const mode = (["make", "buy", "none"].includes(str(b.mode)) ? str(b.mode) : "make") as Mode;
      const makesItem = strOrNull(b.makesItem)?.toUpperCase() ?? null;
      // Not sent (a product made as it is) means one.
      const unitsPer = b.unitsPer == null || b.unitsPer === "" ? 1 : num(b.unitsPer, 1);
      if (!(unitsPer > 0)) return problem("How many does one of this make?");
      const bufferPct = num(b.bufferPct, 0);
      if (bufferPct < 0 || bufferPct > 200) return problem("Keep the buffer between 0 and 200%.");
      const recipe = Array.isArray(b.recipe)
        ? (b.recipe as Record<string, unknown>[])
            .map((r, i): RecipeLine => ({ itemCode, ingredient: str(r.ingredient).toUpperCase(), qty: num(r.qty), uom: str(r.uom).slice(0, 12), prepBefore: r.prepBefore === true, note: strOrNull(r.note), sort: i }))
            .filter((r) => r.ingredient && r.qty > 0)
        : null;
      return attempt(() => saveItem({
        itemCode, mode, makesItem: mode === "make" ? makesItem : null, unitsPer: mode === "make" && makesItem ? unitsPer : 1,
        lineCode: strOrNull(b.lineCode), batchSize: pos(b.batchSize), minRun: pos(b.minRun), bufferPct,
        shelfLifeDays: pos(b.shelfLifeDays) ? Math.round(pos(b.shelfLifeDays)!) : null, recipeYield: pos(b.recipeYield),
        sort: Math.round(num(b.sort, 0)),
      }, mode === "make" && !makesItem ? recipe : null));
    }
    case "line": {
      const code = str(b.code).toUpperCase().replace(/[^A-Z0-9_-]/g, "");
      if (!code) return problem("Give the line a short code, like EGG.");
      if (!str(b.name)) return problem("Give the line a name.");
      return attempt(() => saveLine({ code, name: str(b.name), sort: Math.round(num(b.sort, 0)), active: b.active !== false }));
    }
    case "deleteLine":
      return attempt(() => deleteLine(str(b.code)));
    case "settings": {
      const hour = numOrNull(b.cutoffHour);
      if (hour != null && (hour < 0 || hour > 23)) return problem("The cut-off is an hour from 0 to 23.");
      return attempt(() => saveSettings({ cutoffHour: hour == null ? null : Math.round(hour), includePending: b.includePending !== false }));
    }
    default:
      return problem("What should be saved?");
  }
}
