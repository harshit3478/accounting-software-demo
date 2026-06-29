import { NextResponse } from "next/server";
import prisma from "../../../../../lib/prisma";
import { requireAdmin } from "../../../../../lib/auth";
import {
  endOfBusinessDay,
  startOfBusinessDay,
} from "../../../../../lib/business-date";

export async function GET(req: Request) {
  try {
    await requireAdmin();
    const url = new URL(req.url);
    const userId = url.searchParams.get("userId");
    const startDate = url.searchParams.get("startDate");
    const endDate = url.searchParams.get("endDate");

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 },
      );
    }

    // Fetch target user to get name/email
    const targetUser = await prisma.user.findUnique({
      where: { id: parseInt(userId) },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const whereClause: any = { userId: parseInt(userId) };

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
        employeeName: targetUser.name || "Employee",
        employeeEmail: targetUser.email || "",
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
