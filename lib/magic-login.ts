import crypto from "crypto";
import jwt from "jsonwebtoken";

export const MAGIC_LOGIN_EXPIRES_IN = "7d" as const;
export const MAGIC_LOGIN_EXPIRES_DAYS = 7;

export type MagicLoginPayload = {
  purpose: "magic-login";
  userId: number;
  email?: string;
};

function secret() {
  const value = process.env.JWT_SECRET;
  if (!value) {
    throw new Error("JWT_SECRET is not configured");
  }
  return value;
}

function isLocalOrigin(origin: string) {
  return /localhost|127\.0\.0\.1/i.test(origin);
}

export function signMagicLoginToken(user: {
  id: number;
  email: string;
}): string {
  const exp = Date.now() + MAGIC_LOGIN_EXPIRES_DAYS * 24 * 60 * 60 * 1000;
  const payload = `ml.${user.id}.${exp}`;
  const sig = crypto
    .createHmac("sha256", secret())
    .update(payload)
    .digest("base64url");
  return Buffer.from(`${payload}.${sig}`, "utf8").toString("base64url");
}

function verifyCompactToken(token: string): MagicLoginPayload {
  let decoded = "";
  try {
    decoded = Buffer.from(token, "base64url").toString("utf8");
  } catch {
    throw new Error("Invalid login link");
  }

  const parts = decoded.split(".");
  if (parts.length !== 4 || parts[0] !== "ml") {
    throw new Error("Invalid login link");
  }

  const [, userIdRaw, expRaw, sig] = parts;
  const payload = `ml.${userIdRaw}.${expRaw}`;
  const expected = crypto
    .createHmac("sha256", secret())
    .update(payload)
    .digest("base64url");

  const sigBuffer = Buffer.from(sig);
  const expectedBuffer = Buffer.from(expected);
  if (
    sigBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(sigBuffer, expectedBuffer)
  ) {
    throw new Error("Invalid login link");
  }

  const userId = Number(userIdRaw);
  const exp = Number(expRaw);
  if (!Number.isInteger(userId) || userId <= 0 || !Number.isFinite(exp)) {
    throw new Error("Invalid login link");
  }

  if (Date.now() > exp) {
    const error = new Error("Login link expired");
    error.name = "TokenExpiredError";
    throw error;
  }

  return {
    purpose: "magic-login",
    userId,
  };
}

function verifyLegacyJwtToken(token: string): MagicLoginPayload {
  const decoded = jwt.verify(token, secret()) as MagicLoginPayload &
    jwt.JwtPayload;

  const userId = Number(decoded.userId);
  if (
    decoded.purpose !== "magic-login" ||
    !Number.isInteger(userId) ||
    userId <= 0
  ) {
    throw new Error("Invalid login link");
  }

  return {
    purpose: "magic-login",
    userId,
    email: decoded.email,
  };
}

export function verifyMagicLoginToken(token: string): MagicLoginPayload {
  if (!token.includes(".")) {
    return verifyCompactToken(token);
  }
  return verifyLegacyJwtToken(token);
}

export function getMagicLoginOrigin(requestOrigin: string): string {
  const configured = (
    process.env.NEXTAUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    ""
  ).replace(/\/$/, "");

  if (configured && !isLocalOrigin(configured)) {
    return configured;
  }

  return requestOrigin.replace(/\/$/, "");
}

export function buildMagicLoginUrl(origin: string, token: string): string {
  const url = new URL("/login", `${origin}/`);
  url.searchParams.set("token", token);
  return url.toString();
}
