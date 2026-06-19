import { NextRequest, NextResponse } from "next/server";
import { requireSettingPermission } from "../../../../lib/auth";
import { processDueReminderEmails } from "../../../../lib/due-reminders";

export async function POST() {
  try {
    await requireSettingPermission("due-reminders");
    const result = await processDueReminderEmails();
    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    console.error("Manual due reminder run error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process due reminders" },
      { status: 500 },
    );
  }
}
