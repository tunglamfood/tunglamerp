// The only place the database is reached from.
import "server-only";
import { serverSupabase } from "./supabase-server";
import { DayInput, PayExtras, Worker } from "./types";
import {
  CorrectionDbRow,
  ScanDbRow,
  WorkerRow,
  rowToWorker,
  rowsToDayInputs,
  workerToRow,
} from "./store-mapping";

/** Every failure here reaches the office as a sentence, not a stack trace. */
function fail(what: string, error: { message: string } | null): void {
  if (error) throw new Error(`${what}: ${error.message}`);
}

export async function listWorkers(): Promise<Worker[]> {
  const { data, error } = await serverSupabase().from("workers").select("*").order("code");
  fail("Could not load the worker list", error);
  return ((data ?? []) as WorkerRow[]).map(rowToWorker);
}

export async function upsertWorker(w: Worker): Promise<void> {
  const { error } = await serverSupabase()
    .from("workers")
    .upsert({ ...workerToRow(w), updated_at: new Date().toISOString() }, { onConflict: "code" });
  fail(`Could not save ${w.name}`, error);
}

export async function deleteWorker(code: string): Promise<void> {
  const { error } = await serverSupabase().from("workers").delete().eq("code", code);
  fail(`Could not remove worker ${code}`, error);
}

/**
 * Replaces the month's scans for the workers in this upload.
 *
 * Deleting first means a re-upload of a corrected export overwrites rather than
 * doubling up — the office will re-upload, and doubled punches would be
 * invisible in the totals.
 */
export async function saveMonthScans(monthKey: string, rows: ScanDbRow[]): Promise<void> {
  const db = serverSupabase();
  const codes = [...new Set(rows.map((r) => r.code))];
  if (codes.length > 0) {
    const { error } = await db
      .from("month_scans")
      .delete()
      .eq("month_key", monthKey)
      .in("code", codes);
    fail("Could not clear the previous upload", error);
  }
  if (rows.length === 0) return;
  const { error } = await db
    .from("month_scans")
    .insert(rows.map((r) => ({ month_key: monthKey, ...r })));
  fail("Could not save the scan data", error);
}

export async function saveCorrection(
  monthKey: string,
  code: string,
  date: string,
  patch: Pick<DayInput, "firstOverride" | "lastOverride" | "markedAbsent">,
): Promise<void> {
  const { error } = await serverSupabase()
    .from("month_corrections")
    .upsert(
      {
        month_key: monthKey,
        code,
        work_date: date,
        first_override: patch.firstOverride ?? null,
        last_override: patch.lastOverride ?? null,
        marked_absent: patch.markedAbsent ?? false,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "month_key,code,work_date" },
    );
  fail("Could not save that correction", error);
}

/** Scans and corrections for a month, already merged per worker. */
export async function loadMonth(monthKey: string): Promise<Map<string, DayInput[]>> {
  const db = serverSupabase();
  const [scans, corrections] = await Promise.all([
    db.from("month_scans").select("code, work_date, punches").eq("month_key", monthKey),
    db
      .from("month_corrections")
      .select("code, work_date, first_override, last_override, marked_absent")
      .eq("month_key", monthKey),
  ]);
  fail("Could not load this month's scans", scans.error);
  fail("Could not load this month's corrections", corrections.error);
  return rowsToDayInputs(
    (scans.data ?? []) as ScanDbRow[],
    (corrections.data ?? []) as CorrectionDbRow[],
  );
}

export async function saveExtras(monthKey: string, extras: PayExtras[]): Promise<void> {
  if (extras.length === 0) return;
  const { error } = await serverSupabase()
    .from("month_extras")
    .upsert(
      extras.map((e) => ({
        month_key: monthKey,
        code: e.code,
        allowance: e.allowance,
        advance: e.advance,
      })),
      { onConflict: "month_key,code" },
    );
  fail("Could not save the allowance and advance figures", error);
}

export async function loadExtras(monthKey: string): Promise<Map<string, PayExtras>> {
  const { data, error } = await serverSupabase()
    .from("month_extras")
    .select("code, allowance, advance")
    .eq("month_key", monthKey);
  fail("Could not load the allowance and advance figures", error);
  return new Map(
    (data ?? []).map((r) => [
      r.code as string,
      { code: r.code as string, allowance: Number(r.allowance), advance: Number(r.advance) },
    ]),
  );
}
