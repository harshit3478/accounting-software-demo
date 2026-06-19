import { NextRequest, NextResponse } from "next/server";
import prisma from "../../../lib/prisma";
import { requireAuth, requireSettingPermission } from "../../../lib/auth";
import { getDueReminderSettingSnapshot } from "../../../lib/due-reminders";

export async function GET() {
  try {
    await requireAuth();
    const setting = await getDueReminderSettingSnapshot();
    return NextResponse.json(setting);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireSettingPermission("due-reminders");

    const body = await request.json();
    const daysAfterDueDate = Number(body?.daysAfterDueDate ?? 1);
    const daysBetweenReminders = Number(body?.daysBetweenReminders ?? 7);
    const isActive = body?.isActive !== undefined ? !!body.isActive : true;

    if (!Number.isFinite(daysAfterDueDate) || daysAfterDueDate < 0) {
      return NextResponse.json(
        { error: "Days after due date must be a valid non-negative number" },
        { status: 400 },
      );
    }

    if (!Number.isFinite(daysBetweenReminders) || daysBetweenReminders < 1) {
      return NextResponse.json(
        { error: "Days between reminders must be at least 1" },
        { status: 400 },
      );
    }

    const model = (prisma as any)?.dueReminderSetting;
    if (!model) {
      return NextResponse.json(
        { error: "DueReminderSetting model is not available" },
        { status: 500 },
      );
    }

    await model.deleteMany({});
    const row = await model.create({
      data: {
        daysAfterDueDate: Math.trunc(daysAfterDueDate),
        daysBetweenReminders: Math.trunc(daysBetweenReminders),
        isActive,
      },
    });

    return NextResponse.json({
      daysAfterDueDate: Number(row.daysAfterDueDate ?? 1),
      daysBetweenReminders: Number(row.daysBetweenReminders ?? 7),
      isActive: !!row.isActive,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
