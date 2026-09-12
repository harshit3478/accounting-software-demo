import { NextRequest, NextResponse } from "next/server";
import prisma from "../../../lib/prisma";
import { requireAuth, isSuperAdmin } from "../../../lib/auth";
import {
  startOfBusinessDay,
  toBusinessDateStringFromInput,
} from "../../../lib/business-date";
import { getUnitDiscountSettings } from "../../../lib/unit-discount";
import {
  DISCOUNT_KIND_SHIPPING_CREDIT,
  DISCOUNT_KIND_UNIT_PERCENT,
  getDiscountKind,
  normalizeUnitKey,
  parseShippingThresholds,
  validateShippingThresholds,
  type DiscountKind,
} from "../../../lib/unit-discount-shared";

function periodsOverlap(
  startA: string,
  endA: string,
  startB: string,
  endB: string,
): boolean {
  return startA <= endB && startB <= endA;
}

function parseDiscountKind(value: unknown): DiscountKind {
  return value === DISCOUNT_KIND_SHIPPING_CREDIT
    ? DISCOUNT_KIND_SHIPPING_CREDIT
    : DISCOUNT_KIND_UNIT_PERCENT;
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

    const kind = parseDiscountKind(body?.kind);
    const name = String(body?.name || "").trim();
    const unitName = String(body?.unitName || "").trim();
    const periodStart = toBusinessDateStringFromInput(body?.periodStart || "");
    const periodEnd = toBusinessDateStringFromInput(body?.periodEnd || "");

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

    if (!unitName) {
      return NextResponse.json({ error: "Unit is required" }, { status: 400 });
    }

    const model = (prisma as any)?.unitDiscountSetting;
    if (!model) {
      return NextResponse.json(
        { error: "UnitDiscountSetting model is not available" },
        { status: 500 },
      );
    }

    const existing = await getUnitDiscountSettings({ activeOnly: true });

    if (kind === DISCOUNT_KIND_SHIPPING_CREDIT) {
      const thresholds = parseShippingThresholds(body?.thresholds);
      const thresholdError = validateShippingThresholds(thresholds);
      if (thresholdError) {
        return NextResponse.json({ error: thresholdError }, { status: 400 });
      }

      const overlapping = existing.find(
        (row) =>
          getDiscountKind(row) === DISCOUNT_KIND_SHIPPING_CREDIT &&
          normalizeUnitKey(row.unitName) === normalizeUnitKey(unitName) &&
          periodsOverlap(
            periodStart,
            periodEnd,
            row.periodStart,
            row.periodEnd,
          ),
      );
      if (overlapping) {
        return NextResponse.json(
          {
            error: `An active ${unitName} shipping promo already covers ${overlapping.periodStart} to ${overlapping.periodEnd}`,
          },
          { status: 400 },
        );
      }

      const row = await model.create({
        data: {
          kind,
          name,
          unitName,
          discountPercent: 0,
          periodStart: startOfBusinessDay(periodStart),
          periodEnd: startOfBusinessDay(periodEnd),
          isActive: true,
          liveTypeId: null,
          thresholds,
          createdBy: user.id,
        },
      });

      const created = (await getUnitDiscountSettings()).find(
        (setting) => setting.id === Number(row.id),
      );
      return NextResponse.json(created || serializeCreated(row, periodStart, periodEnd), {
        status: 201,
      });
    }

    const discountPercent = Number(body?.discountPercent);

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

    const unitKey = normalizeUnitKey(unitName);
    const overlapping = existing.find(
      (row) =>
        getDiscountKind(row) === DISCOUNT_KIND_UNIT_PERCENT &&
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
        kind: DISCOUNT_KIND_UNIT_PERCENT,
        name,
        unitName,
        discountPercent,
        periodStart: startOfBusinessDay(periodStart),
        periodEnd: startOfBusinessDay(periodEnd),
        isActive: true,
        liveTypeId: null,
        thresholds: null,
        createdBy: user.id,
      },
    });

    return NextResponse.json(
      {
        id: Number(row.id),
        kind: DISCOUNT_KIND_UNIT_PERCENT,
        name,
        unitName: row.unitName,
        discountPercent: Number(
          row.discountPercent?.toNumber?.() ?? row.discountPercent,
        ),
        periodStart,
        periodEnd,
        isActive: !!row.isActive,
        liveTypeId: null,
        thresholds: [],
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

function serializeCreated(
  row: any,
  periodStart: string,
  periodEnd: string,
) {
  return {
    id: Number(row.id),
    kind: parseDiscountKind(row.kind),
    name: String(row.name || ""),
    unitName: String(row.unitName || ""),
    discountPercent: Number(
      row.discountPercent?.toNumber?.() ?? row.discountPercent ?? 0,
    ),
    periodStart,
    periodEnd,
    isActive: !!row.isActive,
    liveTypeId: row.liveTypeId == null ? null : Number(row.liveTypeId),
    thresholds: parseShippingThresholds(row.thresholds),
  };
}
