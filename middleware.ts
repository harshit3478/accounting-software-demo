import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Tell Next.js to use Node.js runtime for middleware
export const config = {
  matcher: [
    "/",
    "/admin/:path*",
    "/invoices/:path*",
    "/payments/:path*",
    "/statements/:path*",
    "/login",
    "/forgot-password",
    "/reset-password",
  ],
  runtime: "nodejs",
};

function decodeTokenPayload(token: string): any {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid token format");
  }

  const payloadBase64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
  return JSON.parse(Buffer.from(payloadBase64, "base64").toString());
}

function isExpired(payload: any): boolean {
  if (!payload?.exp) return false;
  const now = Math.floor(Date.now() / 1000);
  return Number(payload.exp) <= now;
}

export function middleware(request: NextRequest) {
  const token = request.cookies.get("token")?.value;
  const path = request.nextUrl.pathname;

  // Allow access to login, forgot-password, and reset-password pages
  if (
    path === "/login" ||
    path === "/forgot-password" ||
    path.startsWith("/reset-password")
  ) {
    // If already logged in, redirect to home
    if (token) {
      try {
        const payload = decodeTokenPayload(token);
        if (!isExpired(payload)) {
          return NextResponse.redirect(new URL("/", request.url));
        }
        const response = NextResponse.next();
        response.cookies.delete("token");
        return response;
      } catch {
        const response = NextResponse.next();
        response.cookies.delete("token");
        return response;
      }
    }
    return NextResponse.next();
  }

  // Protected routes
  if (
    path.startsWith("/admin") ||
    path === "/" ||
    path.startsWith("/invoices") ||
    path.startsWith("/payments") ||
    path.startsWith("/statements")
  ) {
    if (!token) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    try {
      const payload = decodeTokenPayload(token);
      if (isExpired(payload)) {
        throw new Error("Token expired");
      }

      // Check admin access for admin routes
      if (path.startsWith("/admin") && payload.role !== "admin") {
        return NextResponse.redirect(new URL("/", request.url));
      }
    } catch (error) {
      console.error("Token validation failed:", error);
      const response = NextResponse.redirect(new URL("/login", request.url));
      response.cookies.delete("token");
      return response;
    }
  }

  return NextResponse.next();
}
