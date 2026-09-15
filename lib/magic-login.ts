import crypto from "crypto";
import jwt from "jsonwebtoken";

export const MAGIC_LOGIN_EXPIRES_IN = "7d" as const;
export const MAGIC_LOGIN_EXPIRES_DAYS = 7;

export type MagicLoginPayload = {
  purpose: "magic-login";
  userId: number;
  email: string;
};

export function signMagicLoginToken(user: {
  id: number;
  email: string;
}): string {
  return jwt.sign(
    {
      purpose: "magic-login",
      userId: user.id,
      email: user.email,
    } satisfies MagicLoginPayload,
    process.env.JWT_SECRET!,
    {
      expiresIn: MAGIC_LOGIN_EXPIRES_IN,
      jwtid: crypto.randomBytes(16).toString("hex"),
    },
  );
}

export function verifyMagicLoginToken(token: string): MagicLoginPayload {
  const decoded = jwt.verify(
    token,
    process.env.JWT_SECRET!,
  ) as MagicLoginPayload & jwt.JwtPayload;

  const userId = Number(decoded.userId);
  if (
    decoded.purpose !== "magic-login" ||
    !Number.isInteger(userId) ||
    userId <= 0 ||
    typeof decoded.email !== "string" ||
    !decoded.email
  ) {
    throw new Error("Invalid login link");
  }

  return {
    purpose: "magic-login",
    userId,
    email: decoded.email,
  };
}

export function getMagicLoginOrigin(requestOrigin: string): string {
  return (
    process.env.NEXTAUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    requestOrigin
  ).replace(/\/$/, "");
}

export function buildMagicLoginUrl(origin: string, token: string): string {
  const url = new URL("/login", `${origin}/`);
  url.searchParams.set("token", token);
  return url.toString();
}
