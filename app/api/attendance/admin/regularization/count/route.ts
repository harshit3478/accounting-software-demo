import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { requireAdmin } from "@/lib/auth";
const prisma = new PrismaClient();
// import { requireAdmin } from "../../../../../lib/auth";

export async function GET() {
  try {
    await requireAdmin();
    const count = await prisma.regularizationRequest.count({
      where: { status: "pending" },
    });
    return NextResponse.json({ ok: true, count });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Unauthorized" },
      { status: 401 }
    );
  }
}
