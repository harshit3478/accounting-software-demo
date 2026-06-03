export interface RestockingFeeSettingSnapshot {
  amount: number;
  isPercentage: boolean;
  isActive: boolean;
}

export function calculateRestockingFeeAmount(
  invoiceTotal: number,
  setting: RestockingFeeSettingSnapshot,
): number {
  if (!setting.isActive) return 0;

  const rawAmount = Number(setting.amount || 0);
  if (!Number.isFinite(rawAmount) || rawAmount <= 0) return 0;

  const calculated = setting.isPercentage
    ? (Number(invoiceTotal || 0) * rawAmount) / 100
    : rawAmount;

  return Number(Math.max(calculated, 0).toFixed(2));
}
