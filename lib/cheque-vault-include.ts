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
    },
  },
} as const;
