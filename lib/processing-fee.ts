import { Prisma } from "@prisma/client";
import prisma from "./prisma";

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

  // Processing fees are recorded only in customer store credit history.
  // Do not create invoice payments or inflate invoice total / paid amount.
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
  return prisma.$transaction(async (tx) =>
    applyStoreCreditAsProcessingFee(tx, input),
  );
}
