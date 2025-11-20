import { NextResponse } from "next/server";
import prisma from "../../../../../../lib/prisma";
import { requireAdmin } from "../../../../../../lib/auth";

export async function GET(req: Request, { params }: any) {
  try {
    await requireAdmin();
    const id = parseInt(params.id, 10);
    if (isNaN(id))
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    const entries = await prisma.attendanceEntry.findMany({
      where: { userId: id },
      orderBy: { date: "desc" },
    });
    return NextResponse.json({ ok: true, entries });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Unauthorized" },
      { status: 401 }
    );
  }
}
