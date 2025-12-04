import { NextResponse } from "next/server";
import prisma from "../../../../lib/prisma";
import { requireAuth } from "../../../../lib/auth";

export async function POST(req: Request) {
  try {
    const user = await requireAuth();

    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);

    let entry = await prisma.attendanceEntry.findFirst({
      where: { userId: user.id, date: startOfDay },
    });

    if (!entry) {
      // If there was no checkin, create an entry with only checkout
      entry = await prisma.attendanceEntry.create({
        data: { userId: user.id, date: startOfDay, checkOut: now },
      });
    } else {
      entry = await prisma.attendanceEntry.update({
        where: { id: entry.id },
        data: { checkOut: now },
      });
    }

    // compute total hours if checkIn exists
    if (entry.checkIn && entry.checkOut) {
      const diff =
        (entry.checkOut.getTime() - entry.checkIn.getTime()) / (1000 * 60 * 60);
      const hours = Math.round(diff * 100) / 100; // 2 decimals
      entry = await prisma.attendanceEntry.update({
        where: { id: entry.id },
        data: { totalHours: hours },
      });
    }

    return NextResponse.json({ ok: true, entry });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Unauthorized" },
      { status: 401 }
    );
  }
}
