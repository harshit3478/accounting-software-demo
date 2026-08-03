import prisma from "./prisma";
import { formatPaymentCode } from "./payment-code";
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

export async function applyLateFeeToInvoice(
  tx: any,
  input: {
    invoiceId: number;
    amount: number;
    userId: number;
    reason?: string | null;
  },
) {
  const safeAmount = Number(input.amount || 0);
  if (!Number.isFinite(safeAmount) || safeAmount <= 0) {
    return null;
  }

  const invoice = await tx.invoice.findUnique({
    where: { id: input.invoiceId },
    select: { id: true, isLayaway: true, status: true },
  });

  if (!invoice) {
    throw new Error("Invoice not found");
  }

  if (!invoice.isLayaway) {
    throw new Error("Late fees can only be applied to layaway invoices");
  }

  if (invoice.status === "abandoned" || invoice.status === "inactive") {
    throw new Error("Cannot apply late fees to this invoice status");
  }

  const reason = input.reason?.trim() || "Late fee applied";

  await tx.invoice.update({
    where: { id: input.invoiceId },
    data: {
      lateFee: { increment: safeAmount },
      amount: { increment: safeAmount },
    },
  });

  const historyEntry = await tx.invoiceEditHistory.create({
    data: {
      invoiceId: input.invoiceId,
      editedById: input.userId,
      reason: `Late fee applied: ${reason}`,
      changes: {
        lateFeeApplied: {
          amount: safeAmount,
          reason,
        },
      },
    },
  });

  return historyEntry;
}

/** @deprecated Late fees are invoice charges, not payments. Kept for legacy backfill only. */
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
  return applyLateFeeToInvoice(tx, {
    invoiceId: input.invoiceId,
    amount: input.amount,
    userId: input.userId,
    reason: input.reason,
  });
}

function readLateFeeHistoryChanges(changes: unknown): {
  lateFeeApplied?: { amount?: number; reason?: string };
  lateFeeRemoved?: { historyEntryId?: number; paymentId?: number; amount?: number };
} | null {
  if (!changes || typeof changes !== "object" || Array.isArray(changes)) {
    return null;
  }
  return changes as {
    lateFeeApplied?: { amount?: number; reason?: string };
    lateFeeRemoved?: {
      historyEntryId?: number;
      paymentId?: number;
      amount?: number;
    };
  };
}

export async function removeLateFeeFromInvoice(
  tx: any,
  input: {
    invoiceId: number;
    historyEntryId?: number;
    paymentId?: number;
  },
) {
  const invoice = await tx.invoice.findUnique({
    where: { id: input.invoiceId },
    select: {
      id: true,
      isLayaway: true,
      status: true,
      amount: true,
      lateFee: true,
    },
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

  if (input.paymentId) {
    return removeLegacyLateFeePayment(tx, input.invoiceId, input.paymentId, invoice);
  }

  const historyEntryId = Number(input.historyEntryId ?? 0);
  if (!Number.isFinite(historyEntryId) || historyEntryId <= 0) {
    throw new Error("Valid history entry id is required");
  }

  const historyEntry = await tx.invoiceEditHistory.findUnique({
    where: { id: historyEntryId },
  });

  if (!historyEntry || historyEntry.invoiceId !== input.invoiceId) {
    throw new Error("Late fee history entry not found on this invoice");
  }

  const changes = readLateFeeHistoryChanges(historyEntry.changes);
  const feeAmount = Number(changes?.lateFeeApplied?.amount ?? 0);
  if (!Number.isFinite(feeAmount) || feeAmount <= 0) {
    throw new Error("Invalid late fee amount");
  }

  const currentLateFee = Number(
    invoice.lateFee?.toNumber?.() ?? invoice.lateFee ?? 0,
  );
  const nextLateFee = Math.max(Number((currentLateFee - feeAmount).toFixed(2)), 0);
  const currentAmount = Number(
    invoice.amount?.toNumber?.() ?? invoice.amount ?? 0,
  );
  const nextAmount = Math.max(Number((currentAmount - feeAmount).toFixed(2)), 0);

  await tx.invoice.update({
    where: { id: input.invoiceId },
    data: {
      lateFee: nextLateFee,
      amount: nextAmount,
    },
  });

  return {
    feeAmount,
    historyEntryId,
    reason: changes?.lateFeeApplied?.reason || historyEntry.reason,
    previousInvoiceAmount: currentAmount,
    nextInvoiceAmount: nextAmount,
  };
}

async function removeLegacyLateFeePayment(
  tx: any,
  invoiceId: number,
  paymentId: number,
  invoice: { amount: any; lateFee?: any },
) {
  const payment = await tx.payment.findUnique({
    where: { id: paymentId },
  });

  if (!payment || payment.invoiceId !== invoiceId) {
    throw new Error("Late fee payment not found on this invoice");
  }

  if (payment.source !== "late_fee") {
    throw new Error("Only late fee payments can be removed with this action");
  }

  const feeAmount = Number(payment.amount?.toNumber?.() ?? payment.amount ?? 0);
  if (!Number.isFinite(feeAmount) || feeAmount <= 0) {
    throw new Error("Invalid late fee amount");
  }

  const paymentCode = payment.paymentCode || formatPaymentCode(payment.id);

  await tx.payment.delete({
    where: { id: paymentId },
  });

  const currentAmount = Number(
    invoice.amount?.toNumber?.() ?? invoice.amount ?? 0,
  );
  const currentLateFee = Number(
    invoice.lateFee?.toNumber?.() ?? invoice.lateFee ?? 0,
  );
  const nextAmount = Math.max(Number((currentAmount - feeAmount).toFixed(2)), 0);
  const nextLateFee = Math.max(Number((currentLateFee - feeAmount).toFixed(2)), 0);

  await tx.invoice.update({
    where: { id: invoiceId },
    data: {
      amount: nextAmount,
      lateFee: nextLateFee,
    },
  });

  return {
    feeAmount,
    paymentId,
    paymentCode,
    notes: payment.notes,
    previousInvoiceAmount: currentAmount,
    nextInvoiceAmount: nextAmount,
  };
}
