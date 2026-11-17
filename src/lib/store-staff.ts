// Staff logins: who can sign in to the ERP (and to the website's content
// admin), and what each person can open.
import "server-only";
import { serverSupabase } from "./supabase-server";
import { fail } from "./db-error";
import { hashPassword, tempPassword } from "./password";
import { isArea, type Area } from "./areas";

export interface StaffLogin {
  id?: number;
  username: string;
  name: string;
  areas: Area[];
  active: boolean;
  mustChange?: boolean;
  lastLoginAt?: string | null;
  /** Too many wrong passwords just now. */
  locked?: boolean;
}

type Row = {
  id: number; username: string; name: string; areas: string[]; active: boolean;
  must_change_password: boolean; last_login_at: string | null; locked_until: string | null;
  session_version: number;
};

const toLogin = (r: Row): StaffLogin => ({
  id: r.id, username: r.username, name: r.name, areas: (r.areas ?? []).filter(isArea),
  active: r.active, mustChange: r.must_change_password, lastLoginAt: r.last_login_at,
  locked: !!r.locked_until && new Date(r.locked_until).getTime() > Date.now(),
});

export async function listStaff(): Promise<StaffLogin[]> {
  const { data, error } = await serverSupabase()
    .from("erp_users")
    .select("id, username, name, areas, active, must_change_password, last_login_at, locked_until, session_version")
    .order("name");
  fail("Could not load the staff logins", error);
  return ((data ?? []) as Row[]).map(toLogin);
}

async function getRow(id: number): Promise<Row | null> {
  const { data, error } = await serverSupabase().from("erp_users").select("*").eq("id", id).maybeSingle();
  fail("Could not load that login", error);
  return (data as Row) ?? null;
}

/** Someone must always be left who can manage logins, or nobody could ever fix one. */
async function wouldLeaveNoAdmin(changingId: number | undefined, next: { areas: Area[]; active: boolean }) {
  if (next.active && next.areas.includes("admin")) return false;
  const { data, error } = await serverSupabase()
    .from("erp_users").select("id").eq("active", true).contains("areas", ["admin"]);
  fail("Could not check who manages logins", error);
  return ((data ?? []) as { id: number }[]).filter((r) => r.id !== changingId).length === 0;
}

/**
 * Adds or changes a login. A new login gets a one-time password, returned here
 * once and never stored in the clear; the person must change it when they first
 * sign in. Changing what someone can open, or switching them off, signs them
 * out everywhere.
 */
export async function saveStaff(s: StaffLogin, actingId: number): Promise<{ tempPassword?: string }> {
  const db = serverSupabase();
  if (await wouldLeaveNoAdmin(s.id, s)) {
    throw new Error("Someone else must be able to manage staff logins before this one stops.");
  }
  if (s.id === actingId && (!s.active || !s.areas.includes("admin"))) {
    throw new Error("You can't switch off your own login or take away your own access to staff logins.");
  }

  if (!s.id) {
    const password = tempPassword();
    const { error } = await db.from("erp_users").insert({
      username: s.username, name: s.name, areas: s.areas, active: s.active,
      password_hash: await hashPassword(password), must_change_password: true,
    });
    if (error?.code === "23505") throw new Error(`The username "${s.username}" is taken.`);
    fail("Could not add that login", error);
    return { tempPassword: password };
  }

  const before = await getRow(s.id);
  if (!before) throw new Error("That login no longer exists.");
  const accessChanged =
    before.active !== s.active ||
    before.username !== s.username ||
    [...before.areas].sort().join() !== [...s.areas].sort().join();
  const { error } = await db.from("erp_users").update({
    username: s.username, name: s.name, areas: s.areas, active: s.active,
    ...(accessChanged ? { session_version: before.session_version + 1 } : {}),
    updated_at: new Date().toISOString(),
  }).eq("id", s.id);
  if (error?.code === "23505") throw new Error(`The username "${s.username}" is taken.`);
  fail("Could not save that login", error);
  return {};
}

/** A fresh one-time password, which also unlocks the login and signs it out everywhere. */
export async function resetStaffPassword(id: number): Promise<string> {
  const before = await getRow(id);
  if (!before) throw new Error("That login no longer exists.");
  const password = tempPassword();
  const { error } = await serverSupabase().from("erp_users").update({
    password_hash: await hashPassword(password),
    must_change_password: true,
    failed_count: 0,
    locked_until: null,
    session_version: before.session_version + 1,
    updated_at: new Date().toISOString(),
  }).eq("id", id);
  fail("Could not reset that password", error);
  return password;
}

export async function deleteStaff(id: number, actingId: number): Promise<void> {
  if (id === actingId) throw new Error("You can't remove your own login.");
  if (await wouldLeaveNoAdmin(id, { areas: [], active: false })) {
    throw new Error("Someone else must be able to manage staff logins before this one goes.");
  }
  const { error } = await serverSupabase().from("erp_users").delete().eq("id", id);
  fail("Could not remove that login", error);
}

/* ── Signing in ──────────────────────────────────────────────────────────── */

export interface LoginRow {
  id: number; username: string; name: string; areas: string[]; active: boolean;
  password_hash: string; must_change_password: boolean; session_version: number;
  failed_count: number; locked_until: string | null;
}

export async function findLogin(username: string): Promise<LoginRow | null> {
  const { data, error } = await serverSupabase()
    .from("erp_users").select("*").eq("username", username).maybeSingle();
  fail("Could not check that login", error);
  return (data as LoginRow) ?? null;
}

const MAX_TRIES = 5;
const LOCK_MINUTES = 15;

/** Counts a wrong password; the fifth in a row locks the login for a while. */
export async function recordFailure(row: LoginRow): Promise<void> {
  const n = row.failed_count + 1;
  await serverSupabase().from("erp_users").update(
    n >= MAX_TRIES
      ? { failed_count: 0, locked_until: new Date(Date.now() + LOCK_MINUTES * 60_000).toISOString() }
      : { failed_count: n },
  ).eq("id", row.id);
}

export async function recordSuccess(id: number): Promise<void> {
  await serverSupabase().from("erp_users").update({
    failed_count: 0, locked_until: null, last_login_at: new Date().toISOString(),
  }).eq("id", id);
}

/** Sets a password the person chose; signs out their other devices. */
export async function setOwnPassword(id: number, hash: string): Promise<number> {
  const before = await getRow(id);
  if (!before) throw new Error("That login no longer exists.");
  const version = before.session_version + 1;
  const { error } = await serverSupabase().from("erp_users").update({
    password_hash: hash, must_change_password: false, session_version: version,
    updated_at: new Date().toISOString(),
  }).eq("id", id);
  fail("Could not save your new password", error);
  return version;
}
