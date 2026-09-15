import { NextRequest, NextResponse } from "next/server";
import { setAuthTokenCookie, signAuthToken } from "@/lib/auth-config";
import { verifyMagicLoginToken } from "@/lib/magic-login";
import prisma from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const token =
      typeof body.token === "string" ? body.token.trim() : "";

    if (!token) {
      return NextResponse.json(
        { error: "Login link is required" },
        { status: 400 },
      );
    }

    let payload;
    try {
      payload = verifyMagicLoginToken(token);
    } catch (error) {
      const name = error instanceof Error ? error.name : "";
      const message =
        name === "TokenExpiredError"
          ? "This login link has expired. Ask the superadmin for a new one."
          : "This login link is invalid. Ask the superadmin for a new one.";
      return NextResponse.json({ error: message }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
    });

    if (!user || user.isDeleted) {
      return NextResponse.json(
        { error: "This login link is no longer valid." },
        { status: 401 },
      );
    }

    if (
      payload.email &&
      user.email.toLowerCase() !== payload.email.toLowerCase()
    ) {
      return NextResponse.json(
        { error: "This login link is no longer valid." },
        { status: 401 },
      );
    }

    const sessionToken = signAuthToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      privileges: user.privileges,
    });

    const response = NextResponse.json({
      message: "Login successful",
      token: sessionToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });

    setAuthTokenCookie(response, sessionToken);

    return response;
  } catch (error) {
    console.error("Magic login error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
