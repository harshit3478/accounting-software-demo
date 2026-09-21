import { Prisma } from "@prisma/client";
import { stampPaymentCode } from "./payment-code";

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function toNumber(
  value: { toNumber?: () => number } | number | null | undefined,
) {
  if (typeof value === "number") return value;
  return Number(value?.toNumber?.() ?? value ?? 0);
}

export function parseRefundProofDataUrl(input: {
  dataUrl: string;
  fileName?: string;
  mimeType?: string;
}): { buffer: Buffer; mimeType: string; safeFileName: string } {
  const match = input.dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    throw new Error("Refund proof image is invalid.");
  }

  const mimeType = (input.mimeType || "").trim() || match[1];
  const fallbackExtension =
    mimeType === "image/png"
      ? "png"
      : mimeType === "image/webp"
        ? "webp"
        : mimeType === "image/gif"
          ? "gif"
          : "jpg";
  const rawName =
    (input.fileName || "").trim() || `refund-proof.${fallbackExtension}`;
  const safeFileName = rawName.replace(/[^a-zA-Z0-9._-]/g, "_");

  return {
    buffer: Buffer.from(match[2], "base64"),
    mimeType,
    safeFileName,
  };
}

type CreditPayment = {
  id: number;
  amount: { toNumber: () => number };
  methodId: number;
  isMatched: boolean;
  isAbandoned: boolean;
  source: string | null;
  notes: string | null;
  paymentMatches: Array<{ amount: { toNumber: () => number } }>;
  creditTransactions: Array<{
    id: number;
    amount: { toNumber: () => number };
    type: string;
    invoiceId: number | null;
    invoice: {
      id: number;
      invoiceNumber: string;
      status: string;
    } | null;
  }>;
};

function leftoverOnPayment(payment: CreditPayment): number {
  const matched = payment.paymentMatches.reduce(
    (sum, match) => sum + toNumber(match.amount),
    0,
  );
  return roundMoney(Math.max(toNumber(payment.amount) - matched, 0));
}

function sourceCreditForPayment(
  payment: CreditPayment,
  creditTransactionId?: number,
) {
  const credits = payment.creditTransactions.filter(
    (tx) => tx.type === "credit",
  );
  if (creditTransactionId) {
    return (
      credits.find((tx) => tx.id === creditTransactionId) || credits[0] || null
    );
  }
  return credits[0] || null;
}

export async function refundAvailableStoreCredit(
  tx: any,
  input: {
    customerId: number;
    amount: number;
    reason: string;
    userId: number;
    refundProofUrl: string;
    refundProofFileName: string;
    creditTransactionId?: number;
  },
): Promise<{
  refundedAmount: number;
  remainingStoreCredit: number;
  refundPaymentId: number;
  refundPaymentCode: string;
}> {
  const refundAmount = roundMoney(input.amount);
  const reason = input.reason.trim();

  if (!Number.isFinite(refundAmount) || refundAmount <= 0.009) {
    throw new Error("Refund amount must be greater than 0");
  }
  if (!reason) {
    throw new Error("Reason is required");
  }
  if (!input.refundProofUrl) {
    throw new Error("Refund proof image is required");
  }

  const customer = await tx.customer.findUnique({
    where: { id: input.customerId },
    select: { id: true, storeCredit: true, name: true },
  });

  if (!customer) {
    throw new Error("Customer not found");
  }

  const storeCreditBalance = roundMoney(toNumber(customer.storeCredit));
  if (refundAmount > storeCreditBalance + 0.001) {
    throw new Error(
      `Amount exceeds available store credit ($${storeCreditBalance.toFixed(2)})`,
    );
  }

  const creditPayments: CreditPayment[] = await tx.payment.findMany({
    where: {
      source: "store_credit_excess",
      isAbandoned: false,
      creditTransactions: {
        some: input.creditTransactionId
          ? {
              id: input.creditTransactionId,
              customerId: input.customerId,
              type: "credit",
            }
          : { customerId: input.customerId, type: "credit" },
      },
    },
    include: {
      paymentMatches: true,
      creditTransactions: {
        where: { customerId: input.customerId },
        include: {
          invoice: {
            select: { id: true, invoiceNumber: true, status: true },
          },
        },
      },
    },
    orderBy: { paymentDate: "asc" },
  });

  const allocations: Array<{
    payment: CreditPayment;
    take: number;
    remainingAfter: number;
    sourceInvoice: { id: number; invoiceNumber: string; status: string } | null;
  }> = [];

  let remaining = refundAmount;

  for (const payment of creditPayments) {
    if (remaining <= 0.001) break;

    const leftover = leftoverOnPayment(payment);
    if (leftover <= 0.001) continue;

    const take = roundMoney(Math.min(leftover, remaining));
    if (take <= 0.001) continue;

    const sourceCredit = sourceCreditForPayment(
      payment,
      input.creditTransactionId,
    );
    allocations.push({
      payment,
      take,
      remainingAfter: roundMoney(leftover - take),
      sourceInvoice: sourceCredit?.invoice || null,
    });
    remaining = roundMoney(remaining - take);
  }

  if (remaining > 0.001) {
    throw new Error(
      `Not enough unmatched store credit to refund $${refundAmount.toFixed(2)}. Available on credit payments: $${(refundAmount - remaining).toFixed(2)}.`,
    );
  }

  const methodId =
    allocations[0]?.payment.methodId ||
    (
      await tx.paymentMethodEntry.findFirst({
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
        select: { id: true },
      })
    )?.id;

  if (!methodId) {
    throw new Error("No active payment method found");
  }

  const sourceInvoiceNumbers = [
    ...new Set(
      allocations
        .filter((row) => row.sourceInvoice?.status === "abandoned")
        .map((row) => row.sourceInvoice?.invoiceNumber)
        .filter((value): value is string => Boolean(value)),
    ),
  ];
  const sourcePhrase =
    sourceInvoiceNumbers.length > 0
      ? sourceInvoiceNumbers
          .map((invoiceNumber) => `abandoned invoice ${invoiceNumber}`)
          .join("; ")
      : `customer ${customer.name}`;
  const refundReason = `Remaining store credit refunded from ${sourcePhrase}. ${reason}`;

  await tx.customer.update({
    where: { id: input.customerId },
    data: {
      storeCredit: { decrement: new Prisma.Decimal(refundAmount) },
    },
  });

  for (const allocation of allocations) {
    const currentAmount = toNumber(allocation.payment.amount);
    const newAmount = roundMoney(currentAmount - allocation.take);
    const isNowMatched = allocation.remainingAfter <= 0.009;

    await tx.payment.update({
      where: { id: allocation.payment.id },
      data: {
        amount: new Prisma.Decimal(newAmount),
        isMatched: isNowMatched,
      },
    });

    await tx.paymentEditHistory.create({
      data: {
        paymentId: allocation.payment.id,
        editedById: input.userId,
        reason: refundReason,
        changes: {
          amount: { from: currentAmount, to: newAmount },
          isMatched: { from: allocation.payment.isMatched, to: isNowMatched },
        },
      },
    });

    await tx.customerCreditTransaction.create({
      data: {
        customerId: input.customerId,
        amount: new Prisma.Decimal(allocation.take),
        type: "debit",
        reason: refundReason,
        paymentId: allocation.payment.id,
        invoiceId: allocation.sourceInvoice?.id ?? null,
        createdById: input.userId,
      },
    });
  }

  const refundPayment = await tx.payment.create({
    data: {
      invoiceId: null,
      customerId: input.customerId,
      amount: new Prisma.Decimal(refundAmount),
      paymentDate: new Date(),
      methodId,
      notes: refundReason,
      userId: input.userId,
      isMatched: false,
      isAbandoned: true,
      abandonedAt: new Date(),
      abandonedBy: input.userId,
      abandonReason: refundReason,
      refundProofUrl: input.refundProofUrl,
      refundProofFileName: input.refundProofFileName,
      source: "store_credit_refund",
    },
  });

  const refundPaymentCode = await stampPaymentCode(tx, refundPayment.id);

  await tx.paymentEditHistory.create({
    data: {
      paymentId: refundPayment.id,
      editedById: input.userId,
      reason: refundReason,
      changes: {
        status: { from: "store_credit", to: "refund" },
        amount: { from: 0, to: refundAmount },
      },
    },
  });

  const historyByInvoice = new Map<
    number,
    {
      refunded: number;
      creditBefore: number;
      creditAfter: number;
    }
  >();

  for (const allocation of allocations) {
    const invoice = allocation.sourceInvoice;
    if (!invoice || invoice.status !== "abandoned") continue;

    const creditBefore = toNumber(allocation.payment.amount);
    const creditAfter = roundMoney(creditBefore - allocation.take);
    const existing = historyByInvoice.get(invoice.id);
    if (existing) {
      existing.refunded = roundMoney(existing.refunded + allocation.take);
      existing.creditBefore = roundMoney(existing.creditBefore + creditBefore);
      existing.creditAfter = roundMoney(existing.creditAfter + creditAfter);
    } else {
      historyByInvoice.set(invoice.id, {
        refunded: allocation.take,
        creditBefore,
        creditAfter,
      });
    }
  }

  for (const [invoiceId, snapshot] of historyByInvoice) {
    await tx.invoiceEditHistory.create({
      data: {
        invoiceId,
        editedById: input.userId,
        reason: refundReason,
        changes: {
          creditPaymentAmount: {
            from: snapshot.creditBefore,
            to: snapshot.creditAfter,
          },
          storeCreditRefunded: {
            from: snapshot.refunded,
            to: 0,
          },
          refundPaymentIds: {
            from: [],
            to: [refundPayment.id],
          },
          refundPaymentCodes: {
            from: [],
            to: [refundPaymentCode],
          },
          refundProof: {
            url: input.refundProofUrl,
            fileName: input.refundProofFileName,
          },
        },
      },
    });
  }

  const updatedCustomer = await tx.customer.findUnique({
    where: { id: input.customerId },
    select: { storeCredit: true },
  });

  return {
    refundedAmount: refundAmount,
    remainingStoreCredit: roundMoney(toNumber(updatedCustomer?.storeCredit)),
    refundPaymentId: refundPayment.id,
    refundPaymentCode,
  };
}
