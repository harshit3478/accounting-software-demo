import crypto from "crypto";
import prisma from "./prisma";
import { isSuperAdmin } from "./auth";
import { sendSensitiveActionOtpEmail } from "./email";

export const ACTION_OTP_EXPIRY_MS = 10 * 60 * 1000;

export class SensitiveActionOtpError extends Error {
  status: number;

  constructor(message: string, status = 403) {
    super(message);
    this.name = "SensitiveActionOtpError";
    this.status = status;
  }
}

type OtpUser = {
  id: number;
  email?: string;
};

export async function sendSensitiveActionOtp(user: OtpUser) {
  const otp = crypto.randomInt(100000, 999999).toString();
  const actionOtpExpiresAt = new Date(Date.now() + ACTION_OTP_EXPIRY_MS);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      actionOtpCode: otp,
      actionOtpExpiresAt,
    },
  });

  const emailResult = await sendSensitiveActionOtpEmail(user.email!, otp);
  if (!emailResult.success) {
    throw new SensitiveActionOtpError("Failed to send verification code", 500);
  }

  return { message: "Verification code sent" };
}

export async function requireSensitiveActionOtp(
  user: OtpUser,
  otp: string | undefined | null,
): Promise<void> {
  if (isSuperAdmin(user)) {
    return;
  }

  const code = typeof otp === "string" ? otp.trim() : "";
  if (!code) {
    throw new SensitiveActionOtpError(
      "OTP verification is required for this action",
      403,
    );
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      actionOtpCode: true,
      actionOtpExpiresAt: true,
    },
  });

  if (!dbUser?.actionOtpCode || !dbUser.actionOtpExpiresAt) {
    throw new SensitiveActionOtpError(
      "Verification code expired or not requested. Request a new code.",
      422,
    );
  }

  if (new Date() > dbUser.actionOtpExpiresAt) {
    throw new SensitiveActionOtpError(
      "Verification code expired. Request a new code.",
      422,
    );
  }

  if (dbUser.actionOtpCode !== code) {
    throw new SensitiveActionOtpError("Invalid verification code", 422);
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      actionOtpCode: null,
      actionOtpExpiresAt: null,
    },
  });
}

export function formatSensitiveActionOtpError(error: unknown): {
  message: string;
  status: number;
} | null {
  if (error instanceof SensitiveActionOtpError) {
    return { message: error.message, status: error.status };
  }
  return null;
}
