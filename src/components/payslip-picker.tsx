"use client";
// Which month, and whose payslip. Changing either reloads the page for it.
import { useRouter } from "next/navigation";
import { Select } from "@/components/ui";
import { monthLabel } from "@/lib/time";

export function PayslipPicker({
  month, months, code, workers,
}: {
  month: string;
  months: string[];
  code: string;
  workers: { code: string; name: string }[];
}) {
  const router = useRouter();
  const go = (m: string, c: string) =>
    router.push(`/reports/payslips?month=${m}${c ? `&code=${c}` : ""}`);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        className="w-48"
        value={month}
        options={months.map((m) => ({ value: m, label: monthLabel(m) }))}
        onChange={(m) => go(m, code)}
      />
      <Select
        className="w-72"
        searchable
        value={code}
        options={[
          { value: "", label: "Everyone" },
          ...workers.map((w) => ({ value: w.code, label: `${w.code} · ${w.name}` })),
        ]}
        onChange={(c) => go(month, c)}
      />
    </div>
  );
}
