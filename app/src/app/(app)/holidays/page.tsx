// The company's public holidays — its own screen, because they are not about
// any one worker and the office needs to find them once a year.
import { listHolidays } from "@/lib/store-holidays";
import type { Holiday } from "@/lib/store-holidays";
import { HolidaysScreen } from "@/components/holidays-screen";
import { Notice } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function Page() {
  let holidays: Holiday[] = [];
  let problem: string | null = null;
  try {
    holidays = await listHolidays();
  } catch (e) {
    problem = (e as Error).message;
  }

  if (problem) {
    return <Notice tone="bad">Could not reach the holiday list. {problem}</Notice>;
  }

  return <HolidaysScreen holidays={holidays} />;
}
