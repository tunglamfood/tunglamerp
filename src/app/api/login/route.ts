// Checks a username and password on the server, where neither can be read out
// of the page.
import { findLogin, recordFailure, recordSuccess } from "@/lib/store-staff";
import { DUMMY_HASH, verifyPassword } from "@/lib/password";
import { issueSession } from "@/lib/auth";
import { isArea } from "@/lib/areas";

export const runtime = "nodejs";

const WRONG = "Wrong username or password.";

export async function POST(request: Request) {
  // Missing configuration must lock the door, never open it.
  if (!process.env.SESSION_SECRET) {
    return Response.json(
      { error: "The system is not set up yet — SESSION_SECRET has not been configured." },
      { status: 500 },
    );
  }

  let username = "";
  let password = "";
  try {
    const body = await request.json();
    username = typeof body?.username === "string" ? body.username.trim().toLowerCase() : "";
    password = typeof body?.password === "string" ? body.password : "";
  } catch {
    return Response.json({ error: "Could not read what was sent." }, { status: 400 });
  }
  if (!username || !password) return Response.json({ error: WRONG }, { status: 401 });

  try {
    const row = await findLogin(username);
    if (!row) {
      // Take as long as a real check, so the answer does not reveal which usernames exist.
      await verifyPassword(password, DUMMY_HASH);
      return Response.json({ error: WRONG }, { status: 401 });
    }
    if (row.locked_until && new Date(row.locked_until).getTime() > Date.now()) {
      return Response.json(
        { error: "Too many wrong tries. Wait 15 minutes, or ask whoever manages staff logins to reset your password." },
        { status: 429 },
      );
    }
    if (!(await verifyPassword(password, row.password_hash))) {
      await recordFailure(row);
      return Response.json({ error: WRONG }, { status: 401 });
    }
    if (!row.active) {
      return Response.json({ error: "This login has been switched off." }, { status: 403 });
    }

    await recordSuccess(row.id);
    await issueSession({
      id: row.id,
      sessionVersion: row.session_version,
      areas: row.areas.filter(isArea),
      mustChange: row.must_change_password,
    });
    return Response.json({ ok: true, mustChange: row.must_change_password });
  } catch (e) {
    return Response.json({ error: `Could not sign in: ${(e as Error).message}` }, { status: 500 });
  }
}
