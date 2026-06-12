export type DepositFeeRuleType = "range" | "flat";

export interface DepositFeeRuleLike {
  unitName?: string | null;
  ruleType?: DepositFeeRuleType | string | null;
  minUnit?: number | null;
  maxUnit?: number | null;
  fee: number;
  isPercentage?: boolean;
  isActive?: boolean;
  sortOrder?: number;
}

export interface DepositFeeItemLike {
  quantity?: number | string | null;
  unit?: string | null;
  price?: number | string | null;
}

function normalizeUnitName(unit: string | null | undefined) {
  return String(unit || "")
    .trim()
    .toLowerCase();
}

export function isFlatDepositFeeRule(rule: DepositFeeRuleLike): boolean {
  return rule.ruleType === "flat";
}

export function normalizeDepositFeeRules<T extends DepositFeeRuleLike>(
  rules: T[],
): T[] {
  return [...rules].sort((left, right) => {
    const leftOrder = Number(left.sortOrder || 0);
    const rightOrder = Number(right.sortOrder || 0);
    if (leftOrder !== rightOrder) return leftOrder - rightOrder;

    const unitCompare = normalizeUnitName(left.unitName).localeCompare(
      normalizeUnitName(right.unitName),
    );
    if (unitCompare !== 0) return unitCompare;

    const leftMin = left.minUnit ?? Number.NEGATIVE_INFINITY;
    const rightMin = right.minUnit ?? Number.NEGATIVE_INFINITY;
    if (leftMin !== rightMin) return leftMin - rightMin;

    return (
      Number(left.maxUnit ?? Number.POSITIVE_INFINITY) -
      Number(right.maxUnit ?? Number.POSITIVE_INFINITY)
    );
  });
}

export function calculateFlatDepositFee(
  quantity: number,
  unitPrice: number,
  rule: DepositFeeRuleLike,
): number {
  const fee = Number(rule.fee || 0);
  if (!Number.isFinite(fee) || fee < 0) return 0;

  if (rule.isPercentage) {
    const lineTotal = unitPrice * quantity;
    return Number(((lineTotal * fee) / 100).toFixed(2));
  }

  return Number((fee * quantity).toFixed(2));
}

export function calculateDepositFeeFromRules(
  quantity: number,
  unitName: string | null | undefined,
  rules: DepositFeeRuleLike[],
  unitPrice = 0,
): number {
  if (!Number.isFinite(quantity) || quantity <= 0) return 0;

  const normalizedUnit = normalizeUnitName(unitName);
  const sortedRules = normalizeDepositFeeRules(
    rules.filter((rule) => rule.isActive !== false),
  );

  for (const rule of sortedRules) {
    const ruleUnit = normalizeUnitName(rule.unitName);
    if (ruleUnit && normalizedUnit && ruleUnit !== normalizedUnit) continue;

    if (isFlatDepositFeeRule(rule)) {
      return calculateFlatDepositFee(quantity, Number(unitPrice || 0), rule);
    }

    const minOk = rule.minUnit == null || quantity >= Number(rule.minUnit);
    const maxOk = rule.maxUnit == null || quantity <= Number(rule.maxUnit);
    if (minOk && maxOk) {
      return Number(Number(rule.fee || 0).toFixed(2));
    }
  }

  return 0;
}

export function calculateDepositFeeForItem(
  item: DepositFeeItemLike,
  rules: DepositFeeRuleLike[],
): number {
  return calculateDepositFeeFromRules(
    Number(item.quantity || 0),
    item.unit,
    rules,
    Number(item.price || 0),
  );
}

export function formatDepositFeeRuleSummary(rule: DepositFeeRuleLike): string {
  const unit = rule.unitName || "units";

  if (isFlatDepositFeeRule(rule)) {
    if (rule.isPercentage) {
      return `${Number(rule.fee || 0)}% of line total per ${unit}`;
    }
    return `$${Number(rule.fee || 0).toFixed(2)} per ${unit}`;
  }

  const min = rule.minUnit;
  const max = rule.maxUnit;
  if (min == null && max == null) return `All ${unit} quantities`;
  if (min != null && max == null) return `${unit} >= ${min}`;
  if (min == null && max != null) return `${unit} <= ${max}`;
  return `${unit} ${min} - ${max}`;
}
