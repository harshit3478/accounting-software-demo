import {
  formatBusinessDate,
  startOfBusinessDay,
} from "./business-date";

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
  try {
    return startOfBusinessDay(date);
  } catch {
    return null;
  }
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
  return `${installment.label} due date passed (${formatBusinessDate(
    installment.dueDate,
  )})`;
}

export interface LateFeeApplicationEntry {
  id: number;
  amount: number;
  reason: string;
  createdAt: string;
  isLegacyPayment?: boolean;
  paymentCode?: string;
}

export function getActiveLateFeeApplications(input: {
  editHistory?: Array<{
    id: number;
    createdAt: string;
    reason?: string;
    changes?: unknown;
  }> | null;
  payments?: Array<{
    id: number;
    amount?: number | string;
    source?: string;
    notes?: string | null;
    paymentCode?: string | null;
    paymentDate?: string | Date;
    createdAt?: string | Date;
  }> | null;
}): LateFeeApplicationEntry[] {
  const history = input.editHistory || [];
  const removedHistoryEntryIds = new Set<number>();

  for (const entry of history) {
    const changes = readLateFeeHistoryChanges(entry.changes);
    const removedEntryId = Number(changes?.lateFeeRemoved?.historyEntryId ?? 0);
    if (removedEntryId > 0) {
      removedHistoryEntryIds.add(removedEntryId);
    }
  }

  const applicationEntries: LateFeeApplicationEntry[] = history
    .map((entry) => {
      const changes = readLateFeeHistoryChanges(entry.changes);
      const applied = changes?.lateFeeApplied;
      const amount = Number(applied?.amount ?? 0);
      if (!applied || amount <= 0 || removedHistoryEntryIds.has(entry.id)) {
        return null;
      }

      return {
        id: entry.id,
        amount,
        reason: String(applied.reason || entry.reason || "Late fee applied"),
        createdAt: entry.createdAt,
      };
    })
    .filter(Boolean) as LateFeeApplicationEntry[];

  const legacyPayments = (input.payments || [])
    .filter((payment) => payment.source === "late_fee")
    .map((payment) => ({
      id: payment.id,
      amount: Number(payment.amount || 0),
      reason: String(payment.notes || "Late fee applied"),
      createdAt: String(payment.paymentDate || payment.createdAt || ""),
      isLegacyPayment: true,
      paymentCode: payment.paymentCode || undefined,
    }))
    .filter((entry) => entry.amount > 0);

  return [...applicationEntries, ...legacyPayments];
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
