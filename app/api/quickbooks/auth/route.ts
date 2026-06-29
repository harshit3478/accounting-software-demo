import { NextRequest, NextResponse } from "next/server";
import { requireSettingPermission } from "../../../../lib/auth";
import {
  formatSensitiveActionOtpError,
  requireSensitiveActionOtp,
} from "../../../../lib/sensitive-action-otp";
import {
  getQuickBooksAuthUri,
  getQuickBooksConfig,
} from "../../../../lib/quickbooks";

export async function POST(request: NextRequest) {
  try {
    const user = await requireSettingPermission("quickbooks");
    const { otp } = await request.json().catch(() => ({}));

    await requireSensitiveActionOtp(user, otp);

    const config = getQuickBooksConfig();
    console.log("QuickBooks Auth Init:", {
      environment: config.environment,
      clientIdPrefix: config.clientId.substring(0, 5) + "...",
      redirectUri: config.redirectUri,
    });

    const authUri = getQuickBooksAuthUri();

    return NextResponse.json({ authUri });
  } catch (error: unknown) {
    const otpError = formatSensitiveActionOtpError(error);
    if (otpError) {
      return NextResponse.json({ error: otpError.message }, { status: otpError.status });
    }

    const message = error instanceof Error ? error.message : "Request failed";
    const status =
      message === "Unauthorized"
        ? 401
        : message === "Forbidden"
          ? 403
          : 500;
    console.error("QuickBooks auth init error:", error);
    return NextResponse.json({ error: message }, { status });
  }
}
