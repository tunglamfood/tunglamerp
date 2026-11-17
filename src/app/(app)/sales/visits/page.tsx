// Sales → Visits: where the reps went, when, for how long, and what came of it.
import { requireArea } from "@/lib/auth";
import { listVisits, type Visit } from "@/lib/store-visits";
import { Notice } from "@/components/ui";
import { VisitsScreen } from "@/components/visits-screen";

export const dynamic = "force-dynamic";

const myDate = (offset = 0) => new Date(Date.now() + 8 * 3600_000 + offset * 86400_000).toISOString().slice(0, 10);

export default async function VisitsPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  await requireArea("sales");
  const sp = await searchParams;
  const ok = (v?: string) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
  const to = ok(sp.to) ?? myDate();
  const from = ok(sp.from) ?? myDate(-6);
  let visits: Visit[] | null = null;
  let problem: string | null = null;
  try {
    visits = await listVisits(from, to);
  } catch (e) {
    problem = (e as Error).message;
  }
  if (!visits) return <Notice tone="bad">Could not load the visits. {problem}</Notice>;
  return <VisitsScreen visits={visits} from={from} to={to} />;
}
