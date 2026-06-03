export function calculateRecalculationFeeAmount(
  _remainingAmount: number,
  fixedAmount: number,
) {
  const safeAmount = Math.max(0, Number(fixedAmount) || 0);
  return Number(safeAmount.toFixed(2));
}
