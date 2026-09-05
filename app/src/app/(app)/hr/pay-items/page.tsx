import { Notice } from "@/components/ui";
import { listPayItems } from "@/lib/store-hr";
import { listWorkers } from "@/lib/store";
import { PayItemsScreen } from "@/components/pay-items-screen";
import { PayItem, Worker } from "@/lib/types";

export const dynamic = "force-dynamic";

/** The last two years of months, newest first. */
function recentMonths(count = 24): string[] {
  const now = new Date();
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

export default async function Page() {
  let items: PayItem[] = [];
  let workers: Worker[] = [];
  let problem: string | null = null;
  try {
    [items, workers] = await Promise.all([listPayItems(), listWorkers()]);
  } catch (e) {
    problem = (e as Error).message;
  }

  if (problem) {
    return (
      <Notice tone="bad">
        Could not reach the system&rsquo;s storage. {problem}
      </Notice>
    );
  }

  const months = recentMonths();
  return (
    <PayItemsScreen items={items} workers={workers} months={months} month={months[0]} />
  );
}
