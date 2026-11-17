// Payment slips dealers upload on tunglamfood.my/portal, checked here by the
// office. The amount is what the dealer typed; nothing here adds anything up.
import "server-only";
import { serverSupabase } from "./supabase-server";
import { fail } from "./db-error";

export type PaymentStatus = "submitted" | "checked" | "rejected";

export interface PortalPayment {
  id: number;
  customerCode: string;
  customerName: string;
  placedBy: string | null;
  orderNo: string | null;
  amount: number;
  currency: string;
  paidOn: string;
  reference: string | null;
  note: string | null;
  fileType: string;
  status: PaymentStatus;
  officeNote: string | null;
  checkedBy: string | null;
  checkedAt: string | null;
  createdAt: string;
}

export async function listPayments(): Promise<PortalPayment[]> {
  const db = serverSupabase();
  const { data, error } = await db
    .from("portal_payments")
    .select("*, sales_customers(name, short_name)")
    .order("created_at", { ascending: false })
    .limit(500);
  fail("Could not load the payment slips", error);
  return ((data ?? []) as Record<string, unknown>[]).map((r) => {
    const c = r.sales_customers as { name?: string; short_name?: string } | null;
    return {
      id: r.id as number,
      customerCode: r.customer_code as string,
      customerName: c?.short_name || c?.name || (r.customer_code as string),
      placedBy: (r.placed_by as string) ?? null,
      orderNo: (r.order_no as string) ?? null,
      amount: Number(r.amount),
      currency: (r.currency as string) ?? "MYR",
      paidOn: r.paid_on as string,
      reference: (r.reference as string) ?? null,
      note: (r.note as string) ?? null,
      fileType: r.file_type as string,
      status: r.status as PaymentStatus,
      officeNote: (r.office_note as string) ?? null,
      checkedBy: (r.checked_by as string) ?? null,
      checkedAt: (r.checked_at as string) ?? null,
      createdAt: r.created_at as string,
    };
  });
}

/** Slips nobody has checked yet — the red number in the sidebar. */
export async function countNewPayments(): Promise<number> {
  const { count, error } = await serverSupabase()
    .from("portal_payments").select("id", { count: "exact", head: true }).eq("status", "submitted");
  fail("Could not count the payment slips", error);
  return count ?? 0;
}

export async function setPaymentStatus(id: number, status: PaymentStatus, officeNote: string | null, by: string): Promise<void> {
  const { error } = await serverSupabase().from("portal_payments").update({
    status,
    office_note: officeNote,
    checked_by: status === "submitted" ? null : by,
    checked_at: status === "submitted" ? null : new Date().toISOString(),
  }).eq("id", id);
  fail("Could not save that payment slip", error);
}

/** A link to the slip that works for ten minutes. The bucket itself is private. */
export async function slipUrl(id: number): Promise<{ url: string; type: string }> {
  const db = serverSupabase();
  const { data, error } = await db.from("portal_payments").select("file_path, file_type").eq("id", id).maybeSingle();
  fail("Could not find that slip", error);
  if (!data) throw new Error("That slip no longer exists.");
  const signed = await db.storage.from("payment-slips").createSignedUrl(data.file_path as string, 600);
  if (signed.error || !signed.data) throw new Error(`Could not open the slip: ${signed.error?.message ?? "no link"}`);
  return { url: signed.data.signedUrl, type: data.file_type as string };
}
