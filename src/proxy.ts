// Next 16 renamed middleware to Proxy. This runs before every page request and
// turns anyone without a valid cookie back to the login screen, and anyone
// whose login does not cover a section back to the dashboard.
//
// It is an optimistic check only — the Next docs are explicit that proxy is not
// an authorization layer. Every data route verifies the person again (against
// their row in erp_users), so the data is guarded even if a request somehow
// reaches a route directly.
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/session";
import { areaFor, canUseAssistant } from "@/lib/areas";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isApi = pathname.startsWith("/api/");
  const claims = await verifySession(
    request.cookies.get(SESSION_COOKIE)?.value,
    process.env.SESSION_SECRET ?? "",
  );

  if (!claims) {
    // A data call must be told "no" in a way its caller can read. Redirecting it
    // would make fetch() follow along and hand back the login page's HTML with a
    // cheerful 200, which reads as success and silently loses whatever was
    // being saved.
    if (isApi) return Response.json({ error: "Please sign in again." }, { status: 401 });
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const area = areaFor(pathname);
  const assistant = pathname === "/assistant" || pathname.startsWith("/assistant/") || pathname.startsWith("/api/assistant");
  if ((area && !claims.a.includes(area)) || (assistant && !canUseAssistant(claims.a))) {
    if (isApi) return Response.json({ error: "Your login does not cover this." }, { status: 403 });
    return NextResponse.redirect(new URL("/home?denied=1", request.url));
  }

  // A temporary password must be replaced before anything else.
  if (claims.m && !isApi && pathname !== "/account") {
    return NextResponse.redirect(new URL("/account", request.url));
  }
  return NextResponse.next();
}

// Everything except the login screen, the routes it needs, and the files a
// browser must be able to fetch before anyone has logged in — the manifest and
// icons especially, or the app cannot be installed from the login screen.
export const config = {
  matcher: [
    "/((?!login|api/login|api/logout|manifest.webmanifest|sw.js|icon-|favicon.ico|_next/static|_next/image).*)",
  ],
};
