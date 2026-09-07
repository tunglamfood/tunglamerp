// Everything about paying a month: the scanner file and the check list, and
// the allowances and advances that go out with it.
import { listPayItems } from "@/lib/store-hr";
import { listHolidays } from "@/lib/store-holidays";
import { listWorkers } from "@/lib/store";
import { isMonthKey, loadMonthView, monthExtras } from "@/lib/month-loader";
import { MonthHub } from "@/components/month-hub";
import { MonthView, hasAnything } from "@/lib/month-view";
import { PayItem, Worker } from "@/lib/types";
import { Notice } from "@/components/ui";

export const dynamic = "force-dynamic";

function thisMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/** The last two years of months, newest first. */
function recentMonths(from: string, count = 24): string[] {
  const [y, m] = from.split("-").map(Number);
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(y, m - 1 - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

export default async function MonthPage() {
  const month = thisMonthKey();
  let view: MonthView | null = null;
  let items: PayItem[] = [];
  let workers: Worker[] = [];
  let holidays: Record<string, string> = {};
  let problem: string | null = null;

  if (isMonthKey(month)) {
    try {
      const [built, extras, payItems, people, days] = await Promise.all([
        loadMonthView(month),
        monthExtras(month),
        listPayItems(),
        listWorkers(),
        listHolidays(month.slice(0, 4)),
      ]);
      holidays = Object.fromEntries(days.map((h) => [h.onDate, h.name]));
      const full = { ...built, extras: Object.fromEntries(extras) } as MonthView;
      view = hasAnything(full) ? full : null;
      items = payItems;
      workers = people;
    } catch (e) {
      problem = (e as Error).message;
    }
  }

  if (problem) {
    return (
      <Notice tone="bad">
        Could not reach the system&rsquo;s storage. {problem}
      </Notice>
    );
  }

  return (
    <MonthHub
      initialMonth={month}
      initialView={view}
      items={items}
      workers={workers}
      months={recentMonths(month)}
      holidays={holidays}
    />
  );
}
