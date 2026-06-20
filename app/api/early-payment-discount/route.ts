import { NextRequest, NextResponse } from "next/server";
import prisma from "../../../lib/prisma";
import { requireAuth, requireSettingPermission } from "../../../lib/auth";
import {
  EarlyPaymentThreshold,
  getEarlyPaymentDiscountSettingSnapshot,
} from "../../../lib/early-payment-discount";

export async function GET() {
  try {
    await requireAuth();
    const setting = await getEarlyPaymentDiscountSettingSnapshot();
    return NextResponse.json(setting);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireSettingPermission("early-payment-discount");

    const body = await request.json();
    const daysWindow = Number(body?.daysWindow ?? 0);
    const discountPercent = Number(body?.discountPercent ?? 0);
    const paymentThreshold: EarlyPaymentThreshold =
      body?.paymentThreshold === "half" ? "half" : "full";
    const isActive =
      body?.isActive !== undefined
        ? !!body.isActive
        : daysWindow > 0 && discountPercent > 0;

    if (!Number.isFinite(daysWindow) || daysWindow < 0) {
      return NextResponse.json(
        { error: "Days window must be a valid non-negative number" },
        { status: 400 },
      );
    }

    if (!Number.isFinite(discountPercent) || discountPercent < 0) {
      return NextResponse.json(
        { error: "Discount percent must be a valid non-negative number" },
        { status: 400 },
      );
    }

    if (discountPercent > 100) {
      return NextResponse.json(
        { error: "Discount percent cannot exceed 100" },
        { status: 400 },
      );
    }

    const model = (prisma as any)?.earlyPaymentDiscountSetting;
    if (!model) {
      return NextResponse.json(
        { error: "EarlyPaymentDiscountSetting model is not available" },
        { status: 500 },
      );
    }

    await model.deleteMany({});
    const row = await model.create({
      data: {
        daysWindow: Math.trunc(daysWindow),
        discountPercent,
        paymentThreshold,
        isActive,
      },
    });

    return NextResponse.json({
      daysWindow: Number(row.daysWindow ?? 0),
      discountPercent: Number(row.discountPercent ?? 0),
      paymentThreshold:
        row.paymentThreshold === "half" ? "half" : ("full" as const),
      isActive: !!row.isActive,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
