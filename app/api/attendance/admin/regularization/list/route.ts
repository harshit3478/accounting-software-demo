import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireSettingPermission } from "@/lib/auth";

export async function GET() {
  try {
    const admin = await requireSettingPermission("regularizations");
    // return latest first
    const items = await prisma.regularizationRequest.findMany({
      orderBy: { createdAt: "desc" },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    return NextResponse.json({ ok: true, items });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Unauthorized" },
      { status: 401 },
    );
  }
}
