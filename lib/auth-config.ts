import jwt from "jsonwebtoken";
import type { NextResponse } from "next/server";

/** Default for all users: stay signed in until explicit logout. */
export const AUTH_JWT_EXPIRES_IN = "3650d" as const;

/** Browser-safe persistent cookie (~400 days); refreshed on auth-check while active. */
export const AUTH_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 400;

export type AuthTokenPayload = {
  userId: number;
  email: string;
  role: string;
  name: string;
  privileges: unknown;
};

export function signAuthToken(payload: AuthTokenPayload): string {
  return jwt.sign(payload, process.env.JWT_SECRET!, {
    expiresIn: AUTH_JWT_EXPIRES_IN,
  });
}

export function getAuthCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: AUTH_COOKIE_MAX_AGE_SECONDS,
    path: "/",
  };
}

export function setAuthTokenCookie(response: NextResponse, token: string) {
  response.cookies.set("token", token, getAuthCookieOptions());
}
