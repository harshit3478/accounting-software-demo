export interface LateFeeInstallmentInfo {
  id: number;
  label: string;
  dueDate: string;
  amount: number;
}

export interface LateFeeSettingLike {
  amount?: number;
  isActive?: boolean;
}

export function isLateFeeConfigured(setting?: LateFeeSettingLike | null) {
  const amount = Number(setting?.amount ?? 0);
  return Number.isFinite(amount) && amount > 0;
}

export function startOfCalendarDay(date: Date | string) {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  const normalized = new Date(parsed);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
}

export function isLayawayInstallmentOverdue(
  dueDate: Date | string,
  referenceDate: Date | string = new Date(),
) {
  const due = startOfCalendarDay(dueDate);
  const reference = startOfCalendarDay(referenceDate);
  if (!due || !reference) {
    return false;
  }

  return due.getTime() < reference.getTime();
}

function toLateFeeInstallmentInfo(installment: any): LateFeeInstallmentInfo {
  return {
    id: Number(installment.id),
    label: String(installment.label || "Installment"),
    dueDate: new Date(installment.dueDate).toISOString(),
    amount: Number(installment.amount || 0),
  };
}

export function findOverdueLayawayInstallmentFromList(
  installments: any[] | null | undefined,
  paymentDate: string | Date,
  preferredInstallment?: {
    id: number;
    label: string;
    dueDate: string;
    amount: number;
    isPaid?: boolean;
  } | null,
): LateFeeInstallmentInfo | null {
  const referenceDate = startOfCalendarDay(paymentDate);
  if (!referenceDate) {
    return null;
  }

  if (
    preferredInstallment &&
    !preferredInstallment.isPaid &&
    isLayawayInstallmentOverdue(preferredInstallment.dueDate, referenceDate)
  ) {
    return toLateFeeInstallmentInfo(preferredInstallment);
  }

  const overdueInstallment = [...(installments || [])]
    .filter((installment: any) => {
      if (installment.isPaid) return false;
      return isLayawayInstallmentOverdue(installment.dueDate, referenceDate);
    })
    .sort(
      (left: any, right: any) =>
        new Date(left.dueDate).getTime() - new Date(right.dueDate).getTime(),
    )[0];

  if (!overdueInstallment) {
    return null;
  }

  return toLateFeeInstallmentInfo(overdueInstallment);
}

export function findOverdueLayawayInstallmentClient(
  invoice: any,
  paymentDate: string | Date,
  options?: {
    installments?: any[];
    preferredInstallment?: {
      id: number;
      label: string;
      dueDate: string;
      amount: number;
      isPaid?: boolean;
    } | null;
  },
): LateFeeInstallmentInfo | null {
  if (!invoice?.isLayaway) {
    return null;
  }

  const installments =
    options?.installments || invoice?.layawayPlan?.installments || [];

  if (!Array.isArray(installments) || installments.length === 0) {
    return null;
  }

  return findOverdueLayawayInstallmentFromList(
    installments,
    paymentDate,
    options?.preferredInstallment,
  );
}

export function buildLateFeeReason(
  installment: LateFeeInstallmentInfo,
): string {
  return `${installment.label} due date passed (${new Date(
    installment.dueDate,
  ).toLocaleDateString()})`;
}
