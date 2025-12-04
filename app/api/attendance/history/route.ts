import { NextResponse } from "next/server";
import prisma from "../../../../lib/prisma";
import { requireAuth } from "../../../../lib/auth";

export async function GET(req: Request) {
  try {
    const user = await requireAuth();
    const url = new URL(req.url);
    const range = url.searchParams.get("range") || "monthly";
    const months = parseInt(url.searchParams.get("months") || "3", 10);

    const now = new Date();
    let start = new Date(now);

    if (range === "daily") {
      start.setDate(now.getDate() - 7);
    } else if (range === "weekly") {
      start.setDate(now.getDate() - 30);
    } else {
      start.setMonth(now.getMonth() - months);
    }

    start.setHours(0, 0, 0, 0);

    const entries = await prisma.attendanceEntry.findMany({
      where: { userId: user.id, date: { gte: start } },
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
