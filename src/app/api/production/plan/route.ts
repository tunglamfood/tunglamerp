// The daily plan: save stock/extra, lock (re-computed here), unlock, mark done,
// and record what was really made with its lot and expiry.
import { currentUser } from "@/lib/supabase-server";
import { computePlan } from "@/lib/production-server";
import { listItems, lockPlan, recordOutput, saveOverrides, setPlanStatus } from "@/lib/store-production";
import { expiryOf, lotNo } from "@/lib/production";
import { attempt, guard, numOrNull, problem, readBody, str, strOrNull } from "@/lib/route-helpers";

export const runtime = "nodejs";
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(request: Request) {
  const stop = await guard("production");
  if (stop) return stop;
  const b = await readBody(request);
  if (!b) return problem("Could not read what was sent.");
  const delivery = str(b.delivery);
  if (!DATE.test(delivery)) return problem("Which delivery date?");
  const me = await currentUser();
  const by = me?.name ?? "Office";

  switch (str(b.action)) {
    case "overrides": {
      const raw = (b.overrides ?? {}) as Record<string, { stockQty?: unknown; extraQty?: unknown }>;
      const clean = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, {
        stockQty: Math.max(0, Number(v?.stockQty) || 0), extraQty: Math.max(0, Number(v?.extraQty) || 0),
      }]));
      return attempt(() => saveOverrides(delivery, clean));
    }
    case "lock":
      return attempt(async () => {
        const { plan } = await computePlan(delivery, b.includePending === undefined ? undefined : !!b.includePending);
        await lockPlan(delivery, plan.rows.map((r) => ({ itemCode: r.itemCode, ordered: r.ordered, stock: r.stock, extra: r.extra, plan: r.plan, batches: r.batches })), by);
      });
    case "unlock":
      return attempt(() => setPlanStatus(delivery, "draft"));
    case "done":
      return attempt(() => setPlanStatus(delivery, "done"));
    case "reopen":
      return attempt(() => setPlanStatus(delivery, "locked"));
    case "output": {
      const itemCode = str(b.itemCode);
      if (!itemCode) return problem("Which product?");
      const producedOn = strOrNull(b.producedOn);
      if (producedOn && !DATE.test(producedOn)) return problem("What day was it made?");
      return attempt(async () => {
        const s = (await listItems()).find((i) => i.itemCode === itemCode);
        const made = producedOn ?? delivery;
        await recordOutput(delivery, {
          itemCode,
          actualQty: numOrNull(b.actualQty),
          wasteQty: numOrNull(b.wasteQty),
          lotNo: strOrNull(b.lotNo) ?? lotNo(made, s?.lineCode ?? null, itemCode),
          producedOn: made,
          expiryDate: strOrNull(b.expiryDate) ?? expiryOf(made, s?.shelfLifeDays ?? null),
          note: strOrNull(b.note),
        });
      });
    }
    default:
      return problem("What should be done with the plan?");
  }
}
