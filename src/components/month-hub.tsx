"use client";
import { Tabs } from "@/components/tabs";
import { MonthWorkflow } from "@/components/month-workflow";
import { PayItemsScreen } from "@/components/pay-items-screen";
import { KeyInScreen } from "@/components/keyin-screen";
import { MonthView } from "@/lib/month-view";
import { PayItem, Worker } from "@/lib/types";

export function MonthHub({
  initialMonth, initialView, items, workers, months, holidays,
}: {
  initialMonth: string;
  initialView: MonthView | null;
  items: PayItem[];
  workers: Worker[];
  months: string[];
  holidays: Record<string, string>;
}) {
  const outstanding = initialView?.flags.length ?? 0;
  const thisMonth = items.filter((i) => i.monthKey === initialMonth).length;

  return (
    <Tabs
      tabs={[
        {
          id: "pay",
          label: "Monthly pay",
          note: outstanding > 0 ? String(outstanding) : undefined,
          tone: outstanding > 0 ? "warn" : "plain",
          panel: <MonthWorkflow initialMonth={initialMonth} initialView={initialView} />,
        },
        {
          id: "keyin",
          label: "Key in by hand",
          panel: (
            <KeyInScreen
              month={initialMonth} months={months} workers={workers} holidays={holidays}
            />
          ),
        },
        {
          id: "money",
          label: "Allowances & advances",
          note: thisMonth > 0 ? String(thisMonth) : undefined,
          panel: (
            <PayItemsScreen
              items={items} workers={workers} months={months} month={initialMonth}
            />
          ),
        },
      ]}
    />
  );
}
