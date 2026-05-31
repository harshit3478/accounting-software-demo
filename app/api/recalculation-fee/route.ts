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
    const rateModel = (prisma as any)?.recalculationFeeSetting;
    if (!rateModel) {
      return NextResponse.json({ ratePercent: 0, isActive: false });
    }

    const row = await rateModel.findFirst({ orderBy: { updatedAt: "desc" } });
    return NextResponse.json(
      row
        ? {
            id: row.id,
            ratePercent: Number(row.ratePercent ?? 0),
            isActive: !!row.isActive,
          }
        : { ratePercent: 0, isActive: false },
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
    const ratePercent = Number(body?.ratePercent ?? 0);
    const isActive =
      body?.isActive !== undefined ? !!body.isActive : ratePercent > 0;

    if (!Number.isFinite(ratePercent) || ratePercent < 0) {
      return NextResponse.json(
        {
          error: "Recalculation fee rate must be a valid non-negative number",
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
        ratePercent,
        isActive,
      },
    });

    return NextResponse.json({
      id: row.id,
      ratePercent: Number(row.ratePercent ?? 0),
      isActive: row.isActive,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
