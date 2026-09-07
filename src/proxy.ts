// Next 16 renamed middleware to Proxy. This runs before every page request and
// turns anyone without a valid cookie back to the login screen.
//
// It is an optimistic check only — the Next docs are explicit that proxy is not
// an authorization layer. Every data route verifies the same cookie itself, so
// the data is guarded even if a request somehow reaches a route directly.
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

export async function proxy(request: NextRequest) {
  const ok = await verifySession(
    request.cookies.get(SESSION_COOKIE)?.value,
    process.env.SESSION_SECRET ?? "",
  );
  if (ok) return NextResponse.next();

  // A data call must be told "no" in a way its caller can read. Redirecting it
  // would make fetch() follow along and hand back the login page's HTML with a
  // cheerful 200, which reads as success and silently loses whatever was
  // being saved.
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return Response.json({ error: "Please sign in again." }, { status: 401 });
  }
  return NextResponse.redirect(new URL("/login", request.url));
}

// Everything except the login screen, the routes it needs, and the files a
// browser must be able to fetch before anyone has logged in — the manifest and
// icons especially, or the app cannot be installed from the login screen.
export const config = {
  matcher: [
    "/((?!login|api/login|api/logout|manifest.webmanifest|sw.js|icon-|favicon.ico|_next/static|_next/image).*)",
  ],
};
