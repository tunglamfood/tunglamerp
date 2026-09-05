// The month is loaded on the server for the first paint, so the page arrives
// already knowing whether anything has been uploaded. Picking a different month
// then loads that one from the picker's own change handler.
import { loadExtras } from "@/lib/store";
import { isMonthKey, loadMonthView } from "@/lib/month-loader";
import { MonthWorkflow } from "@/components/month-workflow";
import { MonthView, hasAnything } from "@/lib/month-view";
import { Notice } from "@/components/ui";

export const dynamic = "force-dynamic";

function thisMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export default async function MonthPage() {
  const month = thisMonthKey();
  let view: MonthView | null = null;
  let problem: string | null = null;

  if (isMonthKey(month)) {
    try {
      const [built, extras] = await Promise.all([loadMonthView(month), loadExtras(month)]);
      const full = { ...built, extras: Object.fromEntries(extras) } as MonthView;
      view = hasAnything(full) ? full : null;
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

  return <MonthWorkflow initialMonth={month} initialView={view} />;
}
