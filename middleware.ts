import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const sessionCookie = request.cookies.get("session")?.value;
  const isLoginPage = request.nextUrl.pathname === "/login";

  // Not logged in and not on login page -> redirect to login
  if (!sessionCookie && !isLoginPage) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Logged in and on login page -> redirect to dashboard
  if (sessionCookie && isLoginPage) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/personnel/:path*",
    "/courses/:path*",
    "/subjects/:path*",
    "/enrollments/:path*",
    "/exam-results/:path*",
    "/login",
  ],
};
