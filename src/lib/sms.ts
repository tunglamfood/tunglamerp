// Order updates to dealers by SMS (OneWay SMS, the same provider as the portal's
// sign-in codes). Every SMS costs money, so nothing is sent unless ORDER_SMS=on AND
// ONEWAYSMS_API_USERNAME / ONEWAYSMS_API_PASSWORD are set for this app.
import "server-only";
import { serverSupabase } from "./supabase-server";

export function orderSmsOn(): boolean {
  return process.env.ORDER_SMS?.trim().toLowerCase() === "on"
    && !!process.env.ONEWAYSMS_API_USERNAME?.trim() && !!process.env.ONEWAYSMS_API_PASSWORD?.trim();
}

/** OneWay SMS HTTP API: a positive number back means sent; negative is an error code. */
async function send(phone: string, message: string): Promise<boolean> {
  const url = new URL(process.env.ONEWAYSMS_MT_URL?.trim() || "https://gateway.onewaysms.com.my/api.aspx");
  url.searchParams.set("apiusername", process.env.ONEWAYSMS_API_USERNAME!.trim());
  url.searchParams.set("apipassword", process.env.ONEWAYSMS_API_PASSWORD!.trim());
  url.searchParams.set("mobileno", phone.replace(/\D/g, ""));
  url.searchParams.set("senderid", process.env.ONEWAYSMS_SENDER_ID?.trim() || "INFO");
  url.searchParams.set("languagetype", "1");
  url.searchParams.set("message", message);
  try {
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(10_000) });
    const n = Number((await res.text()).trim());
    return res.ok && Number.isFinite(n) && n > 0;
  } catch {
    return false;
  }
}

const day = (iso: string | null) =>
  iso ? new Date(`${iso}T00:00:00+08:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : null;

/** The text for one kind of change, kept to one SMS (plain ASCII, under 160 characters). */
export function orderSmsText(kind: string, orderNo: string, deliverOn: string | null): string | null {
  const link = "tunglamfood.my/portal";
  switch (kind) {
    case "confirmed":
      return `Tung Lam: order ${orderNo} is confirmed${day(deliverOn) ? `, delivery ${day(deliverOn)}` : ""}. ${link}`;
    case "delivered":
      return `Tung Lam: order ${orderNo} has been delivered. Thank you!`;
    case "cancelled":
      return `Tung Lam: order ${orderNo} was cancelled. Details: ${link}`;
    case "adjusted":
      return `Tung Lam: we changed order ${orderNo}. Please check: ${link}`;
    default:
      return null;
  }
}

/** Tells the dealer's portal phones (up to three) about a change the office made. */
export async function notifyDealer(orderId: number, kind: string): Promise<number> {
  if (!orderSmsOn()) return 0;
  const db = serverSupabase();
  const { data: o } = await db.from("sales_orders").select("order_no, customer_code, deliver_on, source").eq("id", orderId).maybeSingle();
  if (!o || !o.customer_code || o.source === "erp") return 0; // only orders dealers placed on the portal
  const text = orderSmsText(kind, o.order_no as string, (o.deliver_on as string) ?? null);
  if (!text) return 0;
  const { data: phones } = await db
    .from("portal_accounts").select("phone").eq("customer_code", o.customer_code).eq("role", "dealer").eq("active", true).limit(3);
  let sent = 0;
  for (const p of (phones ?? []) as { phone: string }[]) if (await send(p.phone, text)) sent++;
  return sent;
}
