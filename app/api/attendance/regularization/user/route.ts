import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function GET() {
  try {
    const user = await requireAuth();
    // Only staff or accountant can view their regularization requests
    if (!(user.role === "staff" || user.role === "accountant")) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
      });
    }
    const items = await prisma.regularizationRequest.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ ok: true, items });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Unauthorized" },
      { status: 401 }
    );
  }
}
