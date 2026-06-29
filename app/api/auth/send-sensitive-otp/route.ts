import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import {
  SensitiveActionOtpError,
  sendSensitiveActionOtp,
} from "@/lib/sensitive-action-otp";

export async function POST() {
  try {
    const user = await requireAuth();
    const result = await sendSensitiveActionOtp(user);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof SensitiveActionOtpError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Request failed";
    const status = message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
