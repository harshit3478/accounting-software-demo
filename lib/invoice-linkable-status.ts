/** Invoice statuses that can receive cheque / payment allocations */
export const LINKABLE_INVOICE_STATUSES = [
  "pending",
  "partial",
  "overdue",
] as const;

export type LinkableInvoiceStatus = (typeof LINKABLE_INVOICE_STATUSES)[number];

export function isLinkableInvoiceStatus(status: string): boolean {
  return (LINKABLE_INVOICE_STATUSES as readonly string[]).includes(status);
}
