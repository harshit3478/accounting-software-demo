import { NextResponse } from "next/server";
import prisma from "../../../../lib/prisma";
import { requireAuth } from "../../../../lib/auth";
import {
  endOfBusinessDay,
  startOfBusinessDay,
} from "../../../../lib/business-date";

export async function GET(req: Request) {
  try {
    const user = await requireAuth();
    const url = new URL(req.url);
    const startDate = url.searchParams.get("startDate");
    const endDate = url.searchParams.get("endDate");

    const whereClause: any = { userId: user.id };

    // Apply date filtering if provided
    if (startDate && endDate) {
      whereClause.date = {
        gte: startOfBusinessDay(startDate),
        lte: endOfBusinessDay(endDate),
      };
    } else {
      const threeMonthsAgo = new Date(startOfBusinessDay(new Date()));
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

      whereClause.date = {
        gte: startOfBusinessDay(threeMonthsAgo),
      };
    }

    const entries = await prisma.attendanceEntry.findMany({
      where: whereClause,
      orderBy: { date: "desc" },
    });

    return NextResponse.json({
      ok: true,
      data: {
        entries,
        employeeName: user.name || "Employee",
        employeeEmail: user.email || "",
        dateRange:
          startDate && endDate ? { start: startDate, end: endDate } : null,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Unauthorized" },
      { status: 401 },
    );
  }
}
