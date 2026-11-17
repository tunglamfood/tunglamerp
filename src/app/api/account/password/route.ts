// Choosing your own password — required after a one-time password.
import { currentUser } from "@/lib/supabase-server";
import { findLogin, setOwnPassword } from "@/lib/store-staff";
import { hashPassword, passwordProblem, verifyPassword } from "@/lib/password";
import { issueSession } from "@/lib/auth";
import { problem, readBody, unauthorised } from "@/lib/route-helpers";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return unauthorised();
  const b = await readBody(request);
  if (!b) return problem("Could not read what was sent.");
  const current = typeof b.current === "string" ? b.current : "";
  const next = typeof b.next === "string" ? b.next : "";

  try {
    const row = await findLogin(user.username);
    if (!row || !(await verifyPassword(current, row.password_hash))) {
      return problem("Your current password is not right.");
    }
    const why = passwordProblem(next);
    if (why) return problem(why);
    if (next === current) return problem("Choose a password different from the current one.");

    const version = await setOwnPassword(user.id, await hashPassword(next));
    // Other devices are signed out; this one carries on with a fresh cookie.
    await issueSession({ id: user.id, sessionVersion: version, areas: user.areas, mustChange: false });
    return Response.json({ ok: true });
  } catch (e) {
    return problem((e as Error).message, 500);
  }
}
