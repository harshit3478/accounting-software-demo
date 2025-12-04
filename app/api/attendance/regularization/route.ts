import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const user = await requireAuth();
    // Only staff or accountant can create regularization requests
    if (!(user.role === "staff" || user.role === "accountant")) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
      });
    }
    const body = await req.json();
    const { forDate, type, requestedCheckIn, requestedCheckOut, reason } = body;

    if (!forDate)
      return NextResponse.json(
        { error: "forDate is required" },
        { status: 400 }
      );

    const allowedTypes = ["checkin", "checkout", "both", "manual"];
    if (type && !allowedTypes.includes(type)) {
      return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }

    // Prevent creating a regularization if there is already an attendance entry
    // for that day with both checkIn and checkOut set.
    const day = new Date(forDate);
    day.setHours(0, 0, 0, 0);
    const nextDay = new Date(day);
    nextDay.setDate(nextDay.getDate() + 1);

    const existing = await prisma.attendanceEntry.findFirst({
      where: {
        userId: user.id,
        date: {
          gte: day,
          lt: nextDay,
        },
      },
    });

    if (existing && existing.checkIn && existing.checkOut) {
      return NextResponse.json(
        {
          error: "Attendance already has check-in and check-out for this date",
        },
        { status: 400 }
      );
    }

    // Helper to parse requested times. Accepts either full ISO datetime or time-only (HH:mm)
    function parseRequested(forDateStr: string, value: any) {
      if (!value) return undefined;
      // If value already looks like a date string with time or ISO, try Date parsing
      if (typeof value === "string") {
        // time-only like "13:30" -> combine with forDate
        const timeOnly = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(value);
        if (timeOnly) {
          // Combine with forDate (assume forDate is YYYY-MM-DD or Date string)
          const datePart = new Date(forDate).toISOString().slice(0, 10);
          const iso = `${datePart}T${timeOnly[1].padStart(2, "0")}:${
            timeOnly[2]
          }:00.000Z`;
          const d = new Date(iso);
          return isNaN(d.getTime()) ? null : d;
        }

        // otherwise try to parse as full datetime
        const d2 = new Date(value);
        return isNaN(d2.getTime()) ? null : d2;
      }

      // If value is a number (timestamp)
      if (typeof value === "number") {
        const d3 = new Date(value);
        return isNaN(d3.getTime()) ? null : d3;
      }

      return null;
    }

    const parsedCheckIn = parseRequested(forDate, requestedCheckIn);
    const parsedCheckOut = parseRequested(forDate, requestedCheckOut);

    if (requestedCheckIn && parsedCheckIn === null) {
      return NextResponse.json(
        { error: "Invalid requestedCheckIn" },
        { status: 400 }
      );
    }
    if (requestedCheckOut && parsedCheckOut === null) {
      return NextResponse.json(
        { error: "Invalid requestedCheckOut" },
        { status: 400 }
      );
    }

    const created = await prisma.regularizationRequest.create({
      data: {
        userId: user.id,
        forDate: new Date(forDate),
        type: type || "manual",
        requestedCheckIn: parsedCheckIn || undefined,
        requestedCheckOut: parsedCheckOut || undefined,
        reason: reason || undefined,
      },
    });

    return NextResponse.json({ ok: true, created });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Unauthorized" },
      { status: 401 }
    );
  }
}
