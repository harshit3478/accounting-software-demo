import { NextRequest, NextResponse } from "next/server";
import prisma from "../../../lib/prisma";
import { requireAuth, isSuperAdmin } from "../../../lib/auth";
import {
  startOfBusinessDay,
  toBusinessDateStringFromInput,
} from "../../../lib/business-date";
import { getUnitDiscountSettings } from "../../../lib/unit-discount";
import { normalizeUnitKey } from "../../../lib/unit-discount-shared";

function periodsOverlap(
  startA: string,
  endA: string,
  startB: string,
  endB: string,
): boolean {
  return startA <= endB && startB <= endA;
}

export async function GET() {
  try {
    await requireAuth();
    const settings = await getUnitDiscountSettings();
    return NextResponse.json(settings);
  } catch (error: any) {
    const status = error.message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    if (user.role !== "admin" && !isSuperAdmin(user)) {
      throw new Error("Forbidden");
    }
    const body = await request.json();

    const unitName = String(body?.unitName || "").trim();
    const discountPercent = Number(body?.discountPercent);
    const periodStart = toBusinessDateStringFromInput(body?.periodStart || "");
    const periodEnd = toBusinessDateStringFromInput(body?.periodEnd || "");

    if (!unitName) {
      return NextResponse.json(
        { error: "Unit is required" },
        { status: 400 },
      );
    }

    if (!Number.isFinite(discountPercent) || discountPercent <= 0) {
      return NextResponse.json(
        { error: "Discount percent must be greater than 0" },
        { status: 400 },
      );
    }

    if (discountPercent > 100) {
      return NextResponse.json(
        { error: "Discount percent cannot exceed 100" },
        { status: 400 },
      );
    }

    if (!periodStart || !periodEnd) {
      return NextResponse.json(
        { error: "Invoice date period is required" },
        { status: 400 },
      );
    }

    if (periodStart > periodEnd) {
      return NextResponse.json(
        { error: "Period start cannot be after period end" },
        { status: 400 },
      );
    }

    const model = (prisma as any)?.unitDiscountSetting;
    if (!model) {
      return NextResponse.json(
        { error: "UnitDiscountSetting model is not available" },
        { status: 500 },
      );
    }

    const existing = await getUnitDiscountSettings({ activeOnly: true });
    const unitKey = normalizeUnitKey(unitName);
    const overlapping = existing.find(
      (row) =>
        normalizeUnitKey(row.unitName) === unitKey &&
        periodsOverlap(periodStart, periodEnd, row.periodStart, row.periodEnd),
    );
    if (overlapping) {
      return NextResponse.json(
        {
          error: `An active ${unitName} discount already covers ${overlapping.periodStart} to ${overlapping.periodEnd}`,
        },
        { status: 400 },
      );
    }

    const row = await model.create({
      data: {
        unitName,
        discountPercent,
        periodStart: startOfBusinessDay(periodStart),
        periodEnd: startOfBusinessDay(periodEnd),
        isActive: true,
        createdBy: user.id,
      },
    });

    return NextResponse.json(
      {
        id: Number(row.id),
        unitName: row.unitName,
        discountPercent: Number(
          row.discountPercent?.toNumber?.() ?? row.discountPercent,
        ),
        periodStart,
        periodEnd,
        isActive: !!row.isActive,
      },
      { status: 201 },
    );
  } catch (error: any) {
    const status =
      error.message === "Unauthorized"
        ? 401
        : error.message === "Forbidden"
          ? 403
          : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
}
