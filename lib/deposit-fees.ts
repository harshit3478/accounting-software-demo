export interface DepositFeeRuleLike {
  minAmount?: number | null;
  maxAmount?: number | null;
  fee: number;
  isActive?: boolean;
  sortOrder?: number;
}

export interface DepositFeeItemLike {
  price: number;
}

export function normalizeDepositFeeRules<T extends DepositFeeRuleLike>(
  rules: T[],
): T[] {
  return [...rules].sort((left, right) => {
    const leftOrder = Number(left.sortOrder || 0);
    const rightOrder = Number(right.sortOrder || 0);
    if (leftOrder !== rightOrder) return leftOrder - rightOrder;

    const leftMin = left.minAmount ?? Number.NEGATIVE_INFINITY;
    const rightMin = right.minAmount ?? Number.NEGATIVE_INFINITY;
    if (leftMin !== rightMin) return leftMin - rightMin;

    return (
      Number(left.maxAmount ?? Number.POSITIVE_INFINITY) -
      Number(right.maxAmount ?? Number.POSITIVE_INFINITY)
    );
  });
}

export function calculateDepositFeeFromRules(
  amount: number,
  rules: DepositFeeRuleLike[],
): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;

  const sortedRules = normalizeDepositFeeRules(
    rules.filter((rule) => rule.isActive !== false),
  );

  for (const rule of sortedRules) {
    const minOk = rule.minAmount == null || amount >= Number(rule.minAmount);
    const maxOk = rule.maxAmount == null || amount <= Number(rule.maxAmount);
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
  return calculateDepositFeeFromRules(Number(item.price || 0), rules);
}
