import prisma from "./prisma";
import { stampPaymentCode, formatPaymentCode } from "./payment-code";
import { isLayawayInstallmentOverdue } from "./late-fee-client";

export interface LateFeeSettingSnapshot {
  amount: number;
  isActive: boolean;
}

export interface LateFeeInstallmentSnapshot {
  id: number;
  label: string;
  dueDate: string;
  amount: number;
}

export async function getLateFeeSettingSnapshot(): Promise<LateFeeSettingSnapshot> {
  const rateModel = (prisma as any)?.lateFeeSetting;
  if (!rateModel) {
    return { amount: 0, isActive: false };
  }

  const row = await rateModel.findFirst({ orderBy: { updatedAt: "desc" } });

  if (!row) {
    return { amount: 0, isActive: false };
  }

  return {
    amount: Number(row.amount ?? 0),
    isActive: row.isActive ?? Number(row.amount ?? 0) > 0,
  };
}

export function findOverdueLayawayInstallment(
  invoice: any,
  paymentDate: string | Date,
): LateFeeInstallmentSnapshot | null {
  if (!invoice?.isLayaway || !invoice?.layawayPlan?.installments?.length) {
    return null;
  }

  const overdueInstallment = [...invoice.layawayPlan.installments]
    .filter((installment: any) => {
      if (installment.isPaid) return false;
      return isLayawayInstallmentOverdue(installment.dueDate, paymentDate);
    })
    .sort(
      (left: any, right: any) =>
        new Date(left.dueDate).getTime() - new Date(right.dueDate).getTime(),
    )[0];

  if (!overdueInstallment) {
    return null;
  }

  return {
    id: Number(overdueInstallment.id),
    label: String(overdueInstallment.label || "Installment"),
    dueDate: new Date(overdueInstallment.dueDate).toISOString(),
    amount: Number(overdueInstallment.amount || 0),
  };
}

export async function createLateFeePayment(
  tx: any,
  input: {
    invoiceId: number;
    methodId: number;
    paymentDate: Date;
    amount: number;
    userId: number;
    reason?: string | null;
  },
) {
  const safeAmount = Number(input.amount || 0);
  if (!Number.isFinite(safeAmount) || safeAmount <= 0) {
    return null;
  }

  const notes = input.reason ? `Late fee: ${input.reason}` : "Late fee applied";

  const payment = await tx.payment.create({
    data: {
      invoiceId: input.invoiceId,
      amount: safeAmount,
      paymentDate: input.paymentDate,
      methodId: input.methodId,
      notes,
      userId: input.userId,
      isMatched: true,
      source: "late_fee",
    },
  });

  await stampPaymentCode(tx, payment.id);

  return payment;
}

export async function removeLateFeeFromInvoice(
  tx: any,
  input: {
    invoiceId: number;
    paymentId: number;
  },
) {
  const payment = await tx.payment.findUnique({
    where: { id: input.paymentId },
  });

  if (!payment || payment.invoiceId !== input.invoiceId) {
    throw new Error("Late fee payment not found on this invoice");
  }

  if (payment.source !== "late_fee") {
    throw new Error("Only late fee payments can be removed with this action");
  }

  const invoice = await tx.invoice.findUnique({
    where: { id: input.invoiceId },
    select: { id: true, isLayaway: true, status: true, amount: true },
  });

  if (!invoice) {
    throw new Error("Invoice not found");
  }

  if (!invoice.isLayaway) {
    throw new Error("Late fee removal is only available for layaway invoices");
  }

  if (invoice.status === "abandoned" || invoice.status === "inactive") {
    throw new Error("Cannot remove late fees from this invoice status");
  }

  const feeAmount = Number(payment.amount?.toNumber?.() ?? payment.amount ?? 0);
  if (!Number.isFinite(feeAmount) || feeAmount <= 0) {
    throw new Error("Invalid late fee amount");
  }

  const paymentCode = payment.paymentCode || formatPaymentCode(payment.id);

  await tx.payment.delete({
    where: { id: input.paymentId },
  });

  const currentAmount = Number(
    invoice.amount?.toNumber?.() ?? invoice.amount ?? 0,
  );
  const nextAmount = Math.max(
    Number((currentAmount - feeAmount).toFixed(2)),
    0,
  );

  await tx.invoice.update({
    where: { id: input.invoiceId },
    data: {
      amount: nextAmount,
    },
  });

  return {
    feeAmount,
    paymentCode,
    notes: payment.notes,
    previousInvoiceAmount: currentAmount,
    nextInvoiceAmount: nextAmount,
  };
}
