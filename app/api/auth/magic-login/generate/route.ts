import { NextRequest, NextResponse } from "next/server";
import { isSuperAdmin, requireSuperAdmin } from "@/lib/auth";
import {
  MAGIC_LOGIN_EXPIRES_DAYS,
  buildMagicLoginUrl,
  getMagicLoginOrigin,
  signMagicLoginToken,
} from "@/lib/magic-login";
import prisma from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    await requireSuperAdmin();

    const body = await request.json().catch(() => ({}));
    const userId = Number(body.userId);

    if (!Number.isInteger(userId) || userId <= 0) {
      return NextResponse.json({ error: "User is required" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isDeleted: true,
      },
    });

    if (!user || user.isDeleted) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (isSuperAdmin(user)) {
      return NextResponse.json(
        { error: "Cannot create a login link for the superadmin" },
        { status: 403 },
      );
    }

    const token = signMagicLoginToken(user);
    const forwardedHost = request.headers.get("x-forwarded-host");
    const forwardedProto = request.headers.get("x-forwarded-proto");
    const requestOrigin =
      forwardedHost && forwardedProto
        ? `${forwardedProto.split(",")[0].trim()}://${forwardedHost.split(",")[0].trim()}`
        : request.nextUrl.origin;
    const origin = getMagicLoginOrigin(requestOrigin);
    const loginUrl = buildMagicLoginUrl(origin, token);
    const expiresAt = new Date(
      Date.now() + MAGIC_LOGIN_EXPIRES_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString();

    return NextResponse.json({
      token,
      loginUrl,
      expiresAt,
      expiresInDays: MAGIC_LOGIN_EXPIRES_DAYS,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Internal server error";

    if (message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (
      message === "Super admin access required" ||
      message === "Forbidden"
    ) {
      return NextResponse.json(
        { error: "Super admin access required" },
        { status: 403 },
      );
    }

    console.error("Generate magic login error:", error);
    return NextResponse.json(
      { error: "Failed to create login link" },
      { status: 500 },
    );
  }
}
