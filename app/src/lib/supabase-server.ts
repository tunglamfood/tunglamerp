// The only place the database is reached from. The key lives here and here
// only; importing this from a client component is a build error, which is the
// point of "server-only".
import "server-only";
import { cookies } from "next/headers";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { SESSION_COOKIE, verifySession } from "./session";

export function serverSupabase(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL or SUPABASE_SECRET_KEY is missing on the server.");
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * Every data route checks this for itself.
 *
 * The proxy already turned unsigned page requests away, but the Next docs are
 * explicit that proxy is an optimistic check and not an authorization layer —
 * so the route that actually touches wages verifies the cookie again.
 */
export async function requireSession(): Promise<boolean> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return verifySession(token, process.env.SESSION_SECRET ?? "");
}
