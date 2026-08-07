import { Prisma } from "@prisma/client";

type PaymentInvoiceMatchTx = {
  paymentInvoiceMatch: {
    findUnique: (args: {
      where: {
        paymentId_invoiceId: { paymentId: number; invoiceId: number };
      };
    }) => Promise<{ id: number } | null>;
    create: (args: {
      data: {
        paymentId: number;
        invoiceId: number;
        amount: Prisma.Decimal | number;
        userId: number;
      };
    }) => Promise<{ id: number; paymentId: number; invoiceId: number; amount: Prisma.Decimal }>;
    update: (args: {
      where: { id: number };
      data: { amount: { increment: Prisma.Decimal | number } };
    }) => Promise<{ id: number; paymentId: number; invoiceId: number; amount: Prisma.Decimal }>;
  };
};

export async function createOrIncrementPaymentInvoiceMatch(
  tx: PaymentInvoiceMatchTx,
  data: {
    paymentId: number;
    invoiceId: number;
    amount: Prisma.Decimal | number;
    userId: number;
  },
) {
  const amount =
    data.amount instanceof Prisma.Decimal
      ? data.amount
      : new Prisma.Decimal(data.amount);

  const existing = await tx.paymentInvoiceMatch.findUnique({
    where: {
      paymentId_invoiceId: {
        paymentId: data.paymentId,
        invoiceId: data.invoiceId,
      },
    },
  });

  if (existing) {
    return tx.paymentInvoiceMatch.update({
      where: { id: existing.id },
      data: { amount: { increment: amount } },
    });
  }

  return tx.paymentInvoiceMatch.create({
    data: {
      paymentId: data.paymentId,
      invoiceId: data.invoiceId,
      amount,
      userId: data.userId,
    },
  });
}
