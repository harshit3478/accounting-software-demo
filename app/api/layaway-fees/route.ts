import { NextRequest, NextResponse } from "next/server";
import prisma from "../../../lib/prisma";
import { isSuperAdmin, requireAuth } from "../../../lib/auth";
import {
  DEFAULT_LAYAWAY_FEE_RATES,
  normalizeLayawayFeeRates,
} from "../../../lib/layaway-fees";

function ensureAdminOrSuper(user: any) {
  if (user.role !== "admin" && !isSuperAdmin(user)) {
    throw new Error("Forbidden");
  }
}

async function ensureDefaultLayawayRates() {
  const rateModel = (prisma as any)?.layawayFeeSetting;
  if (!rateModel) return DEFAULT_LAYAWAY_FEE_RATES;

  const existing = await rateModel.findMany({
    orderBy: [{ sortOrder: "asc" }, { months: "asc" }],
  });

  if (!existing || existing.length === 0) {
    for (const rate of DEFAULT_LAYAWAY_FEE_RATES) {
      await rateModel.upsert({
        where: { months: rate.months },
        update: {
          ratePerGram: rate.ratePerGram,
          isActive: true,
          sortOrder: rate.months,
        },
        create: {
          months: rate.months,
          ratePerGram: rate.ratePerGram,
          isActive: true,
          sortOrder: rate.months,
        },
      });
    }

    return DEFAULT_LAYAWAY_FEE_RATES;
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

    if (normalizedRates.length !== DEFAULT_LAYAWAY_FEE_RATES.length) {
      return NextResponse.json(
        { error: "Exactly 6 layaway fee rates are required" },
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

    const updatedRates = [] as any[];
    for (const rate of normalizedRates) {
      const updated = await rateModel.upsert({
        where: { months: rate.months },
        update: {
          ratePerGram: rate.ratePerGram,
          isActive: rate.isActive ?? true,
          sortOrder: rate.sortOrder ?? rate.months,
        },
        create: {
          months: rate.months,
          ratePerGram: rate.ratePerGram,
          isActive: rate.isActive ?? true,
          sortOrder: rate.sortOrder ?? rate.months,
        },
      });
      updatedRates.push(updated);
    }

    return NextResponse.json(
      updatedRates
        .map((rate) => ({
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
