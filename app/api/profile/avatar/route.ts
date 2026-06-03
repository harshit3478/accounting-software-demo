import { NextRequest, NextResponse } from "next/server";
import prisma from "../../../../lib/prisma";
import { requireAuth } from "../../../../lib/auth";
import {
  deleteStoredAvatar,
  saveAvatarFile,
  validateAvatarFile,
} from "../../../../lib/user-avatar";

export async function POST(request: NextRequest) {
  try {
    const currentUser = await requireAuth();
    const formData = await request.formData();
    const file = formData.get("avatar") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    const validationError = validateAvatarFile(file);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const avatarUrl = await saveAvatarFile(
      currentUser.id,
      buffer,
      file.type,
    );

    if (currentUser.avatarUrl) {
      await deleteStoredAvatar(currentUser.avatarUrl);
    }

    const user = await prisma.user.update({
      where: { id: currentUser.id },
      data: { avatarUrl },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatarUrl: true,
      },
    });

    return NextResponse.json({ avatarUrl: user.avatarUrl });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Upload failed";
    const status = message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE() {
  try {
    const currentUser = await requireAuth();

    if (currentUser.avatarUrl) {
      await deleteStoredAvatar(currentUser.avatarUrl);
    }

    await prisma.user.update({
      where: { id: currentUser.id },
      data: { avatarUrl: null },
    });

    return NextResponse.json({ avatarUrl: null });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Delete failed";
    const status = message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
