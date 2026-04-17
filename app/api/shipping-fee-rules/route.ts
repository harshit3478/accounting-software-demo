import { NextRequest, NextResponse } from "next/server";
import prisma from "../../../lib/prisma";
import { requireAuth, isSuperAdmin } from "../../../lib/auth";

function ensureAdminOrSuper(user: any) {
  if (user.role !== "admin" && !isSuperAdmin(user)) {
    throw new Error("Forbidden");
  }
}

export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get("active") === "true";

    const ruleModel = (prisma as any)?.shippingFeeRule;
    if (!ruleModel) {
      return NextResponse.json(
        {
          error:
            "ShippingFeeRule model is not available on Prisma client. Run migrations and regenerate Prisma client.",
        },
        { status: 500 },
      );
    }

    const where = activeOnly ? { isActive: true } : {};
    const rules = await ruleModel.findMany({
      where,
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json(
      rules.map((r: any) => ({
        ...r,
        minAmount: r.minAmount?.toNumber ? r.minAmount.toNumber() : r.minAmount,
        maxAmount: r.maxAmount?.toNumber ? r.maxAmount.toNumber() : r.maxAmount,
        fee: r.fee?.toNumber ? r.fee.toNumber() : r.fee,
      })),
    );
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    ensureAdminOrSuper(user);

    const { name, minAmount, maxAmount, fee, isActive, sortOrder } =
      await request.json();

    if (!name || !String(name).trim()) {
      throw new Error("Rule name is required");
    }

    const parsedFee = Number(fee);
    if (!Number.isFinite(parsedFee) || parsedFee < 0) {
      throw new Error("Valid fee is required");
    }

    const parsedMin =
      minAmount === "" || minAmount === null || minAmount === undefined
        ? null
        : Number(minAmount);
    const parsedMax =
      maxAmount === "" || maxAmount === null || maxAmount === undefined
        ? null
        : Number(maxAmount);

    if (parsedMin !== null && (!Number.isFinite(parsedMin) || parsedMin < 0)) {
      throw new Error("Invalid minimum amount");
    }
    if (parsedMax !== null && (!Number.isFinite(parsedMax) || parsedMax < 0)) {
      throw new Error("Invalid maximum amount");
    }
    if (
      parsedMin !== null &&
      parsedMax !== null &&
      Number(parsedMin) > Number(parsedMax)
    ) {
      throw new Error("Minimum amount cannot be greater than maximum amount");
    }

    const created = await (prisma as any).shippingFeeRule.create({
      data: {
        name: String(name).trim(),
        minAmount: parsedMin,
        maxAmount: parsedMax,
        fee: parsedFee,
        isActive: typeof isActive === "boolean" ? isActive : true,
        sortOrder: Number.isFinite(Number(sortOrder)) ? Number(sortOrder) : 0,
        createdBy: user.id,
      },
    });

    return NextResponse.json({
      ...created,
      minAmount: created.minAmount?.toNumber
        ? created.minAmount.toNumber()
        : created.minAmount,
      maxAmount: created.maxAmount?.toNumber
        ? created.maxAmount.toNumber()
        : created.maxAmount,
      fee: created.fee?.toNumber ? created.fee.toNumber() : created.fee,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await requireAuth();
    ensureAdminOrSuper(user);

    const { id, name, minAmount, maxAmount, fee, isActive, sortOrder } =
      await request.json();

    const ruleId = Number(id);
    if (!Number.isFinite(ruleId)) {
      throw new Error("Invalid rule id");
    }

    const data: any = {};

    if (name !== undefined) {
      if (!String(name).trim()) throw new Error("Rule name is required");
      data.name = String(name).trim();
    }

    if (fee !== undefined) {
      const parsedFee = Number(fee);
      if (!Number.isFinite(parsedFee) || parsedFee < 0) {
        throw new Error("Valid fee is required");
      }
      data.fee = parsedFee;
    }

    if (minAmount !== undefined) {
      data.minAmount =
        minAmount === "" || minAmount === null ? null : Number(minAmount);
      if (
        data.minAmount !== null &&
        (!Number.isFinite(data.minAmount) || data.minAmount < 0)
      ) {
        throw new Error("Invalid minimum amount");
      }
    }

    if (maxAmount !== undefined) {
      data.maxAmount =
        maxAmount === "" || maxAmount === null ? null : Number(maxAmount);
      if (
        data.maxAmount !== null &&
        (!Number.isFinite(data.maxAmount) || data.maxAmount < 0)
      ) {
        throw new Error("Invalid maximum amount");
      }
    }

    if (isActive !== undefined) {
      data.isActive = !!isActive;
    }

    if (sortOrder !== undefined) {
      const parsedSort = Number(sortOrder);
      data.sortOrder = Number.isFinite(parsedSort) ? parsedSort : 0;
    }

    const nextMin = data.minAmount;
    const nextMax = data.maxAmount;
    if (
      nextMin !== undefined &&
      nextMax !== undefined &&
      nextMin !== null &&
      nextMax !== null &&
      Number(nextMin) > Number(nextMax)
    ) {
      throw new Error("Minimum amount cannot be greater than maximum amount");
    }

    const updated = await (prisma as any).shippingFeeRule.update({
      where: { id: ruleId },
      data,
    });

    return NextResponse.json({
      ...updated,
      minAmount: updated.minAmount?.toNumber
        ? updated.minAmount.toNumber()
        : updated.minAmount,
      maxAmount: updated.maxAmount?.toNumber
        ? updated.maxAmount.toNumber()
        : updated.maxAmount,
      fee: updated.fee?.toNumber ? updated.fee.toNumber() : updated.fee,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAuth();
    ensureAdminOrSuper(user);

    const { id } = await request.json();
    const ruleId = Number(id);
    if (!Number.isFinite(ruleId)) {
      throw new Error("Invalid rule id");
    }

    await (prisma as any).shippingFeeRule.delete({ where: { id: ruleId } });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
