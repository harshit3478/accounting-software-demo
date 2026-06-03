/** Split a total across line items proportionally; last item gets remainder. */
export function allocatePaymentAmounts(
  items: Array<{ id: number; amount: number }>,
  totalToAllocate: number,
): Map<number, number> {
  const result = new Map<number, number>();
  if (items.length === 0 || totalToAllocate <= 0) {
    return result;
  }

  const sourceTotal = items.reduce((sum, item) => sum + item.amount, 0);
  if (sourceTotal <= 0) {
    return result;
  }

  let remaining = Math.round(totalToAllocate * 100) / 100;

  items.forEach((item, index) => {
    const isLast = index === items.length - 1;
    const portion = isLast
      ? remaining
      : Math.round((item.amount / sourceTotal) * totalToAllocate * 100) / 100;
    const safePortion = Math.min(portion, remaining);
    result.set(item.id, safePortion);
    remaining = Math.round((remaining - safePortion) * 100) / 100;
  });

  return result;
}
