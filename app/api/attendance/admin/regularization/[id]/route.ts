import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export async function PUT(req: Request, { params }: any) {
  try {
    const admin = await requireAdmin();
    const resolvedParams = await params;
    const id = parseInt(resolvedParams.id, 10);
    if (isNaN(id))
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    const body = await req.json();
    const allowed = ["pending", "approved", "rejected"];
    const status = body.status;
    if (!allowed.includes(status))
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });

    const updated = await prisma.regularizationRequest.update({
      where: { id },
      data: {
        status,
        reviewedBy: admin.id,
        reviewedAt: new Date(),
      },
    });

    return NextResponse.json({ ok: true, updated });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Unauthorized" },
      { status: 401 }
    );
  }
}
