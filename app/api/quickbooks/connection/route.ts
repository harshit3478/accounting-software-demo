import { NextRequest, NextResponse } from "next/server";
import prisma from "../../../../lib/prisma";
import { requireAuth, requireSettingPermission } from "../../../../lib/auth";
import {
  formatSensitiveActionOtpError,
  requireSensitiveActionOtp,
} from "../../../../lib/sensitive-action-otp";

export async function GET() {
  try {
    const user = await requireAuth();

    const connection = await prisma.quickBooksConnection.findUnique({
      where: { userId: user.id },
      select: {
        id: true,
        realmId: true,
        isActive: true,
        lastSyncAt: true,
        tokenExpiry: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      connected: !!connection && connection.isActive,
      connection: connection
        ? {
            ...connection,
            isExpired: connection.tokenExpiry < new Date(),
          }
        : null,
    });
  } catch (error: any) {
    console.error("QuickBooks status error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await requireSettingPermission("quickbooks");
    const { otp } = await request.json().catch(() => ({}));

    await requireSensitiveActionOtp(user, otp);

    await prisma.quickBooksConnection.update({
      where: { userId: user.id },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const otpError = formatSensitiveActionOtpError(error);
    if (otpError) {
      return NextResponse.json({ error: otpError.message }, { status: otpError.status });
    }

    const message = error instanceof Error ? error.message : "Request failed";
    console.error("QuickBooks disconnect error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
