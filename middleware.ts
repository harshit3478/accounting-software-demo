import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { clearAuthTokenCookie, verifyAuthToken } from "@/lib/auth-config";

export const config = {
  matcher: [
    "/",
    "/admin/:path*",
    "/invoices/:path*",
    "/payments/:path*",
    "/statements/:path*",
    "/cheque-vault/:path*",
    "/cheque-vault",
    "/login",
    "/forgot-password",
    "/reset-password",
  ],
  runtime: "nodejs",
};

function redirectToLogin(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/login", request.url));
  clearAuthTokenCookie(response);
  return response;
}

export function middleware(request: NextRequest) {
  const token = request.cookies.get("token")?.value;
  const path = request.nextUrl.pathname;
  const session = token ? verifyAuthToken(token) : null;

  if (
    path === "/login" ||
    path === "/forgot-password" ||
    path.startsWith("/reset-password")
  ) {
    // Shared login links must be able to replace an existing/stale session.
    if (path === "/login" && request.nextUrl.searchParams.get("token")) {
      return NextResponse.next();
    }

    if (session) {
      return NextResponse.redirect(new URL("/", request.url));
    }

    if (token && !session) {
      const response = NextResponse.next();
      clearAuthTokenCookie(response);
      return response;
    }

    return NextResponse.next();
  }

  if (
    path.startsWith("/admin") ||
    path === "/" ||
    path.startsWith("/invoices") ||
    path.startsWith("/payments") ||
    path.startsWith("/statements") ||
    path.startsWith("/cheque-vault")
  ) {
    if (!session) {
      return redirectToLogin(request);
    }

    if (path.startsWith("/admin") && session.role !== "admin") {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  return NextResponse.next();
}
