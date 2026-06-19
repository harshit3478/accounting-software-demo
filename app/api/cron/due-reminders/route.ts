import { NextRequest, NextResponse } from "next/server";
import { processDueReminderEmails } from "../../../../lib/due-reminders";

function isAuthorizedCron(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return false;
  }

  const authHeader = request.headers.get("authorization");
  return authHeader === `Bearer ${cronSecret}`;
}

export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await processDueReminderEmails();
    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    console.error("Cron due reminder error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process due reminders" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
