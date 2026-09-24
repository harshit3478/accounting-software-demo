const BALANCE_EPSILON = 0.01;

export function invoiceRemainingBalance(
  amount: number,
  paidAmount: number,
): number {
  return Math.round((amount - paidAmount) * 100) / 100;
}

/** True when a cheque allocation is more than the balance still open. */
export function allocationExceedsRemaining(
  allocatedAmount: number,
  remainingBalance: number,
): boolean {
  return allocationExceedsInvoiceBalance(allocatedAmount, remainingBalance, 0);
}

/** True when a cheque allocation is more than the invoice still owes. */
export function allocationExceedsInvoiceBalance(
  allocatedAmount: number,
  invoiceAmount: number,
  paidAmount: number,
): boolean {
  const allocated = Math.round(allocatedAmount * 100) / 100;
  return (
    allocated >
    invoiceRemainingBalance(invoiceAmount, paidAmount) + BALANCE_EPSILON
  );
}

export function invoiceOverAllocationMessage(input: {
  invoiceNumber: string;
  allocatedAmount: number;
  invoiceAmount: number;
  paidAmount: number;
}): string {
  const balance = Math.max(
    invoiceRemainingBalance(input.invoiceAmount, input.paidAmount),
    0,
  );
  return `Allocation ($${input.allocatedAmount.toFixed(2)}) exceeds the remaining balance on ${input.invoiceNumber} ($${balance.toFixed(2)}). Allocate only the balance and leave the extra unallocated so it can be moved to store credit.`;
}
