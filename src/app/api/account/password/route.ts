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
    if (!row) return unauthorised();
    // Right after signing in with a one-time password, that sign-in already proved it —
    // asking for it again only gets in the way. Changing a password you chose yourself
    // still needs the current one, so a session left open cannot be taken over.
    if (!user.mustChange && !(await verifyPassword(current, row.password_hash))) {
      return problem("Your current password is not right.");
    }
    const why = passwordProblem(next);
    if (why) return problem(why);
    if (await verifyPassword(next, row.password_hash)) {
      return problem(user.mustChange ? "Choose your own password, not the one-time one." : "Choose a password different from the current one.");
    }

    const version = await setOwnPassword(user.id, await hashPassword(next));
    // Other devices are signed out; this one carries on with a fresh cookie.
    await issueSession({ id: user.id, sessionVersion: version, areas: user.areas, mustChange: false });
    return Response.json({ ok: true });
  } catch (e) {
    return problem((e as Error).message, 500);
  }
}
