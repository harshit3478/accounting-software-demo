import { NextRequest, NextResponse } from "next/server";
import prisma from "../../../lib/prisma";
import { isSuperAdmin, requireAuth } from "../../../lib/auth";

function ensureAdmin(user: any) {
  if (user.role !== "admin" && !isSuperAdmin(user)) {
    throw new Error("Forbidden");
  }
}

export async function GET() {
  try {
    await requireAuth();

    const rateModel = (prisma as any)?.restockingFeeSetting;
    if (!rateModel) {
      return NextResponse.json({
        amount: 0,
        isPercentage: false,
        isActive: false,
      });
    }

    const row = await rateModel.findFirst({ orderBy: { updatedAt: "desc" } });
    return NextResponse.json(
      row
        ? {
            id: row.id,
            amount: Number(row.amount ?? 0),
            isPercentage: !!row.isPercentage,
            isActive: !!row.isActive,
          }
        : { amount: 0, isPercentage: false, isActive: false },
    );
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await requireAuth();
    ensureAdmin(user);

    const body = await request.json();
    const amount = Number(body?.amount ?? 0);
    const isPercentage = !!body?.isPercentage;
    const isActive =
      body?.isActive !== undefined ? !!body.isActive : amount > 0;

    if (!Number.isFinite(amount) || amount < 0) {
      return NextResponse.json(
        { error: "Restocking fee must be a valid non-negative number" },
        { status: 400 },
      );
    }

    const rateModel = (prisma as any)?.restockingFeeSetting;
    if (!rateModel) {
      return NextResponse.json(
        { error: "RestockingFeeSetting model is not available" },
        { status: 500 },
      );
    }

    await rateModel.deleteMany({});
    const row = await rateModel.create({
      data: {
        amount,
        isPercentage,
        isActive,
      },
    });

    return NextResponse.json({
      id: row.id,
      amount: Number(row.amount ?? 0),
      isPercentage: row.isPercentage,
      isActive: row.isActive,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
