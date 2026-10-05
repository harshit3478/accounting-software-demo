import { Prisma } from "@prisma/client";
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

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Source payment named in a store_credit_applied note. */
export function parseStoreCreditSourceRef(notes: string | null | undefined): {
  paymentCode: string | null;
  paymentId: number | null;
} {
  if (!notes) {
    return { paymentCode: null, paymentId: null };
  }

  const codeMatch = notes.match(/From payment (PAY-\d+)(?!\d)/i);
  const hashMatch = notes.match(/From payment #(\d+)(?!\d)/i);
  const paymentCode = codeMatch?.[1]?.toUpperCase() ?? null;
  const paymentIdFromHash = hashMatch ? parseInt(hashMatch[1], 10) : null;
  const paymentIdFromCode = paymentCode
    ? parseInt(paymentCode.replace(/^PAY-/i, ""), 10)
    : null;

  const paymentId = paymentIdFromHash || paymentIdFromCode;
  return {
    paymentCode,
    paymentId: paymentId && paymentId > 0 ? paymentId : null,
  };
}

/** True when an active applied-payment note is the visible row for this excess payment. */
export function storeCreditAppliedNotesReferenceSource(
  notes: string | null | undefined,
  source: { id: number; paymentCode?: string | null },
): boolean {
  if (!notes) {
    return false;
  }

  const code = source.paymentCode || formatPaymentCode(source.id);
  const escapedCode = code.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (new RegExp(`From payment ${escapedCode}(?!\\d)`, "i").test(notes)) {
    return true;
  }

  return new RegExp(`From payment #${source.id}(?!\\d)`, "i").test(notes);
}

/**
 * Abandoning a store_credit_applied row only marks that copy abandoned.
 * The invoice match and the customer debit live on the source excess payment.
 * Drop this invoice's match and put the amount back on the customer balance.
 */
export async function releaseAbandonedStoreCreditApplication(
  tx: any,
  input: {
    appliedAmount: number;
    invoiceId?: number | null;
    customerId?: number | null;
    notes?: string | null;
    userId: number;
    reason: string;
  },
): Promise<{ affectedInvoiceIds: Set<number> }> {
  const affectedInvoiceIds = new Set<number>();
  const invoiceId = input.invoiceId ?? null;
  if (invoiceId) {
    affectedInvoiceIds.add(invoiceId);
  }

  const appliedAmount = roundMoney(input.appliedAmount);
  if (appliedAmount <= 0 || !invoiceId) {
    return { affectedInvoiceIds };
  }

  const sourceRef = parseStoreCreditSourceRef(input.notes);
  if (!sourceRef.paymentId && !sourceRef.paymentCode) {
    throw new Error(
      "Store credit application is missing its source payment reference.",
    );
  }

  const source = sourceRef.paymentId
    ? await tx.payment.findUnique({ where: { id: sourceRef.paymentId } })
    : await tx.payment.findUnique({
        where: { paymentCode: sourceRef.paymentCode },
      });

  if (!source) {
    throw new Error("Source store credit payment was not found.");
  }

  const match = await tx.paymentInvoiceMatch.findUnique({
    where: {
      paymentId_invoiceId: {
        paymentId: source.id,
        invoiceId,
      },
    },
  });

  if (match) {
    const matchAmount = roundMoney(Number(match.amount));
    const removed = roundMoney(Math.min(matchAmount, appliedAmount));
    if (matchAmount - removed <= 0.009) {
      await tx.paymentInvoiceMatch.delete({ where: { id: match.id } });
    } else {
      await tx.paymentInvoiceMatch.update({
        where: { id: match.id },
        data: {
          amount: { decrement: new Prisma.Decimal(removed.toFixed(2)) },
        },
      });
    }
  }

  const remainingMatches = await tx.paymentInvoiceMatch.findMany({
    where: { paymentId: source.id },
    select: { amount: true },
  });
  const matchedTotal = roundMoney(
    remainingMatches.reduce(
      (sum: number, row: { amount: { toNumber?: () => number } | number }) =>
        sum + Number(row.amount),
      0,
    ),
  );
  const sourceAmount = roundMoney(Number(source.amount));
  const fullyMatched = matchedTotal + 0.001 >= sourceAmount;
  if (fullyMatched !== Boolean(source.isMatched)) {
    await tx.payment.update({
      where: { id: source.id },
      data: { isMatched: fullyMatched },
    });
  }

  const customerId = input.customerId ?? source.customerId ?? null;
  if (customerId) {
    await tx.customer.update({
      where: { id: customerId },
      data: {
        storeCredit: {
          increment: new Prisma.Decimal(appliedAmount.toFixed(2)),
        },
      },
    });

    await tx.customerCreditTransaction.create({
      data: {
        customerId,
        amount: new Prisma.Decimal(appliedAmount.toFixed(2)),
        type: "credit",
        reason: `Reversed store credit application because the applied payment was abandoned. ${input.reason}`,
        paymentId: source.id,
        invoiceId,
        createdById: input.userId,
      },
    });
  }

  return { affectedInvoiceIds };
}

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
  const reason =
    payment.abandonReason || "Repair abandoned store credit payment";
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
