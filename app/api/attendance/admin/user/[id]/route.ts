import { NextResponse } from "next/server";
import prisma from "../../../../../../lib/prisma";
import { requireAdmin } from "../../../../../../lib/auth";

export async function GET(req: Request, { params }: any) {
  try {
    await requireAdmin();
    const resolvedParams = await params;
    const id = parseInt(resolvedParams.id, 10);
    if (isNaN(id))
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    const url = new URL(req.url);
    const startDate = url.searchParams.get("startDate");
    const endDate = url.searchParams.get("endDate");

    const whereClause: any = { userId: id };

    // Apply date filtering if provided
    if (startDate && endDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);

      whereClause.date = {
        gte: start,
        lte: end,
      };
    }

    const entries = await prisma.attendanceEntry.findMany({
      where: whereClause,
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
