export interface LateFeeInstallmentInfo {
  id: number;
  label: string;
  dueDate: string;
  amount: number;
}

export function findOverdueLayawayInstallmentClient(
  invoice: any,
  paymentDate: string | Date,
): LateFeeInstallmentInfo | null {
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
