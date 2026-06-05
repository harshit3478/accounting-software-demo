export interface DepositFeeRuleLike {
  unitName?: string | null;
  minUnit?: number | null;
  maxUnit?: number | null;
  fee: number;
  isActive?: boolean;
  sortOrder?: number;
}

export interface DepositFeeItemLike {
  quantity?: number | string | null;
  unit?: string | null;
}

function normalizeUnitName(unit: string | null | undefined) {
  return String(unit || "")
    .trim()
    .toLowerCase();
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

export function calculateDepositFeeFromRules(
  quantity: number,
  unitName: string | null | undefined,
  rules: DepositFeeRuleLike[],
): number {
  if (!Number.isFinite(quantity) || quantity <= 0) return 0;

  const normalizedUnit = normalizeUnitName(unitName);
  const sortedRules = normalizeDepositFeeRules(
    rules.filter((rule) => rule.isActive !== false),
  );

  for (const rule of sortedRules) {
    const ruleUnit = normalizeUnitName(rule.unitName);
    if (ruleUnit && normalizedUnit && ruleUnit !== normalizedUnit) continue;

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
  );
}
