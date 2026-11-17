// Signing in and out, and the check at the top of every page.
import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, signSession } from "./session";
import { currentUser, type StaffUser } from "./supabase-server";
import type { Area } from "./areas";

export const SESSION_DAYS = 30;

/** Sets the session cookie for this person. */
export async function issueSession(user: {
  id: number;
  sessionVersion: number;
  areas: string[];
  mustChange: boolean;
}): Promise<void> {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not set.");
  const maxAge = SESSION_DAYS * 24 * 3600;
  const token = await signSession(
    {
      u: user.id,
      v: user.sessionVersion,
      a: user.areas,
      ...(user.mustChange ? { m: 1 as const } : {}),
      exp: Date.now() + maxAge * 1000,
    },
    secret,
  );
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge,
  });
}

/** For pages: the signed-in person, or off to the login screen. */
export async function requireUser(): Promise<StaffUser> {
  const user = await currentUser();
  if (!user) redirect("/login");
  return user;
}

/** For pages: the signed-in person, who must be able to open this area. */
export async function requireArea(area: Area): Promise<StaffUser> {
  const user = await requireUser();
  if (!user.areas.includes(area)) redirect("/home?denied=1");
  return user;
}
