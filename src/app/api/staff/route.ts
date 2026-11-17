// Staff logins: add, change, reset a password, remove.
import { currentUser } from "@/lib/supabase-server";
import { deleteStaff, resetStaffPassword, saveStaff } from "@/lib/store-staff";
import { attempt, forbidden, problem, readBody, str, unauthorised } from "@/lib/route-helpers";
import { isArea } from "@/lib/areas";

export const runtime = "nodejs";

async function admin() {
  const user = await currentUser();
  if (!user) return { stop: unauthorised(), user: null };
  if (!user.areas.includes("admin")) return { stop: forbidden(), user: null };
  return { stop: null, user };
}

export async function POST(request: Request) {
  const { stop, user } = await admin();
  if (stop || !user) return stop;
  const b = await readBody(request);
  if (!b) return problem("Could not read what was sent.");

  // A password reset for one login.
  if (b.reset) {
    const id = Number(b.reset);
    if (!id) return problem("Whose password?");
    return attempt(async () => ({ tempPassword: await resetStaffPassword(id) }));
  }

  const username = str(b.username).toLowerCase();
  const name = str(b.name);
  const areas = Array.isArray(b.areas) ? [...new Set(b.areas.filter(isArea))] : [];
  if (!/^[a-z0-9._-]{2,40}$/.test(username)) {
    return problem("A username is 2–40 letters or numbers (dots, dashes and underscores are fine), like ahmad or mei.ling.");
  }
  if (!name || name.length > 80) return problem("Their name is needed.");
  if (areas.length === 0) return problem("Tick at least one thing they can open.");

  return attempt(() =>
    saveStaff({ id: b.id ? Number(b.id) : undefined, username, name, areas, active: b.active !== false }, user.id),
  );
}

export async function DELETE(request: Request) {
  const { stop, user } = await admin();
  if (stop || !user) return stop;
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!id) return problem("Which login should be removed?");
  return attempt(() => deleteStaff(id, user.id));
}
