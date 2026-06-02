export function calculateRecalculationFeeAmount(
  remainingAmount: number,
  ratePercent: number,
) {
  const safeRemaining = Math.max(0, Number(remainingAmount) || 0);
  const safeRate = Math.max(0, Number(ratePercent) || 0);
  return Number(((safeRemaining * safeRate) / 100).toFixed(2));
}
