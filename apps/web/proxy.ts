import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, OPERATOR_COOKIE, verifySession, verifyOperatorSession } from "@/lib/auth";

// The beta LLM-extraction section requires the regular admin role PLUS this extra
// operator unlock — a separate, additional gate, not a replacement for admin auth.
const OPERATOR_PAGE_PREFIX = "/admin/extraction";
const OPERATOR_UNLOCK_PATH = "/admin/extraction/unlock";
const OPERATOR_API_PREFIXES = ["/api/admin/ingestion"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySession(token) : null;

  const isApi = pathname.startsWith("/api/");
  const isAdminPath = pathname.startsWith("/admin") || pathname.startsWith("/api/admin");

  if (!session) {
    if (isApi) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isAdminPath && session.role !== "admin") {
    if (isApi) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    loginUrl.searchParams.set("admin", "1");
    return NextResponse.redirect(loginUrl);
  }

  const needsOperator =
    (pathname.startsWith(OPERATOR_PAGE_PREFIX) && pathname !== OPERATOR_UNLOCK_PATH) ||
    OPERATOR_API_PREFIXES.some((p) => pathname.startsWith(p));
  if (needsOperator) {
    const operatorToken = request.cookies.get(OPERATOR_COOKIE)?.value;
    const isOperator = operatorToken ? await verifyOperatorSession(operatorToken) : false;
    if (!isOperator) {
      if (isApi) return NextResponse.json({ error: "forbidden" }, { status: 403 });
      const unlockUrl = new URL(OPERATOR_UNLOCK_PATH, request.url);
      unlockUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(unlockUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!login|api/auth|_next/static|_next/image|favicon.ico).*)",
  ],
};
