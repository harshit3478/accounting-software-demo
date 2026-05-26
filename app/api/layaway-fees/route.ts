import { NextRequest, NextResponse } from "next/server";
import prisma from "../../../lib/prisma";
import { isSuperAdmin, requireAuth } from "../../../lib/auth";
import {
  DEFAULT_LAYAWAY_FEE_RATES,
  flattenLayawayFeeConfigs,
  groupLayawayFeeRatesByUnit,
  normalizeLayawayFeeRates,
} from "../../../lib/layaway-fees";

function ensureAdminOrSuper(user: any) {
  if (user.role !== "admin" && !isSuperAdmin(user)) {
    throw new Error("Forbidden");
  }
}

async function ensureDefaultLayawayRates() {
  const rateModel = (prisma as any)?.layawayFeeSetting;
  if (!rateModel) {
    return DEFAULT_LAYAWAY_FEE_RATES.map((rate) => ({
      ...rate,
      unitName: "grams",
    }));
  }

  const existing = await rateModel.findMany({
    orderBy: [{ unitName: "asc" }, { sortOrder: "asc" }, { months: "asc" }],
  });

  if (!existing || existing.length === 0) {
    for (const rate of DEFAULT_LAYAWAY_FEE_RATES) {
      await rateModel.upsert({
        where: {
          unitName_months: {
            unitName: "grams",
            months: rate.months,
          },
        },
        update: {
          unitName: "grams",
          ratePerGram: rate.ratePerGram,
          isActive: true,
          sortOrder: rate.months,
        },
        create: {
          unitName: "grams",
          months: rate.months,
          ratePerGram: rate.ratePerGram,
          isActive: true,
          sortOrder: rate.months,
        },
      });
    }

    return DEFAULT_LAYAWAY_FEE_RATES.map((rate) => ({
      ...rate,
      unitName: "grams",
    }));
  }

  return normalizeLayawayFeeRates(existing);
}

export async function GET() {
  try {
    await requireAuth();
    const rateModel = (prisma as any)?.layawayFeeSetting;
    if (!rateModel) {
      return NextResponse.json(DEFAULT_LAYAWAY_FEE_RATES);
    }

    const rates = await ensureDefaultLayawayRates();

    return NextResponse.json(
      rates.map((rate) => ({
        unitName: rate.unitName || "grams",
        months: rate.months,
        ratePerGram: rate.ratePerGram,
        isActive: rate.isActive ?? true,
        sortOrder: rate.sortOrder ?? rate.months,
      })),
    );
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await requireAuth();
    ensureAdminOrSuper(user);

    const body = await request.json();
    const ratesInput = Array.isArray(body?.rates) ? body.rates : [];
    const normalizedRates = normalizeLayawayFeeRates(ratesInput);
    const groupedByUnit = groupLayawayFeeRatesByUnit(normalizedRates);

    if (
      groupedByUnit.length === 0 ||
      groupedByUnit.some(
        (config) => config.rates.length !== DEFAULT_LAYAWAY_FEE_RATES.length,
      )
    ) {
      return NextResponse.json(
        { error: "Each unit must have exactly 6 layaway fee rates" },
        { status: 400 },
      );
    }

    const rateModel = (prisma as any)?.layawayFeeSetting;
    if (!rateModel) {
      return NextResponse.json(
        { error: "LayawayFeeSetting model is not available" },
        { status: 500 },
      );
    }

    await rateModel.deleteMany({});

    const flattenedRates = flattenLayawayFeeConfigs(groupedByUnit);
    await rateModel.createMany({
      data: flattenedRates.map((rate, index) => ({
        unitName: rate.unitName || "grams",
        months: rate.months,
        ratePerGram: rate.ratePerGram,
        isActive: rate.isActive ?? true,
        sortOrder: rate.sortOrder ?? index + 1,
      })),
    });

    const updatedRates = await rateModel.findMany({
      orderBy: [{ unitName: "asc" }, { sortOrder: "asc" }, { months: "asc" }],
    });

    return NextResponse.json(
      updatedRates
        .map((rate) => ({
          unitName: rate.unitName || "grams",
          months: rate.months,
          ratePerGram: rate.ratePerGram?.toNumber
            ? rate.ratePerGram.toNumber()
            : Number(rate.ratePerGram),
          isActive: rate.isActive,
          sortOrder: rate.sortOrder,
        }))
        .sort((left, right) => left.months - right.months),
    );
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
