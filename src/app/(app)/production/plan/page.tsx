// Production → Daily plan: every order for one delivery date turned into what each
// line makes tonight, in full batches, with the prep and raw materials.
import { requireArea } from "@/lib/auth";
import { computePlan } from "@/lib/production-server";
import { dayNotes } from "@/lib/production";
import { listHolidays } from "@/lib/store-holidays";
import { Notice } from "@/components/ui";
import { ProductionPlanScreen } from "@/components/production-plan";

export const dynamic = "force-dynamic";

const myDate = (offset = 0) => new Date(Date.now() + 8 * 3600_000 + offset * 86400_000).toISOString().slice(0, 10);

async function load(delivery: string, pending?: boolean) {
  try {
    const [data, holidays] = await Promise.all([
      computePlan(delivery, pending),
      listHolidays(delivery.slice(0, 4)).catch(() => []),
    ]);
    return { data, notes: dayNotes(delivery, holidays), problem: null };
  } catch (e) {
    return { data: null, notes: [], problem: (e as Error).message };
  }
}

export default async function ProductionPlanPage({ searchParams }: { searchParams: Promise<{ date?: string; pending?: string }> }) {
  await requireArea("production");
  const sp = await searchParams;
  const delivery = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : myDate(1);
  const pending = sp.pending === "1" ? true : sp.pending === "0" ? false : undefined;
  const { data, notes, problem } = await load(delivery, pending);
  if (!data) return <Notice tone="bad">Could not work out the plan. {problem}</Notice>;
  const lineNames = Object.fromEntries(data.lines.map((l) => [l.code, l.name]));
  const shelfLife = Object.fromEntries(data.items.map((i) => [i.itemCode, i.shelfLifeDays]));
  return (
    <ProductionPlanScreen
      delivery={delivery}
      today={myDate()}
      plan={data.plan}
      saved={data.saved}
      lineOrder={data.lines.map((l) => l.code)}
      lineNames={lineNames}
      shelfLife={shelfLife}
      includePending={data.includePending}
      cutoffHour={data.settings.cutoffHour}
      notes={notes}
    />
  );
}
