// Sales rep visits, recorded on the dealer portal (check in, photos, note, check out).
import "server-only";
import { serverSupabase } from "./supabase-server";
import { fail } from "./db-error";

export interface Visit {
  id: number;
  repCode: string;
  repName: string;
  customerCode: string;
  customerName: string;
  checkedInAt: string;
  checkedOutAt: string | null;
  minutes: number | null;
  inLat: number | null;
  inLng: number | null;
  inAccuracy: number | null;
  outcome: string | null;
  note: string | null;
  photos: number;
}

/** Visits that started between two Malaysian dates (inclusive), newest first. */
export async function listVisits(from: string, to: string): Promise<Visit[]> {
  const start = new Date(`${from}T00:00:00+08:00`).toISOString();
  const end = new Date(new Date(`${to}T00:00:00+08:00`).getTime() + 86400_000).toISOString();
  const { data, error } = await serverSupabase()
    .from("sales_visits")
    .select("*, sales_customers(name, short_name), sales_reps(name)")
    .gte("checked_in_at", start)
    .lt("checked_in_at", end)
    .order("checked_in_at", { ascending: false })
    .limit(1000);
  fail("Could not load the visits", error);
  return ((data ?? []) as Record<string, unknown>[]).map((r) => {
    const c = r.sales_customers as { name?: string; short_name?: string } | null;
    const rep = r.sales_reps as { name?: string } | null;
    const inAt = r.checked_in_at as string;
    const outAt = (r.checked_out_at as string) ?? null;
    return {
      id: r.id as number,
      repCode: r.rep_code as string,
      repName: rep?.name ?? (r.rep_code as string),
      customerCode: r.customer_code as string,
      customerName: c?.short_name || c?.name || (r.customer_code as string),
      checkedInAt: inAt,
      checkedOutAt: outAt,
      minutes: outAt ? Math.max(0, Math.round((new Date(outAt).getTime() - new Date(inAt).getTime()) / 60000)) : null,
      inLat: (r.in_lat as number) ?? null,
      inLng: (r.in_lng as number) ?? null,
      inAccuracy: (r.in_accuracy_m as number) ?? null,
      outcome: (r.outcome as string) ?? null,
      note: (r.note as string) ?? null,
      photos: ((r.photo_paths as string[]) ?? []).length,
    };
  });
}

/** Ten-minute links to a visit's photos. The bucket itself is private. */
export async function visitPhotoUrls(id: number): Promise<string[]> {
  const db = serverSupabase();
  const { data, error } = await db.from("sales_visits").select("photo_paths").eq("id", id).maybeSingle();
  fail("Could not find that visit", error);
  const paths = ((data?.photo_paths as string[]) ?? []);
  if (paths.length === 0) return [];
  const signed = await db.storage.from("visit-photos").createSignedUrls(paths, 600);
  if (signed.error) throw new Error(`Could not open the photos: ${signed.error.message}`);
  return (signed.data ?? []).map((s) => s.signedUrl).filter(Boolean) as string[];
}
