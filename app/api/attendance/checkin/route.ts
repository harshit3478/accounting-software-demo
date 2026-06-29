import { NextResponse } from "next/server";
import prisma from "../../../../lib/prisma";
import { requireAuth } from "../../../../lib/auth";
import { startOfBusinessDay } from "../../../../lib/business-date";

export async function POST(req: Request) {
  try {
    const user = await requireAuth();

    const now = new Date();
    const startOfDay = startOfBusinessDay(now);

    // Find existing entry for today
    let entry = await prisma.attendanceEntry.findFirst({
      where: { userId: user.id, date: startOfDay },
    });

    if (!entry) {
      entry = await prisma.attendanceEntry.create({
        data: {
          userId: user.id,
          date: startOfDay,
          checkIn: now,
        },
      });
    } else if (!entry.checkIn) {
      entry = await prisma.attendanceEntry.update({
        where: { id: entry.id },
        data: { checkIn: now },
      });
    }

    return NextResponse.json({ ok: true, entry });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Unauthorized" },
      { status: 401 },
    );
  }
}
