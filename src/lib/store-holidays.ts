// The company's public holidays, kept where the office can change them.
import "server-only";
import { serverSupabase } from "./supabase-server";

export interface Holiday {
  onDate: string;
  name: string;
  compulsory: boolean;
  note: string | null;
}

function fail(what: string, error: { message: string } | null): void {
  if (error) throw new Error(`${what}: ${error.message}`);
}

export async function listHolidays(year?: string): Promise<Holiday[]> {
  let q = serverSupabase().from("hr_holidays").select("*");
  if (year) q = q.gte("on_date", `${year}-01-01`).lte("on_date", `${year}-12-31`);
  const { data, error } = await q.order("on_date");
  fail("Could not load the holiday list", error);
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    onDate: r.on_date as string,
    name: r.name as string,
    compulsory: r.compulsory as boolean,
    note: (r.note as string) ?? null,
  }));
}

export async function saveHoliday(h: Holiday): Promise<void> {
  const { error } = await serverSupabase().from("hr_holidays").upsert(
    { on_date: h.onDate, name: h.name, compulsory: h.compulsory, note: h.note },
    { onConflict: "on_date" },
  );
  fail("Could not save that holiday", error);
}

export async function deleteHoliday(onDate: string): Promise<void> {
  const { error } = await serverSupabase().from("hr_holidays").delete().eq("on_date", onDate);
  fail("Could not remove that holiday", error);
}
