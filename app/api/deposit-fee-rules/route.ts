import { NextRequest, NextResponse } from "next/server";
import prisma from "../../../lib/prisma";
import { requireAuth, requireSettingPermission } from "../../../lib/auth";
import type { DepositFeeRuleType } from "../../../lib/deposit-fees";

function serializeRule(rule: any) {
  return {
    ...rule,
    unitName: rule.unitName,
    ruleType: rule.ruleType || "range",
    minUnit: rule.minUnit?.toNumber ? rule.minUnit.toNumber() : rule.minUnit,
    maxUnit: rule.maxUnit?.toNumber ? rule.maxUnit.toNumber() : rule.maxUnit,
    fee: rule.fee?.toNumber ? rule.fee.toNumber() : rule.fee,
    isPercentage: !!rule.isPercentage,
  };
}

function parseOptionalUnit(value: unknown) {
  return value === "" || value === null || value === undefined
    ? null
    : Number(value);
}

function normalizeRuleType(value: unknown): DepositFeeRuleType {
  return value === "flat" ? "flat" : "range";
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

function normalizeUnitKey(unitName: string) {
  return String(unitName || "").trim().toLowerCase();
}

async function getRulesForUnit(ruleModel: any, unitName: string, excludeId?: number) {
  const unitKey = normalizeUnitKey(unitName);
  const rules = await ruleModel.findMany({
    select: { id: true, unitName: true, ruleType: true, isActive: true },
  });

  return rules.filter(
    (rule: any) =>
      normalizeUnitKey(rule.unitName) === unitKey &&
      (excludeId == null || rule.id !== excludeId),
  );
}

async function deactivateRangeRulesForUnit(
  ruleModel: any,
  unitName: string,
  excludeId?: number,
) {
  const sameUnitRules = await getRulesForUnit(ruleModel, unitName, excludeId);
  const rangeRuleIds = sameUnitRules
    .filter((rule: any) => normalizeRuleType(rule.ruleType) !== "flat")
    .map((rule: any) => rule.id);

  if (rangeRuleIds.length === 0) return;

  await ruleModel.updateMany({
    where: { id: { in: rangeRuleIds } },
    data: { isActive: false },
  });
}

async function deactivateFlatRulesForUnit(
  ruleModel: any,
  unitName: string,
  excludeId?: number,
) {
  const sameUnitRules = await getRulesForUnit(ruleModel, unitName, excludeId);
  const flatRuleIds = sameUnitRules
    .filter((rule: any) => normalizeRuleType(rule.ruleType) === "flat")
    .map((rule: any) => rule.id);

  if (flatRuleIds.length === 0) return;

  await ruleModel.updateMany({
    where: { id: { in: flatRuleIds } },
    data: { isActive: false },
  });
}

async function activateRangeRulesForUnit(
  ruleModel: any,
  unitName: string,
  excludeId?: number,
) {
  const sameUnitRules = await getRulesForUnit(ruleModel, unitName, excludeId);
  const rangeRuleIds = sameUnitRules
    .filter((rule: any) => normalizeRuleType(rule.ruleType) !== "flat")
    .map((rule: any) => rule.id);

  if (rangeRuleIds.length === 0) return;

  await ruleModel.updateMany({
    where: { id: { in: rangeRuleIds } },
    data: { isActive: true },
  });
}

async function validateRuleCompatibility(
  ruleModel: any,
  {
    unitName,
    ruleType,
    excludeId,
    replaceConflictingRules,
    willBeActive = true,
  }: {
    unitName: string;
    ruleType: DepositFeeRuleType;
    excludeId?: number;
    replaceConflictingRules?: boolean;
    willBeActive?: boolean;
  },
) {
  if (replaceConflictingRules) return;

  const sameUnitRules = await getRulesForUnit(ruleModel, unitName, excludeId);

  if (sameUnitRules.length === 0) return;

  const hasFlatRule = sameUnitRules.some(
    (rule: any) => normalizeRuleType(rule.ruleType) === "flat",
  );
  const hasActiveFlatRule = sameUnitRules.some(
    (rule: any) =>
      normalizeRuleType(rule.ruleType) === "flat" && !!rule.isActive,
  );
  const hasActiveRangeRules = sameUnitRules.some(
    (rule: any) =>
      normalizeRuleType(rule.ruleType) !== "flat" && !!rule.isActive,
  );

  if (ruleType === "flat" && hasFlatRule) {
    throw new Error(
      "Only one flat deposit fee rule is allowed per unit. Edit the existing flat rule instead.",
    );
  }

  if (ruleType === "flat" && hasActiveRangeRules && willBeActive) {
    throw new Error(
      "Active range rules exist for this unit. Confirm switching to a flat rule to disable them.",
    );
  }

  if (ruleType === "range" && hasActiveFlatRule && willBeActive) {
    throw new Error(
      "An active flat deposit fee rule exists for this unit. Confirm switching to range rules to disable it.",
    );
  }
}

function validateFlatRuleFields({
  ruleType,
  minUnit,
  maxUnit,
  isPercentage,
}: {
  ruleType: DepositFeeRuleType;
  minUnit: number | null;
  maxUnit: number | null;
  isPercentage: boolean;
}) {
  if (ruleType !== "flat") {
    return {
      minUnit,
      maxUnit,
      isPercentage: false,
    };
  }

  if (minUnit !== null || maxUnit !== null) {
    throw new Error("Flat deposit fee rules cannot use minimum or maximum units");
  }

  return {
    minUnit: null,
    maxUnit: null,
    isPercentage,
  };
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
    const user = await requireSettingPermission("deposit-fees");

    const {
      name,
      unitName,
      ruleType,
      minUnit,
      maxUnit,
      fee,
      isPercentage,
      isActive,
      sortOrder,
      replaceConflictingRules,
    } = await request.json();

    if (!name || !String(name).trim()) {
      throw new Error("Rule name is required");
    }

    const parsedUnitName = String(unitName || "").trim();
    if (!parsedUnitName) {
      throw new Error("Unit is required");
    }

    const parsedRuleType = normalizeRuleType(ruleType);
    const parsedFee = Number(fee);
    if (!Number.isFinite(parsedFee) || parsedFee < 0) {
      throw new Error("Valid fee is required");
    }

    const parsedMin = parseOptionalUnit(minUnit);
    const parsedMax = parseOptionalUnit(maxUnit);
    validateUnitRange(parsedMin, parsedMax);

    const flatFields = validateFlatRuleFields({
      ruleType: parsedRuleType,
      minUnit: parsedMin,
      maxUnit: parsedMax,
      isPercentage: !!isPercentage,
    });

    const ruleModel = (prisma as any)?.depositFeeRule;
    const willBeActive = typeof isActive === "boolean" ? isActive : true;

    await validateRuleCompatibility(ruleModel, {
      unitName: parsedUnitName,
      ruleType: parsedRuleType,
      replaceConflictingRules: !!replaceConflictingRules,
      willBeActive,
    });

    const created = await prisma.$transaction(async (tx) => {
      const model = (tx as any).depositFeeRule;

      if (parsedRuleType === "flat" && willBeActive && replaceConflictingRules) {
        await deactivateRangeRulesForUnit(model, parsedUnitName);
      }

      if (parsedRuleType === "range" && replaceConflictingRules) {
        await deactivateFlatRulesForUnit(model, parsedUnitName);
        await activateRangeRulesForUnit(model, parsedUnitName);
      }

      return model.create({
        data: {
          name: String(name).trim(),
          unitName: parsedUnitName,
          ruleType: parsedRuleType,
          minUnit: flatFields.minUnit,
          maxUnit: flatFields.maxUnit,
          fee: parsedFee,
          isPercentage: flatFields.isPercentage,
          isActive: willBeActive,
          sortOrder: Number.isFinite(Number(sortOrder)) ? Number(sortOrder) : 0,
          createdBy: user.id,
        },
      });
    });

    return NextResponse.json(serializeRule(created));
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireSettingPermission("deposit-fees");

    const {
      id,
      name,
      unitName,
      ruleType,
      minUnit,
      maxUnit,
      fee,
      isPercentage,
      isActive,
      sortOrder,
      replaceConflictingRules,
    } = await request.json();

    const ruleId = Number(id);
    if (!Number.isFinite(ruleId)) {
      throw new Error("Invalid rule id");
    }

    const ruleModel = (prisma as any)?.depositFeeRule;
    const existing = await ruleModel.findUnique({ where: { id: ruleId } });
    if (!existing) {
      throw new Error("Rule not found");
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

    if (ruleType !== undefined) {
      data.ruleType = normalizeRuleType(ruleType);
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

    if (isPercentage !== undefined) {
      data.isPercentage = !!isPercentage;
    }

    if (isActive !== undefined) {
      data.isActive = !!isActive;
    }

    if (sortOrder !== undefined) {
      const parsedSort = Number(sortOrder);
      data.sortOrder = Number.isFinite(parsedSort) ? parsedSort : 0;
    }

    const nextRuleType = normalizeRuleType(data.ruleType ?? existing.ruleType);
    const nextUnitName = data.unitName ?? existing.unitName;
    const nextMin =
      data.minUnit !== undefined
        ? data.minUnit
        : existing.minUnit?.toNumber
          ? existing.minUnit.toNumber()
          : existing.minUnit;
    const nextMax =
      data.maxUnit !== undefined
        ? data.maxUnit
        : existing.maxUnit?.toNumber
          ? existing.maxUnit.toNumber()
          : existing.maxUnit;
    const nextIsPercentage =
      data.isPercentage !== undefined
        ? data.isPercentage
        : !!existing.isPercentage;

    validateUnitRange(nextMin, nextMax);

    const flatFields = validateFlatRuleFields({
      ruleType: nextRuleType,
      minUnit: nextMin,
      maxUnit: nextMax,
      isPercentage: nextIsPercentage,
    });

    data.ruleType = nextRuleType;
    data.minUnit = flatFields.minUnit;
    data.maxUnit = flatFields.maxUnit;
    data.isPercentage = flatFields.isPercentage;

    const nextIsActive =
      data.isActive !== undefined
        ? data.isActive
        : !!existing.isActive;

    await validateRuleCompatibility(ruleModel, {
      unitName: nextUnitName,
      ruleType: nextRuleType,
      excludeId: ruleId,
      replaceConflictingRules: !!replaceConflictingRules,
      willBeActive: nextIsActive,
    });

    const updated = await prisma.$transaction(async (tx) => {
      const model = (tx as any).depositFeeRule;

      if (nextRuleType === "flat" && nextIsActive === false) {
        await activateRangeRulesForUnit(model, nextUnitName, ruleId);
      } else if (
        nextRuleType === "flat" &&
        nextIsActive &&
        replaceConflictingRules
      ) {
        await deactivateRangeRulesForUnit(model, nextUnitName, ruleId);
      } else if (nextRuleType === "range" && replaceConflictingRules) {
        await deactivateFlatRulesForUnit(model, nextUnitName, ruleId);
        await activateRangeRulesForUnit(model, nextUnitName, ruleId);
      }

      return model.update({
        where: { id: ruleId },
        data,
      });
    });

    return NextResponse.json(serializeRule(updated));
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requireSettingPermission("deposit-fees");

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
