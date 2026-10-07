export interface RestockingFeeSettingSnapshot {
  amount: number;
  isPercentage: boolean;
  isActive: boolean;
}

export interface RestockingFeeItem {
  name?: string | null;
  unit?: string | null;
  quantity?: number | string | null;
  price?: number | string | null;
  pricePerItem?: number | string | null;
}

function itemQuantity(item: RestockingFeeItem): number {
  const quantity = Number(item.quantity ?? 0);
  return Number.isFinite(quantity) && quantity > 0 ? quantity : 0;
}

function itemUnitPrice(item: RestockingFeeItem): number {
  const price = Number(item.price ?? item.pricePerItem ?? 0);
  return Number.isFinite(price) && price > 0 ? price : 0;
}

function asRestockingItems(items: unknown): RestockingFeeItem[] {
  if (!Array.isArray(items)) return [];
  return items.filter(
    (item): item is RestockingFeeItem => !!item && typeof item === "object",
  );
}

function positiveMoney(value: unknown): number {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
}

/** Late-fee lines are charges, not merchandise, so they stay out of the restocking base. */
export function isLateFeeChargeLine(item: {
  name?: string | null;
  unit?: string | null;
}): boolean {
  const name = String(item.name || "");
  const unit = String(item.unit || "");
  return /late\s*fee/i.test(name) || /late\s*fee/i.test(unit);
}

export function calculateRestockingFeeAmount(
  items: unknown,
  setting: RestockingFeeSettingSnapshot,
  layawayFee?: number | string | null,
): number {
  if (!setting.isActive) return 0;

  const rawAmount = Number(setting.amount || 0);
  if (!Number.isFinite(rawAmount) || rawAmount <= 0) return 0;

  const eligibleItems = asRestockingItems(items).filter(
    (item) => !isLateFeeChargeLine(item),
  );

  if (!setting.isPercentage) {
    const total = eligibleItems.reduce((sum, item) => {
      const quantity = itemQuantity(item);
      if (quantity <= 0) return sum;
      return sum + rawAmount * quantity;
    }, 0);
    return Number(Math.max(total, 0).toFixed(2));
  }

  const itemAmount = eligibleItems.reduce((sum, item) => {
    const quantity = itemQuantity(item);
    const unitPrice = itemUnitPrice(item);
    if (quantity <= 0 || unitPrice <= 0) return sum;
    return sum + unitPrice * quantity;
  }, 0);
  const base = itemAmount + positiveMoney(layawayFee);

  return Number(Math.max((base * rawAmount) / 100, 0).toFixed(2));
}
