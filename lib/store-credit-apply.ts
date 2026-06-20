import { Prisma } from "@prisma/client";
import { stampPaymentCode } from "./payment-code";

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export async function recordStoreCreditApplication(
  tx: any,
  input: {
    paymentId: number;
    invoiceId: number;
    invoiceNumber?: string;
    amount: number;
    customerId: number;
    userId: number;
  },
): Promise<void> {
  const amountToLink = new Prisma.Decimal(input.amount);

  const payment = await tx.payment.findUnique({
    where: { id: input.paymentId },
  });

  if (!payment) {
    throw new Error("Store credit payment not found");
  }

  if (payment.source !== "store_credit_excess") {
    throw new Error("Payment is not a store credit payment");
  }

  if (amountToLink.lte(0)) {
    throw new Error("Amount must be greater than 0");
  }

  const creditAppliedPayment = await tx.payment.create({
    data: {
      invoiceId: input.invoiceId,
      amount: amountToLink,
      paymentDate: payment.paymentDate,
      methodId: payment.methodId,
      notes: `Store credit applied (From payment ${payment.paymentCode || `#${payment.id}`})${payment.notes ? ` | ${payment.notes}` : ""}`,
      userId: input.userId,
      isMatched: true,
      source: "store_credit_applied",
    },
  });

  await stampPaymentCode(tx, creditAppliedPayment.id);

  const invoiceLabel = input.invoiceNumber || `#${input.invoiceId}`;

  await tx.customer.update({
    where: { id: input.customerId },
    data: {
      storeCredit: { decrement: amountToLink },
    },
  });

  await tx.customerCreditTransaction.create({
    data: {
      customerId: input.customerId,
      amount: amountToLink,
      type: "debit",
      reason: `Applied store credit to invoice ${invoiceLabel}`,
      paymentId: input.paymentId,
      invoiceId: input.invoiceId,
      createdById: input.userId,
    },
  });
}

export async function linkStoreCreditPaymentToInvoice(
  tx: any,
  input: {
    paymentId: number;
    invoiceId: number;
    invoiceNumber?: string;
    amount: number;
    customerId: number;
    userId: number;
  },
): Promise<void> {
  const amountToLink = new Prisma.Decimal(input.amount);

  const payment = await tx.payment.findUnique({
    where: { id: input.paymentId },
    include: { paymentMatches: true },
  });

  if (!payment) {
    throw new Error("Store credit payment not found");
  }

  if (payment.source !== "store_credit_excess") {
    throw new Error("Payment is not a store credit payment");
  }

  const matchedAmount = payment.paymentMatches.reduce(
    (sum: Prisma.Decimal, match: { amount: Prisma.Decimal }) =>
      sum.add(match.amount),
    new Prisma.Decimal(0),
  );
  const paymentAvailable = payment.amount.sub(matchedAmount);

  if (amountToLink.lte(0)) {
    throw new Error("Amount must be greater than 0");
  }

  if (amountToLink.gt(paymentAvailable)) {
    throw new Error(
      `Insufficient store credit on payment. Available: ${paymentAvailable}`,
    );
  }

  await tx.paymentInvoiceMatch.create({
    data: {
      paymentId: input.paymentId,
      invoiceId: input.invoiceId,
      amount: amountToLink,
      userId: input.userId,
    },
  });

  const newMatchedTotal = matchedAmount.add(amountToLink);
  const isNowFullyMatched = newMatchedTotal.gte(payment.amount);

  if (isNowFullyMatched !== payment.isMatched) {
    await tx.payment.update({
      where: { id: input.paymentId },
      data: { isMatched: isNowFullyMatched },
    });
  }

  await recordStoreCreditApplication(tx, input);
}

export async function applyAvailableStoreCreditToInvoice(
  tx: any,
  input: {
    invoiceId: number;
    invoiceNumber?: string;
    customerId: number;
    maxAmount: number;
    userId: number;
  },
): Promise<{ appliedAmount: number }> {
  const maxToApply = roundMoney(Math.max(input.maxAmount, 0));
  if (maxToApply <= 0) {
    return { appliedAmount: 0 };
  }

  const customer = await tx.customer.findUnique({
    where: { id: input.customerId },
    select: { storeCredit: true },
  });

  const balance = Number(
    customer?.storeCredit?.toNumber?.() ?? customer?.storeCredit ?? 0,
  );

  if (balance <= 0) {
    return { appliedAmount: 0 };
  }

  let remaining = roundMoney(Math.min(maxToApply, balance));

  const creditPayments = await tx.payment.findMany({
    where: {
      source: "store_credit_excess",
      isAbandoned: false,
      creditTransactions: {
        some: { customerId: input.customerId, type: "credit" },
      },
    },
    include: { paymentMatches: true },
    orderBy: { paymentDate: "asc" },
  });

  let totalApplied = 0;

  for (const payment of creditPayments) {
    if (remaining <= 0.001) {
      break;
    }

    const matchedAmount = payment.paymentMatches.reduce(
      (sum: number, match: { amount: { toNumber: () => number } }) =>
        sum + match.amount.toNumber(),
      0,
    );
    const available = roundMoney(payment.amount.toNumber() - matchedAmount);

    if (available <= 0) {
      continue;
    }

    const linkAmount = roundMoney(Math.min(available, remaining));

    await linkStoreCreditPaymentToInvoice(tx, {
      paymentId: payment.id,
      invoiceId: input.invoiceId,
      invoiceNumber: input.invoiceNumber,
      amount: linkAmount,
      customerId: input.customerId,
      userId: input.userId,
    });

    remaining = roundMoney(remaining - linkAmount);
    totalApplied = roundMoney(totalApplied + linkAmount);
  }

  return { appliedAmount: totalApplied };
}
