import { Prisma } from "@prisma/client";
import prisma from "./prisma";
import { stampPaymentCode } from "./payment-code";
import { updateInvoiceAfterPayment } from "./invoice-utils";

export async function createProcessingFeePayment(
  tx: any,
  input: {
    invoiceId: number;
    methodId: number;
    paymentDate: Date;
    amount: number;
    userId: number;
    notes?: string | null;
  },
) {
  const safeAmount = Number(input.amount || 0);
  if (!Number.isFinite(safeAmount) || safeAmount <= 0) {
    return null;
  }

  const notes =
    input.notes?.trim() ||
    "Processing fee applied from QuickBooks payment overage";

  const payment = await tx.payment.create({
    data: {
      invoiceId: input.invoiceId,
      amount: safeAmount,
      paymentDate: input.paymentDate,
      methodId: input.methodId,
      notes,
      userId: input.userId,
      isMatched: true,
      source: "processing_fee",
    },
  });

  await stampPaymentCode(tx, payment.id);

  return payment;
}

export async function applyStoreCreditAsProcessingFee(
  tx: any,
  input: {
    customerId: number;
    invoiceId: number;
    amount: number;
    userId: number;
    creditTransactionId?: number;
  },
) {
  const safeAmount = Number(input.amount || 0);
  if (!Number.isFinite(safeAmount) || safeAmount <= 0) {
    throw new Error("Amount must be greater than 0");
  }

  const customer = await tx.customer.findUnique({
    where: { id: input.customerId },
    select: { id: true, storeCredit: true },
  });

  if (!customer) {
    throw new Error("Customer not found");
  }

  const storeCreditBalance = Number(
    customer.storeCredit?.toNumber?.() ?? customer.storeCredit ?? 0,
  );

  if (safeAmount > storeCreditBalance + 0.001) {
    throw new Error(
      `Amount exceeds available store credit ($${storeCreditBalance.toFixed(2)})`,
    );
  }

  const invoice = await tx.invoice.findUnique({
    where: { id: input.invoiceId },
    select: {
      id: true,
      invoiceNumber: true,
      customerId: true,
      status: true,
    },
  });

  if (!invoice) {
    throw new Error("Invoice not found");
  }

  if (invoice.customerId !== input.customerId) {
    throw new Error("Invoice does not belong to this customer");
  }

  if (invoice.status === "abandoned" || invoice.status === "inactive") {
    throw new Error("Cannot apply processing fee to this invoice status");
  }

  let creditPaymentId: number | null = null;
  let methodId: number | null = null;
  let paymentDate = new Date();

  if (input.creditTransactionId) {
    const creditTx = await tx.customerCreditTransaction.findFirst({
      where: {
        id: input.creditTransactionId,
        customerId: input.customerId,
        type: "credit",
      },
      include: {
        payment: {
          select: {
            id: true,
            amount: true,
            methodId: true,
            paymentDate: true,
            source: true,
            isAbandoned: true,
            notes: true,
          },
        },
      },
    });

    if (!creditTx) {
      throw new Error("Store credit transaction not found");
    }

    const txAmount = Number(
      creditTx.amount?.toNumber?.() ?? creditTx.amount ?? 0,
    );

    if (safeAmount > txAmount + 0.001) {
      throw new Error(
        `Amount exceeds this credit entry ($${txAmount.toFixed(2)})`,
      );
    }

    if (creditTx.payment) {
      if (creditTx.payment.source !== "store_credit_excess") {
        throw new Error(
          "Only excess payment credits can be marked as processing fee",
        );
      }

      if (creditTx.payment.isAbandoned) {
        throw new Error("This store credit payment has been abandoned");
      }

      creditPaymentId = creditTx.payment.id;
      methodId = creditTx.payment.methodId;
      paymentDate = creditTx.payment.paymentDate;

      await tx.payment.update({
        where: { id: creditTx.payment.id },
        data: {
          isMatched: true,
          notes: [
            creditTx.payment.notes || "",
            `Reclassified as processing fee on ${invoice.invoiceNumber}`,
          ]
            .filter(Boolean)
            .join(" | "),
        },
      });
    }
  }

  if (!methodId) {
    const fallbackMethod = await tx.paymentMethodEntry.findFirst({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true },
    });

    if (!fallbackMethod) {
      throw new Error("No active payment method found");
    }

    methodId = fallbackMethod.id;
  }

  await createProcessingFeePayment(tx, {
    invoiceId: input.invoiceId,
    methodId,
    paymentDate,
    amount: safeAmount,
    userId: input.userId,
    notes: `Processing fee from store credit on ${invoice.invoiceNumber}`,
  });

  await tx.invoice.update({
    where: { id: input.invoiceId },
    data: {
      processingFee: { increment: safeAmount },
      amount: { increment: safeAmount },
    },
  });

  await tx.customer.update({
    where: { id: input.customerId },
    data: {
      storeCredit: { decrement: new Prisma.Decimal(safeAmount) },
    },
  });

  await tx.customerCreditTransaction.create({
    data: {
      customerId: input.customerId,
      amount: new Prisma.Decimal(safeAmount),
      type: "debit",
      reason: `Processing fee applied to invoice ${invoice.invoiceNumber}`,
      paymentId: creditPaymentId,
      invoiceId: input.invoiceId,
      createdById: input.userId,
    },
  });

  return {
    invoiceId: input.invoiceId,
    invoiceNumber: invoice.invoiceNumber,
    amount: safeAmount,
  };
}

export async function applyStoreCreditAsProcessingFeeAndSync(
  input: Parameters<typeof applyStoreCreditAsProcessingFee>[1],
) {
  const result = await prisma.$transaction(async (tx) =>
    applyStoreCreditAsProcessingFee(tx, input),
  );

  await updateInvoiceAfterPayment(result.invoiceId);

  return result;
}
