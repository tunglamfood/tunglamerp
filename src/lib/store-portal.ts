// What the office controls about the dealer portal (tunglamfood.my/portal):
// who may sign in, what the catalogue shows, and which dealers each rep
// looks after. Prices are not here — the portal reads the same sales_prices
// the order screen does, through the database's sales_price_for().
import "server-only";
import { serverSupabase } from "./supabase-server";
import { fail } from "./db-error";

/* ── Types ─────────────────────────────────────────────────────────────────── */

export interface PortalAccount {
  id?: number;
  phone: string;
  name: string;
  role: "dealer" | "rep";
  /** A dealer account is for one customer, or for a whole group of outlets. */
  customerCode: string | null;
  groupCode: string | null;
  repCode: string | null;
  active: boolean;
  lastLoginAt?: string | null;
}

/** A notice on the portal's home page, in the dealer's language where one is written. */
export interface PortalAnnouncement {
  id?: number;
  titleEn: string;
  titleMs: string | null;
  titleZh: string | null;
  bodyEn: string;
  bodyMs: string | null;
  bodyZh: string | null;
  /** Shown from and until these days, inclusive. Empty means no limit. */
  startsOn: string | null;
  endsOn: string | null;
  active: boolean;
}

export interface SalesRep {
  code: string;
  name: string;
  phone: string | null;
  active: boolean;
  customerCodes: string[];
}

export interface PortalVariant {
  itemCode: string;
  labelEn: string;
  labelMs: string | null;
  labelZh: string | null;
  websiteSlug: string | null;
  sort: number;
  active: boolean;
}

export interface PortalProduct {
  id?: number;
  nameEn: string;
  nameMs: string | null;
  nameZh: string | null;
  category: "tofu" | "steamboat" | "dessert" | "grocery";
  brand: string;
  websiteSlug: string | null;
  restricted: boolean;
  sort: number;
  active: boolean;
  variants: PortalVariant[];
}

/* ── Logins ────────────────────────────────────────────────────────────────── */

type AccountRow = {
  id: number; phone: string; name: string; role: "dealer" | "rep";
  customer_code: string | null; group_code: string | null; rep_code: string | null;
  active: boolean; last_login_at: string | null;
};

export async function listPortalAccounts(): Promise<PortalAccount[]> {
  const { data, error } = await serverSupabase()
    .from("portal_accounts").select("*").order("created_at", { ascending: false });
  fail("Could not load the portal logins", error);
  return ((data ?? []) as AccountRow[]).map((r) => ({
    id: r.id, phone: r.phone, name: r.name, role: r.role,
    customerCode: r.customer_code, groupCode: r.group_code, repCode: r.rep_code,
    active: r.active, lastLoginAt: r.last_login_at,
  }));
}

export async function savePortalAccount(a: PortalAccount): Promise<void> {
  const row = {
    phone: a.phone, name: a.name, role: a.role,
    customer_code: a.role === "dealer" ? a.customerCode : null,
    group_code: a.role === "dealer" && !a.customerCode ? a.groupCode : null,
    rep_code: a.role === "rep" ? a.repCode : null,
    active: a.active, updated_at: new Date().toISOString(),
  };
  const db = serverSupabase();
  const { error } = a.id
    ? await db.from("portal_accounts").update(row).eq("id", a.id)
    : await db.from("portal_accounts").insert(row);
  if (error?.code === "23505") throw new Error("That phone number already has a login.");
  fail("Could not save that login", error);
}

export async function deletePortalAccount(id: number): Promise<void> {
  const { error } = await serverSupabase().from("portal_accounts").delete().eq("id", id);
  fail("Could not remove that login", error);
}

/* ── Reps ──────────────────────────────────────────────────────────────────── */

export async function listReps(): Promise<SalesRep[]> {
  const db = serverSupabase();
  const [{ data, error }, { data: links, error: linkError }] = await Promise.all([
    db.from("sales_reps").select("*").order("name"),
    db.from("sales_rep_customers").select("*"),
  ]);
  fail("Could not load the sales reps", error);
  fail("Could not load which dealers each rep looks after", linkError);
  const byRep = new Map<string, string[]>();
  for (const l of (links ?? []) as { rep_code: string; customer_code: string }[]) {
    if (!byRep.has(l.rep_code)) byRep.set(l.rep_code, []);
    byRep.get(l.rep_code)!.push(l.customer_code);
  }
  return ((data ?? []) as { code: string; name: string; phone: string | null; active: boolean }[]).map((r) => ({
    code: r.code, name: r.name, phone: r.phone, active: r.active,
    customerCodes: (byRep.get(r.code) ?? []).sort(),
  }));
}

export async function saveRep(r: SalesRep): Promise<void> {
  const db = serverSupabase();
  const { error } = await db.from("sales_reps").upsert({
    code: r.code, name: r.name, phone: r.phone, active: r.active, updated_at: new Date().toISOString(),
  });
  fail(`Could not save ${r.name}`, error);
  const { error: wipe } = await db.from("sales_rep_customers").delete().eq("rep_code", r.code);
  fail("Could not update the rep's dealers", wipe);
  if (r.customerCodes.length > 0) {
    const { error: ins } = await db.from("sales_rep_customers").insert(
      [...new Set(r.customerCodes)].map((c) => ({ rep_code: r.code, customer_code: c })),
    );
    fail("Could not update the rep's dealers", ins);
  }
}

export async function deleteRep(code: string): Promise<void> {
  const { error } = await serverSupabase().from("sales_reps").delete().eq("code", code);
  fail("Could not remove that rep", error);
}

/* ── Catalogue ─────────────────────────────────────────────────────────────── */

type ProductRow = {
  id: number; name_en: string; name_ms: string | null; name_zh: string | null;
  category: PortalProduct["category"]; brand: string; website_slug: string | null;
  restricted: boolean; sort: number; active: boolean;
};
type VariantRow = {
  item_code: string; product_id: number; label_en: string; label_ms: string | null;
  label_zh: string | null; website_slug: string | null; sort: number; active: boolean;
};

export async function listPortalProducts(): Promise<PortalProduct[]> {
  const db = serverSupabase();
  const [{ data, error }, { data: vs, error: vError }] = await Promise.all([
    db.from("portal_products").select("*").order("sort"),
    db.from("portal_product_variants").select("*").order("sort"),
  ]);
  fail("Could not load the portal catalogue", error);
  fail("Could not load the portal variants", vError);
  const byProduct = new Map<number, PortalVariant[]>();
  for (const v of (vs ?? []) as VariantRow[]) {
    if (!byProduct.has(v.product_id)) byProduct.set(v.product_id, []);
    byProduct.get(v.product_id)!.push({
      itemCode: v.item_code, labelEn: v.label_en, labelMs: v.label_ms, labelZh: v.label_zh,
      websiteSlug: v.website_slug, sort: v.sort, active: v.active,
    });
  }
  return ((data ?? []) as ProductRow[]).map((p) => ({
    id: p.id, nameEn: p.name_en, nameMs: p.name_ms, nameZh: p.name_zh, category: p.category,
    brand: p.brand, websiteSlug: p.website_slug, restricted: p.restricted, sort: p.sort,
    active: p.active, variants: byProduct.get(p.id) ?? [],
  }));
}

export async function savePortalProduct(p: PortalProduct): Promise<void> {
  const db = serverSupabase();
  const head = {
    name_en: p.nameEn, name_ms: p.nameMs, name_zh: p.nameZh, category: p.category,
    brand: p.brand, website_slug: p.websiteSlug, restricted: p.restricted, sort: p.sort,
    active: p.active, updated_at: new Date().toISOString(),
  };
  let id = p.id;
  if (id) {
    const { error } = await db.from("portal_products").update(head).eq("id", id);
    fail(`Could not save ${p.nameEn}`, error);
  } else {
    const { data, error } = await db.from("portal_products").insert(head).select("id").single();
    fail(`Could not save ${p.nameEn}`, error);
    id = (data as { id: number }).id;
  }

  // An item code belongs to exactly one product; moving it here takes it from
  // wherever it was before.
  const codes = p.variants.map((v) => v.itemCode);
  const { error: wipe } = await db.from("portal_product_variants").delete().eq("product_id", id);
  fail("Could not update the variants", wipe);
  if (codes.length > 0) {
    const { error: move } = await db.from("portal_product_variants").delete().in("item_code", codes);
    fail("Could not update the variants", move);
    const { error: ins } = await db.from("portal_product_variants").insert(
      p.variants.map((v, i) => ({
        item_code: v.itemCode, product_id: id, label_en: v.labelEn, label_ms: v.labelMs,
        label_zh: v.labelZh, website_slug: v.websiteSlug, sort: (i + 1) * 10, active: v.active,
      })),
    );
    fail("Could not save the variants", ins);
  }
}

export async function deletePortalProduct(id: number): Promise<void> {
  const { error } = await serverSupabase().from("portal_products").delete().eq("id", id);
  fail("Could not remove that product", error);
}

/* ── Announcements ─────────────────────────────────────────────────────────── */

type AnnouncementRow = {
  id: number; title_en: string; title_ms: string | null; title_zh: string | null;
  body_en: string; body_ms: string | null; body_zh: string | null;
  starts_on: string | null; ends_on: string | null; active: boolean;
};

export async function listAnnouncements(): Promise<PortalAnnouncement[]> {
  const { data, error } = await serverSupabase()
    .from("portal_announcements").select("*").order("created_at", { ascending: false });
  fail("Could not load the announcements", error);
  return ((data ?? []) as AnnouncementRow[]).map((r) => ({
    id: r.id, titleEn: r.title_en, titleMs: r.title_ms, titleZh: r.title_zh,
    bodyEn: r.body_en, bodyMs: r.body_ms, bodyZh: r.body_zh,
    startsOn: r.starts_on, endsOn: r.ends_on, active: r.active,
  }));
}

export async function saveAnnouncement(a: PortalAnnouncement): Promise<void> {
  const row = {
    title_en: a.titleEn, title_ms: a.titleMs, title_zh: a.titleZh,
    body_en: a.bodyEn, body_ms: a.bodyMs, body_zh: a.bodyZh,
    starts_on: a.startsOn, ends_on: a.endsOn, active: a.active,
    updated_at: new Date().toISOString(),
  };
  const db = serverSupabase().from("portal_announcements");
  const { error } = a.id ? await db.update(row).eq("id", a.id) : await db.insert(row);
  fail("Could not save the announcement", error);
}

export async function deleteAnnouncement(id: number): Promise<void> {
  const { error } = await serverSupabase().from("portal_announcements").delete().eq("id", id);
  fail("Could not remove that announcement", error);
}
