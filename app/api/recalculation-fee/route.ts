import { NextRequest, NextResponse } from "next/server";
import prisma from "../../../lib/prisma";
import { requireAuth, requireSettingPermission } from "../../../lib/auth";

export async function GET() {
  try {
    await requireAuth();
    const rateModel = (prisma as any)?.recalculationFeeSetting;
    if (!rateModel) {
      return NextResponse.json({ amount: 0, ratePercent: 0, isActive: false });
    }

    const row = await rateModel.findFirst({ orderBy: { updatedAt: "desc" } });
    return NextResponse.json(
      row
        ? {
            id: row.id,
            amount: Number(row.ratePercent ?? 0),
            ratePercent: Number(row.ratePercent ?? 0),
            isActive: !!row.isActive,
          }
        : { amount: 0, ratePercent: 0, isActive: false },
    );
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireSettingPermission("recalculation-fee");

    const body = await request.json();
    const amount = Number(body?.amount ?? body?.ratePercent ?? 0);
    const isActive =
      body?.isActive !== undefined ? !!body.isActive : amount > 0;

    if (!Number.isFinite(amount) || amount < 0) {
      return NextResponse.json(
        {
          error: "Recalculation fee amount must be a valid non-negative number",
        },
        { status: 400 },
      );
    }

    const rateModel = (prisma as any)?.recalculationFeeSetting;
    if (!rateModel) {
      return NextResponse.json(
        { error: "RecalculationFeeSetting model is not available" },
        { status: 500 },
      );
    }

    await rateModel.deleteMany({});
    const row = await rateModel.create({
      data: {
        ratePercent: amount,
        isActive,
      },
    });

    return NextResponse.json({
      id: row.id,
      amount: Number(row.ratePercent ?? 0),
      ratePercent: Number(row.ratePercent ?? 0),
      isActive: row.isActive,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
