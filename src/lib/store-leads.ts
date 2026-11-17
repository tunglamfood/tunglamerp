// Enquiries from tunglamfood.my. The website saves each one in its own
// database and copies it here, where the sales office follows it up — and can
// turn a would-be dealer into a customer with a portal login in one go.
import "server-only";
import { serverSupabase } from "./supabase-server";
import { fail } from "./db-error";
import { upsertCustomer } from "./store-sales";
import { savePortalAccount } from "./store-portal";

export type LeadStatus = "new" | "contacted" | "won" | "lost" | "spam";
export const LEAD_STATUSES: LeadStatus[] = ["new", "contacted", "won", "lost", "spam"];

export interface Lead {
  id: number;
  source: string;
  kind: "general" | "wholesale" | "product";
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  message: string | null;
  productSlug: string | null;
  locale: string | null;
  pageUrl: string | null;
  status: LeadStatus;
  note: string | null;
  customerCode: string | null;
  handledBy: string | null;
  createdAt: string;
  updatedAt: string;
}

type Row = {
  id: number; source: string; kind: Lead["kind"]; name: string; company: string | null;
  email: string | null; phone: string | null; message: string | null; product_slug: string | null;
  locale: string | null; page_url: string | null; status: LeadStatus; note: string | null;
  customer_code: string | null; handled_by: string | null; created_at: string; updated_at: string;
};

const toLead = (r: Row): Lead => ({
  id: r.id, source: r.source, kind: r.kind, name: r.name, company: r.company, email: r.email,
  phone: r.phone, message: r.message, productSlug: r.product_slug, locale: r.locale,
  pageUrl: r.page_url, status: r.status, note: r.note, customerCode: r.customer_code,
  handledBy: r.handled_by, createdAt: r.created_at, updatedAt: r.updated_at,
});

export async function listLeads(): Promise<Lead[]> {
  const { data, error } = await serverSupabase()
    .from("sales_leads").select("*").order("created_at", { ascending: false }).limit(1000);
  fail("Could not load the enquiries", error);
  return ((data ?? []) as Row[]).map(toLead);
}

/** Enquiries nobody has picked up yet — the red number in the sidebar. */
export async function countNewLeads(): Promise<number> {
  const { count, error } = await serverSupabase()
    .from("sales_leads").select("id", { count: "exact", head: true }).eq("status", "new");
  fail("Could not count the new enquiries", error);
  return count ?? 0;
}

export async function updateLead(
  id: number,
  patch: { status: LeadStatus; note: string | null; customerCode?: string | null },
  by: string,
): Promise<void> {
  const { error } = await serverSupabase().from("sales_leads").update({
    status: patch.status,
    note: patch.note,
    ...(patch.customerCode !== undefined ? { customer_code: patch.customerCode } : {}),
    handled_by: by,
    updated_at: new Date().toISOString(),
  }).eq("id", id);
  fail("Could not save that enquiry", error);
}

/**
 * Makes the enquirer a dealer: a new customer (or an existing one), optionally
 * a portal login for their phone, and the enquiry marked as won.
 */
export async function convertLead(
  id: number,
  c: {
    existingCode: string | null;
    code: string;
    name: string;
    shortName: string;
    state: string;
    phone: string | null;
    email: string | null;
    portalPhone: string | null;
    portalName: string;
  },
  by: string,
): Promise<{ customerCode: string; portal: boolean }> {
  const db = serverSupabase();
  let code = c.existingCode;
  if (!code) {
    const { data: taken, error } = await db.from("sales_customers").select("code").eq("code", c.code).maybeSingle();
    fail("Could not check the customer code", error);
    if (taken) throw new Error(`${c.code} is already a customer. Choose "An existing customer" instead.`);
    await upsertCustomer({
      code: c.code, name: c.name, shortName: c.shortName, state: c.state, address: null,
      contact: c.phone, email: c.email, attn: null, incomeTaxNo: null, active: true,
    });
    code = c.code;
  }
  if (c.portalPhone) {
    await savePortalAccount({
      phone: c.portalPhone, name: c.portalName, role: "dealer",
      customerCode: code, groupCode: null, repCode: null, active: true,
    });
  }
  // Keep any note already written: only the status, the link and who did it change.
  const { error } = await db.from("sales_leads").update({
    status: "won", customer_code: code, handled_by: by, updated_at: new Date().toISOString(),
  }).eq("id", id);
  fail("The customer was saved, but the enquiry could not be marked as won", error);
  return { customerCode: code, portal: !!c.portalPhone };
}
