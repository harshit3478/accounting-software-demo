import prisma from "./prisma";
import { stampPaymentCode } from "./payment-code";

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

  const paymentDateValue = new Date(paymentDate);
  if (Number.isNaN(paymentDateValue.getTime())) {
    return null;
  }

  const overdueInstallment = [...invoice.layawayPlan.installments]
    .filter((installment: any) => {
      if (installment.isPaid) return false;
      const dueDate = new Date(installment.dueDate);
      return dueDate.getTime() < paymentDateValue.getTime();
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
