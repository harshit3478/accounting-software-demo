export interface RestockingFeeSettingSnapshot {
  amount: number;
  isPercentage: boolean;
  isActive: boolean;
}

export interface RestockingFeeItem {
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

export function calculateRestockingFeeAmount(
  items: unknown,
  setting: RestockingFeeSettingSnapshot,
): number {
  if (!setting.isActive) return 0;

  const rawAmount = Number(setting.amount || 0);
  if (!Number.isFinite(rawAmount) || rawAmount <= 0) return 0;

  const total = asRestockingItems(items).reduce((sum, item) => {
    const quantity = itemQuantity(item);
    if (quantity <= 0) return sum;

    if (!setting.isPercentage) {
      return sum + rawAmount * quantity;
    }

    const unitPrice = itemUnitPrice(item);
    if (unitPrice <= 0) return sum;
    return sum + (unitPrice * rawAmount * quantity) / 100;
  }, 0);

  return Number(Math.max(total, 0).toFixed(2));
}
