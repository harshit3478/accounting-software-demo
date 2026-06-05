import { NextRequest, NextResponse } from "next/server";
import prisma from "../../../lib/prisma";
import { requireAuth, isSuperAdmin } from "../../../lib/auth";

function ensureAdminOrSuper(user: any) {
  if (user.role !== "admin" && !isSuperAdmin(user)) {
    throw new Error("Forbidden");
  }
}

function serializeRule(rule: any) {
  return {
    ...rule,
    unitName: rule.unitName,
    minUnit: rule.minUnit?.toNumber ? rule.minUnit.toNumber() : rule.minUnit,
    maxUnit: rule.maxUnit?.toNumber ? rule.maxUnit.toNumber() : rule.maxUnit,
    fee: rule.fee?.toNumber ? rule.fee.toNumber() : rule.fee,
  };
}

function parseOptionalUnit(value: unknown) {
  return value === "" || value === null || value === undefined
    ? null
    : Number(value);
}

function validateUnitRange(minUnit: number | null, maxUnit: number | null) {
  if (minUnit !== null && (!Number.isFinite(minUnit) || minUnit < 0)) {
    throw new Error("Invalid minimum unit");
  }
  if (maxUnit !== null && (!Number.isFinite(maxUnit) || maxUnit < 0)) {
    throw new Error("Invalid maximum unit");
  }
  if (
    minUnit !== null &&
    maxUnit !== null &&
    Number(minUnit) > Number(maxUnit)
  ) {
    throw new Error("Minimum unit cannot be greater than maximum unit");
  }
}

export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get("active") === "true";

    const ruleModel = (prisma as any)?.depositFeeRule;
    if (!ruleModel) {
      return NextResponse.json(
        {
          error:
            "DepositFeeRule model is not available on Prisma client. Run migrations and regenerate Prisma client.",
        },
        { status: 500 },
      );
    }

    const where = activeOnly ? { isActive: true } : {};
    const rules = await ruleModel.findMany({
      where,
      orderBy: [{ sortOrder: "asc" }, { unitName: "asc" }, { createdAt: "desc" }],
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

    return NextResponse.json(rules.map(serializeRule));
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    ensureAdminOrSuper(user);

    const { name, unitName, minUnit, maxUnit, fee, isActive, sortOrder } =
      await request.json();

    if (!name || !String(name).trim()) {
      throw new Error("Rule name is required");
    }

    const parsedUnitName = String(unitName || "").trim();
    if (!parsedUnitName) {
      throw new Error("Unit is required");
    }

    const parsedFee = Number(fee);
    if (!Number.isFinite(parsedFee) || parsedFee < 0) {
      throw new Error("Valid fee is required");
    }

    const parsedMin = parseOptionalUnit(minUnit);
    const parsedMax = parseOptionalUnit(maxUnit);
    validateUnitRange(parsedMin, parsedMax);

    const created = await (prisma as any).depositFeeRule.create({
      data: {
        name: String(name).trim(),
        unitName: parsedUnitName,
        minUnit: parsedMin,
        maxUnit: parsedMax,
        fee: parsedFee,
        isActive: typeof isActive === "boolean" ? isActive : true,
        sortOrder: Number.isFinite(Number(sortOrder)) ? Number(sortOrder) : 0,
        createdBy: user.id,
      },
    });

    return NextResponse.json(serializeRule(created));
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await requireAuth();
    ensureAdminOrSuper(user);

    const { id, name, unitName, minUnit, maxUnit, fee, isActive, sortOrder } =
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

    if (unitName !== undefined) {
      const parsedUnitName = String(unitName || "").trim();
      if (!parsedUnitName) throw new Error("Unit is required");
      data.unitName = parsedUnitName;
    }

    if (fee !== undefined) {
      const parsedFee = Number(fee);
      if (!Number.isFinite(parsedFee) || parsedFee < 0) {
        throw new Error("Valid fee is required");
      }
      data.fee = parsedFee;
    }

    if (minUnit !== undefined) {
      data.minUnit = parseOptionalUnit(minUnit);
      if (
        data.minUnit !== null &&
        (!Number.isFinite(data.minUnit) || data.minUnit < 0)
      ) {
        throw new Error("Invalid minimum unit");
      }
    }

    if (maxUnit !== undefined) {
      data.maxUnit = parseOptionalUnit(maxUnit);
      if (
        data.maxUnit !== null &&
        (!Number.isFinite(data.maxUnit) || data.maxUnit < 0)
      ) {
        throw new Error("Invalid maximum unit");
      }
    }

    if (isActive !== undefined) {
      data.isActive = !!isActive;
    }

    if (sortOrder !== undefined) {
      const parsedSort = Number(sortOrder);
      data.sortOrder = Number.isFinite(parsedSort) ? parsedSort : 0;
    }

    const nextMin = data.minUnit;
    const nextMax = data.maxUnit;
    if (
      nextMin !== undefined &&
      nextMax !== undefined &&
      nextMin !== null &&
      nextMax !== null &&
      Number(nextMin) > Number(nextMax)
    ) {
      throw new Error("Minimum unit cannot be greater than maximum unit");
    }

    const updated = await (prisma as any).depositFeeRule.update({
      where: { id: ruleId },
      data,
    });

    return NextResponse.json(serializeRule(updated));
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

    await (prisma as any).depositFeeRule.delete({ where: { id: ruleId } });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
