import { NextResponse } from "next/server";
import prisma from "../../../../lib/prisma";
import { requireAuth } from "../../../../lib/auth";
import { startOfBusinessDay } from "../../../../lib/business-date";

export async function GET(req: Request) {
  try {
    const user = await requireAuth();
    const startOfDay = startOfBusinessDay(new Date());

    const entry = await prisma.attendanceEntry.findFirst({
      where: { userId: user.id, date: startOfDay },
    });

    const status = entry
      ? entry.checkOut
        ? "Checked-Out"
        : entry.checkIn
          ? "Checked-In"
          : "No Action"
      : "No Action";

    return NextResponse.json({ ok: true, status, entry });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Unauthorized" },
      { status: 401 },
    );
  }
}
