import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  REPORTS_COOKIE,
  reportsAuthConfigured,
  verifyReportsSession,
} from "@/lib/reportsAuth";

const PUBLIC_PATHS = ["/login"];

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.includes(pathname)) return true;
  if (pathname.startsWith("/api/")) return true;
  if (pathname.startsWith("/_next/")) return true;
  if (pathname === "/favicon.ico") return true;
  return false;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = request.cookies.get(REPORTS_COOKIE)?.value;
  const authed = reportsAuthConfigured()
    ? await verifyReportsSession(session)
    : false;

  if (pathname === "/login" && authed) {
    const next = request.nextUrl.searchParams.get("next") || "/";
    return NextResponse.redirect(new URL(next, request.url));
  }

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  if (!reportsAuthConfigured()) {
    return new NextResponse(
      "Falta REPORTS_PASSWORD en variables de entorno.",
      { status: 503 }
    );
  }

  if (authed) {
    const res = NextResponse.next();
    if (pathname.startsWith("/reports/") && pathname.endsWith(".html")) {
      res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
      res.headers.set("CDN-Cache-Control", "no-store");
      res.headers.set("Vercel-CDN-Cache-Control", "no-store");
    }
    return res;
  }

  const login = new URL("/login", request.url);
  login.searchParams.set("next", pathname);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
