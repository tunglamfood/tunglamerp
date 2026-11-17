// The only place the database is reached from. The key lives here and here
// only; importing this from a client component is a build error, which is the
// point of "server-only".
import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { SESSION_COOKIE, verifySession } from "./session";
import { isArea, type Area } from "./areas";

export function serverSupabase(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL or SUPABASE_SECRET_KEY is missing on the server.");
  return createClient(url, key, { auth: { persistSession: false } });
}

/** The person signed in on this request. */
export interface StaffUser {
  id: number;
  username: string;
  name: string;
  areas: Area[];
  mustChange: boolean;
  sessionVersion: number;
}

/**
 * Who is signed in, checked against their row on every request: a cookie for a
 * login that has since been switched off, reset or given different access is
 * refused, because each of those bumps `session_version`.
 */
export const currentUser = cache(async (): Promise<StaffUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const claims = await verifySession(token, process.env.SESSION_SECRET ?? "");
  if (!claims) return null;
  const { data, error } = await serverSupabase()
    .from("erp_users")
    .select("id, username, name, areas, must_change_password, active, session_version")
    .eq("id", claims.u)
    .maybeSingle();
  if (error || !data || !data.active || data.session_version !== claims.v) return null;
  return {
    id: data.id as number,
    username: data.username as string,
    name: data.name as string,
    areas: ((data.areas as string[]) ?? []).filter(isArea),
    mustChange: !!data.must_change_password,
    sessionVersion: data.session_version as number,
  };
});

/**
 * Every data route checks this for itself — and, when it names an area, that
 * the person may open that area.
 *
 * The proxy already turned unsigned page requests away, but the Next docs are
 * explicit that proxy is an optimistic check and not an authorization layer —
 * so the route that actually touches wages verifies the cookie again.
 */
export async function requireSession(area?: Area): Promise<boolean> {
  const user = await currentUser();
  return !!user && (!area || user.areas.includes(area));
}
