// Checks the password on the server, where it cannot be read out of the page.
import { cookies } from "next/headers";
import { SESSION_COOKIE, signSession, timingSafeEqual } from "@/lib/session";

export const runtime = "nodejs";

const THIRTY_DAYS = 60 * 60 * 24 * 30;

export async function POST(request: Request) {
  const password = process.env.APP_PASSWORD;
  const secret = process.env.SESSION_SECRET;
  // Missing configuration must lock the door, never open it.
  if (!password || !secret) {
    return Response.json(
      { error: "The system is not set up yet — the password has not been configured." },
      { status: 500 },
    );
  }

  let given = "";
  try {
    const body = await request.json();
    given = typeof body?.password === "string" ? body.password : "";
  } catch {
    return Response.json({ error: "Could not read what was sent." }, { status: 400 });
  }

  if (!timingSafeEqual(given, password)) {
    return Response.json({ error: "Wrong password." }, { status: 401 });
  }

  const token = await signSession(Date.now() + THIRTY_DAYS * 1000, secret);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: THIRTY_DAYS,
  });
  return Response.json({ ok: true });
}
