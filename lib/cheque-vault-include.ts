import { getChequeVaultRemainingStoreCreditAmount } from "@/lib/cheque-vault-store-credit";

/** Shared Prisma include for cheque vault detail/list responses. */
export const chequeVaultUserInclude = {
  uploadedBy: { select: { id: true, name: true, email: true } },
  approvedBy: { select: { id: true, name: true } },
  rejectedBy: { select: { id: true, name: true } },
  correctionRequestedBy: { select: { id: true, name: true } },
  invoicesLinkedBy: { select: { id: true, name: true } },
} as const;

export const chequeVaultInvoiceAllocationInclude = {
  invoice: {
    select: {
      id: true,
      invoiceNumber: true,
      clientName: true,
      amount: true,
      paidAmount: true,
      status: true,
      customerId: true,
      customer: {
        select: {
          id: true,
          name: true,
          email: true,
          storeCredit: true,
        },
      },
    },
  },
} as const;

export const chequeVaultStoreCreditMoveInclude = {
  customer: { select: { id: true, name: true, email: true } },
  movedBy: { select: { id: true, name: true } },
  payment: { select: { id: true, paymentCode: true } },
} as const;

export function serializeChequeVaultRecord(cheque: any) {
  const invoiceAllocations = (cheque.invoiceAllocations || []).map(
    (a: any) => ({
      ...a,
      allocatedAmount: Number(a.allocatedAmount),
      invoice: a.invoice
        ? {
            ...a.invoice,
            amount: Number(a.invoice.amount),
            paidAmount: Number(a.invoice.paidAmount),
            customerId: a.invoice.customerId ?? null,
            customer: a.invoice.customer
              ? {
                  ...a.invoice.customer,
                  storeCredit: Number(
                    a.invoice.customer.storeCredit?.toNumber?.() ??
                      a.invoice.customer.storeCredit ??
                      0,
                  ),
                }
              : null,
          }
        : null,
    }),
  );

  const storeCreditMoves = (cheque.storeCreditMoves || []).map((m: any) => ({
    ...m,
    amount: Number(m.amount),
  }));

  const totalAllocated = invoiceAllocations.reduce(
    (sum: number, a: { allocatedAmount: number }) => sum + a.allocatedAmount,
    0,
  );
  const totalMovedToStoreCredit = storeCreditMoves.reduce(
    (sum: number, m: { amount: number }) => sum + m.amount,
    0,
  );
  const remainingUnallocated = getChequeVaultRemainingStoreCreditAmount(
    Number(cheque.amount),
    invoiceAllocations,
    storeCreditMoves,
  );

  const customerMap = new Map<
    number,
    { id: number; name: string; email: string | null; storeCredit: number }
  >();
  for (const alloc of invoiceAllocations) {
    const customer = alloc.invoice?.customer;
    if (customer?.id != null) {
      customerMap.set(customer.id, customer);
    }
  }

  return {
    ...cheque,
    amount: Number(cheque.amount),
    invoiceAllocations,
    storeCreditMoves,
    totalAllocated,
    totalMovedToStoreCredit,
    remainingUnallocated,
    linkedCustomers: [...customerMap.values()],
  };
}
