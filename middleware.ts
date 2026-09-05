import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySessionTokenRaw } from "@/lib/auth/session";

export async function middleware(request: NextRequest) {
  const sessionCookie = request.cookies.get("session")?.value;
  const isLoginPage = request.nextUrl.pathname === "/login";
  const hasValidSession = sessionCookie
    ? await verifySessionTokenRaw(sessionCookie)
    : false;

  if (!hasValidSession && !isLoginPage) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    const res = NextResponse.redirect(loginUrl);
    if (sessionCookie) {
      res.cookies.delete("session");
    }
    return res;
  }

  if (hasValidSession && isLoginPage) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/students/:path*",
    "/courses/:path*",
    "/intakes/:path*",
    "/enrollments/:path*",
    "/results/:path*",
    "/course-notices/:path*",
    "/reports/:path*",
    "/analytics/:path*",
    "/documents/:path*",
    "/audit-logs/:path*",
    "/settings/:path*",
    "/users/:path*",
    "/api/:path*",
    "/login",
  ],
};
