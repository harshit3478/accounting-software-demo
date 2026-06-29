import { NextRequest, NextResponse } from "next/server";
import { signAuthToken, setAuthTokenCookie } from "@/lib/auth-config";
import prisma from "../../../lib/prisma";
import { isSuperAdmin, requireAuth } from "../../../lib/auth";
import { formatUserDisplayName } from "../../../lib/user-display";

export async function GET() {
  try {
    const user = await requireAuth();
    return NextResponse.json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      avatarUrl: user.avatarUrl,
      displayName: formatUserDisplayName(user),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unauthorized";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const currentUser = await requireAuth();
    const { name } = await request.json();
    const trimmedName = typeof name === "string" ? name.trim() : "";

    if (!trimmedName) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const user = await prisma.user.update({
      where: { id: currentUser.id },
      data: { name: trimmedName },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatarUrl: true,
        privileges: true,
      },
    });

    const privileges = user.privileges as Record<string, unknown> | null;
    const token = signAuthToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      privileges,
    });

    const response = NextResponse.json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      avatarUrl: user.avatarUrl,
      displayName: formatUserDisplayName(user),
      isSuperAdmin: isSuperAdmin(user),
    });

    setAuthTokenCookie(response, token);

    return response;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Request failed";
    const status = message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
