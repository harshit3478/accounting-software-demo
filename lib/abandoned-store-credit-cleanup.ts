import { formatPaymentCode } from "./payment-code";

type CreditTxLike = {
  type: string;
  customerId: number;
  invoiceId?: number | null;
  paymentId?: number | null;
  amount: { toNumber: () => number };
};

type PaymentMatchLike = {
  invoiceId: number;
};

/**
 * Collect every invoice that should be recalculated when a payment is abandoned.
 */
export function collectInvoiceIdsAffectedByPaymentAbandon(input: {
  invoiceId?: number | null;
  paymentMatches?: PaymentMatchLike[];
  creditTransactions?: Array<{ invoiceId?: number | null }>;
}): Set<number> {
  const affected = new Set<number>();

  if (input.invoiceId) {
    affected.add(input.invoiceId);
  }

  for (const match of input.paymentMatches || []) {
    affected.add(match.invoiceId);
  }

  for (const creditTx of input.creditTransactions || []) {
    if (creditTx.invoiceId) {
      affected.add(creditTx.invoiceId);
    }
  }

  return affected;
}

/** Remove matches, void applied store-credit rows, reverse unspent customer credit. */
export async function cleanupAbandonedStoreCreditPayment(
  tx: any,
  input: {
    paymentId: number;
    paymentCode?: string | null;
    reason: string;
    userId: number;
    creditTransactions?: CreditTxLike[];
    paymentMatches?: Array<{ id: number }>;
    reverseUnspentCredit?: boolean;
  },
): Promise<{ affectedInvoiceIds: Set<number> }> {
  const paymentCode = input.paymentCode || formatPaymentCode(input.paymentId);
  const affectedInvoiceIds = new Set<number>();

  for (const match of input.paymentMatches || []) {
    await tx.paymentInvoiceMatch.delete({
      where: { id: match.id },
    });
  }

  const creditTxs = input.creditTransactions || [];
  const appliedFromPayment = creditTxs
    .filter(
      (creditTx) =>
        creditTx.type === "debit" && creditTx.paymentId === input.paymentId,
    )
    .reduce((sum, creditTx) => sum + creditTx.amount.toNumber(), 0);

  for (const debit of creditTxs.filter(
    (creditTx) =>
      creditTx.type === "debit" && creditTx.paymentId === input.paymentId,
  )) {
    if (debit.invoiceId) {
      affectedInvoiceIds.add(debit.invoiceId);
    }

    const appliedPayments = await tx.payment.findMany({
      where: {
        invoiceId: debit.invoiceId ?? undefined,
        source: "store_credit_applied",
        isAbandoned: false,
        OR: [
          { notes: { contains: paymentCode } },
          { notes: { contains: `#${input.paymentId}` } },
        ],
      },
      select: { id: true, invoiceId: true },
    });

    for (const appliedPayment of appliedPayments) {
      if (appliedPayment.invoiceId) {
        affectedInvoiceIds.add(appliedPayment.invoiceId);
      }

      await tx.payment.update({
        where: { id: appliedPayment.id },
        data: {
          isAbandoned: true,
          abandonedAt: new Date(),
          abandonedBy: input.userId,
          abandonReason: `Store credit voided — source payment ${paymentCode} abandoned. ${input.reason}`,
        },
      });
    }
  }

  if (input.reverseUnspentCredit !== false) {
    for (const creditTx of creditTxs.filter(
      (creditTx) => creditTx.type === "credit",
    )) {
      const originalCredit = creditTx.amount.toNumber();
      const remainingCredit = Math.max(0, originalCredit - appliedFromPayment);

      if (remainingCredit <= 0.01) {
        continue;
      }

      await tx.customerCreditTransaction.create({
        data: {
          customerId: creditTx.customerId,
          amount: remainingCredit,
          type: "debit",
          reason: "Payment abandoned - reversing credit",
          paymentId: null,
          createdById: input.userId,
        },
      });

      const customer = await tx.customer.findUnique({
        where: { id: creditTx.customerId },
      });

      if (customer) {
        await tx.customer.update({
          where: { id: creditTx.customerId },
          data: {
            storeCredit: Math.max(
              0,
              customer.storeCredit.toNumber() - remainingCredit,
            ),
          },
        });
      }
    }
  }

  return { affectedInvoiceIds };
}

/** Idempotent repair for payments already marked abandoned. */
export async function repairAbandonedStoreCreditPayment(
  tx: any,
  payment: {
    id: number;
    paymentCode?: string | null;
    abandonReason?: string | null;
    abandonedBy?: number | null;
    creditTransactions: CreditTxLike[];
    paymentMatches: Array<{ id: number; invoiceId: number }>;
  },
  userId: number,
): Promise<Set<number>> {
  const reason = payment.abandonReason || "Repair abandoned store credit payment";
  const cleanup = await cleanupAbandonedStoreCreditPayment(tx, {
    paymentId: payment.id,
    paymentCode: payment.paymentCode,
    reason,
    userId: payment.abandonedBy || userId,
    creditTransactions: payment.creditTransactions,
    paymentMatches: payment.paymentMatches,
    reverseUnspentCredit: false,
  });

  const affected = collectInvoiceIdsAffectedByPaymentAbandon({
    paymentMatches: payment.paymentMatches,
    creditTransactions: payment.creditTransactions,
  });

  for (const invoiceId of cleanup.affectedInvoiceIds) {
    affected.add(invoiceId);
  }

  return affected;
}
