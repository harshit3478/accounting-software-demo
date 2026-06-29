import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { requireSettingPermission } from "@/lib/auth";
const prisma = new PrismaClient();
// import { requireAdmin } from "../../../../../lib/auth";

export async function GET() {
  try {
    await requireSettingPermission("regularizations");
    const count = await prisma.regularizationRequest.count({
      where: { status: "pending" },
    });
    return NextResponse.json({ ok: true, count });
  } catch (err: any) {
    const message = err.message || "Unauthorized";
    const status = message === "Unauthorized" ? 401 : 403;
    return NextResponse.json({ error: message }, { status });
  }
}
