import type { Prisma } from "@prisma/client";
import {
  buildLayawayInstallmentSchedule,
  calculateLayawayInstallmentAmount,
  type LayawayPaymentFrequency,
} from "./layaway-installments";

const AMOUNT_TOLERANCE = 0.02;
/** Ignore schedule totals within $1 or 1% of invoice — normal rounding. */
const SIGNIFICANT_MISMATCH_RATIO = 0.01;
const SIGNIFICANT_MISMATCH_MIN = 1;
/** Installment amounts below 85% of expected indicate the remaining-balance bug. */
const SHRUNKEN_INSTALLMENT_RATIO = 0.85;
const INFLATED_INSTALLMENT_RATIO = 1.15;

export const SKIPPED_LAYAWAY_REPAIR_STATUSES = ["abandoned", "inactive"] as const;

type TxClient = Prisma.TransactionClient;

export interface LayawayInstallmentRow {
  id: number;
  dueDate: Date;
  amount: number | Prisma.Decimal;
  label: string;
  isPaid: boolean;
  paidDate: Date | null;
  paidAmount: number | Prisma.Decimal | null;
  paymentId: number | null;
}

export interface LayawayPlanRow {
  id: number;
  months: number;
  paymentFrequency: string;
  downPayment: number | Prisma.Decimal;
  isCancelled: boolean;
}

export interface LayawayInvoiceRow {
  id: number;
  invoiceNumber: string;
  amount: number | Prisma.Decimal;
  paidAmount: number | Prisma.Decimal;
  invoiceDate: Date;
  isLayaway: boolean;
  status: string;
}

export interface LayawayInstallmentRepairChange {
  installmentId: number;
  label: string;
  amount: { from: number; to: number };
  isPaid?: { from: boolean; to: boolean };
  paidAmount?: { from: number | null; to: number | null };
  paymentId?: { from: number | null; to: number | null };
}

export interface LayawayInstallmentRepairPreview {
  invoiceId: number;
  invoiceNumber: string;
  planId: number;
  invoiceAmount: number;
  paidAmount: number;
  scheduleSumBefore: number;
  scheduleSumAfter: number;
  changes: LayawayInstallmentRepairChange[];
  createdInstallments: Array<{ label: string; amount: number; dueDate: Date }>;
  removedInstallmentIds: number[];
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function toNumber(value: number | Prisma.Decimal) {
  return roundMoney(Number(value));
}

function isDownPaymentLabel(label: string) {
  return label.toLowerCase().includes("down payment");
}

function normalizeFrequency(value: string): LayawayPaymentFrequency {
  if (value === "weekly" || value === "bi-weekly") {
    return value;
  }
  return "monthly";
}

function significantMismatchThreshold(invoiceAmount: number) {
  return Math.max(
    SIGNIFICANT_MISMATCH_MIN,
    roundMoney(invoiceAmount * SIGNIFICANT_MISMATCH_RATIO),
  );
}

export function shouldRepairLayawayInstallments(
  invoice: LayawayInvoiceRow,
  plan: LayawayPlanRow,
  installments: LayawayInstallmentRow[],
): boolean {
  if (!invoice.isLayaway || installments.length === 0) {
    return false;
  }

  if (SKIPPED_LAYAWAY_REPAIR_STATUSES.includes(invoice.status as any)) {
    return false;
  }

  const invoiceAmount = toNumber(invoice.amount);
  if (invoiceAmount <= AMOUNT_TOLERANCE) {
    return false;
  }

  const scheduleSumBefore = roundMoney(
    installments.reduce((sum, inst) => sum + toNumber(inst.amount), 0),
  );

  const expectedRegularAmount = calculateLayawayInstallmentAmount({
    totalAmount: invoiceAmount,
    downPayment: toNumber(plan.downPayment),
    months: plan.months,
    frequency: normalizeFrequency(plan.paymentFrequency),
  });

  const regularInstallments = installments.filter(
    (inst) => !isDownPaymentLabel(inst.label),
  );

  const hasShrunkenInstallments =
    expectedRegularAmount > AMOUNT_TOLERANCE &&
    regularInstallments.some((inst) => {
      const amount = toNumber(inst.amount);
      return (
        amount > AMOUNT_TOLERANCE &&
        amount < expectedRegularAmount * SHRUNKEN_INSTALLMENT_RATIO
      );
    });

  const hasInflatedInstallments =
    expectedRegularAmount > AMOUNT_TOLERANCE &&
    regularInstallments.some((inst) => {
      const amount = toNumber(inst.amount);
      return amount > expectedRegularAmount * INFLATED_INSTALLMENT_RATIO;
    });

  const mismatchThreshold = significantMismatchThreshold(invoiceAmount);
  const scheduleSumWayTooLow =
    scheduleSumBefore < invoiceAmount - mismatchThreshold;
  const scheduleSumWayTooHigh =
    scheduleSumBefore > invoiceAmount + mismatchThreshold;

  return (
    hasShrunkenInstallments ||
    hasInflatedInstallments ||
    scheduleSumWayTooLow ||
    scheduleSumWayTooHigh
  );
}

export function buildExpectedLayawaySchedule(
  invoice: Pick<LayawayInvoiceRow, "amount" | "invoiceDate">,
  plan: Pick<
    LayawayPlanRow,
    "months" | "paymentFrequency" | "downPayment"
  >,
) {
  return buildLayawayInstallmentSchedule({
    invoiceDate: invoice.invoiceDate,
    frequency: normalizeFrequency(plan.paymentFrequency),
    months: plan.months,
    downPayment: toNumber(plan.downPayment),
    totalAmount: toNumber(invoice.amount),
    includeDownPayment: true,
  });
}

function matchInstallmentsToSchedule(
  existing: LayawayInstallmentRow[],
  expected: ReturnType<typeof buildExpectedLayawaySchedule>,
) {
  const sortedExisting = [...existing].sort(
    (a, b) => a.dueDate.getTime() - b.dueDate.getTime(),
  );
  const sortedExpected = [...expected].sort(
    (a, b) => a.dueDate.getTime() - b.dueDate.getTime(),
  );

  const pairs = sortedExpected.map((expectedInst, index) => ({
    existing: sortedExisting[index] ?? null,
    expected: expectedInst,
  }));

  const matchedExistingIds = new Set(
    pairs.map((pair) => pair.existing?.id).filter(Boolean) as number[],
  );
  const unmatchedExisting = sortedExisting.filter(
    (inst) => !matchedExistingIds.has(inst.id),
  );

  return { pairs, unmatchedExisting };
}

function reconcilePaidInstallments(
  installments: Array<{
    id: number;
    label: string;
    amount: number;
    isPaid: boolean;
    paidAmount: number | null;
    paymentId: number | null;
  }>,
  invoicePaidAmount: number,
) {
  let remainingPaid = roundMoney(invoicePaidAmount);
  const updates = new Map<
    number,
    {
      isPaid: boolean;
      paidAmount: number | null;
      paymentId: number | null;
    }
  >();

  for (const installment of installments) {
    const canMarkPaid = remainingPaid + AMOUNT_TOLERANCE >= installment.amount;

    if (canMarkPaid && installment.amount > 0) {
      updates.set(installment.id, {
        isPaid: true,
        paidAmount: installment.amount,
        paymentId: installment.isPaid ? installment.paymentId : null,
      });
      remainingPaid = roundMoney(remainingPaid - installment.amount);
      continue;
    }

    updates.set(installment.id, {
      isPaid: false,
      paidAmount: null,
      paymentId: null,
    });
  }

  return updates;
}

function amountsDiffer(a: number, b: number) {
  return Math.abs(a - b) > AMOUNT_TOLERANCE;
}

function upsertChange(
  changes: LayawayInstallmentRepairChange[],
  draft: LayawayInstallmentRepairChange,
) {
  const existing = changes.find(
    (entry) => entry.installmentId === draft.installmentId,
  );
  if (existing) {
    Object.assign(existing, draft);
    return existing;
  }
  changes.push(draft);
  return draft;
}

export function previewLayawayInstallmentRepair(
  invoice: LayawayInvoiceRow,
  plan: LayawayPlanRow,
  installments: LayawayInstallmentRow[],
): LayawayInstallmentRepairPreview | null {
  if (!shouldRepairLayawayInstallments(invoice, plan, installments)) {
    return null;
  }

  const expectedSchedule = buildExpectedLayawaySchedule(invoice, plan);
  const scheduleSumBefore = roundMoney(
    installments.reduce((sum, inst) => sum + toNumber(inst.amount), 0),
  );
  const scheduleSumAfter = roundMoney(
    expectedSchedule.reduce((sum, inst) => sum + inst.amount, 0),
  );
  const invoiceAmount = toNumber(invoice.amount);
  const paidAmount = toNumber(invoice.paidAmount);

  const { pairs, unmatchedExisting } = matchInstallmentsToSchedule(
    installments,
    expectedSchedule,
  );

  const changes: LayawayInstallmentRepairChange[] = [];
  const correctedRows: Array<{
    id: number;
    label: string;
    amount: number;
    isPaid: boolean;
    paidAmount: number | null;
    paymentId: number | null;
  }> = [];

  for (const pair of pairs) {
    const nextAmount = roundMoney(pair.expected.amount);

    if (pair.existing) {
      const currentAmount = toNumber(pair.existing.amount);
      correctedRows.push({
        id: pair.existing.id,
        label: pair.existing.label,
        amount: nextAmount,
        isPaid: pair.existing.isPaid,
        paidAmount: pair.existing.paidAmount
          ? toNumber(pair.existing.paidAmount)
          : null,
        paymentId: pair.existing.paymentId,
      });

      if (amountsDiffer(currentAmount, nextAmount)) {
        changes.push({
          installmentId: pair.existing.id,
          label: pair.existing.label,
          amount: { from: currentAmount, to: nextAmount },
        });
      }
      continue;
    }

    correctedRows.push({
      id: -1,
      label: pair.expected.label,
      amount: nextAmount,
      isPaid: false,
      paidAmount: null,
      paymentId: null,
    });
  }

  const createdInstallments = pairs
    .filter((pair) => !pair.existing)
    .map((pair) => ({
      label: pair.expected.label,
      amount: roundMoney(pair.expected.amount),
      dueDate: pair.expected.dueDate,
    }));

  const removedInstallmentIds = unmatchedExisting
    .filter((inst) => !inst.isPaid)
    .map((inst) => inst.id);

  const hasAmountRepairs =
    changes.length > 0 ||
    createdInstallments.length > 0 ||
    removedInstallmentIds.length > 0;

  if (!hasAmountRepairs) {
    return null;
  }

  const paidUpdates = reconcilePaidInstallments(correctedRows, paidAmount);

  for (const row of correctedRows) {
    if (row.id <= 0) continue;
    const nextPaid = paidUpdates.get(row.id);
    if (!nextPaid) continue;

    const existing = installments.find((inst) => inst.id === row.id);
    if (!existing) continue;

    const existingPaidAmount = existing.paidAmount
      ? toNumber(existing.paidAmount)
      : null;
    const baseChange = {
      installmentId: row.id,
      label: row.label,
      amount: { from: toNumber(existing.amount), to: row.amount },
    };

    if (existing.isPaid !== nextPaid.isPaid) {
      upsertChange(changes, {
        ...baseChange,
        isPaid: { from: existing.isPaid, to: nextPaid.isPaid },
      });
    }

    if (existingPaidAmount !== nextPaid.paidAmount) {
      upsertChange(changes, {
        ...baseChange,
        paidAmount: {
          from: existingPaidAmount,
          to: nextPaid.paidAmount,
        },
      });
    }

    if (existing.paymentId !== nextPaid.paymentId) {
      upsertChange(changes, {
        ...baseChange,
        paymentId: {
          from: existing.paymentId,
          to: nextPaid.paymentId,
        },
      });
    }
  }

  return {
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    planId: plan.id,
    invoiceAmount,
    paidAmount,
    scheduleSumBefore,
    scheduleSumAfter,
    changes,
    createdInstallments,
    removedInstallmentIds,
  };
}

/**
 * Rebuild layaway installments to the full expected schedule (same as Edit
 * Invoice installment preview): amounts, due dates, and labels.
 * Reconciles isPaid / paidAmount from invoice.paidAmount in due-date order.
 */
export async function syncLayawayPlanInstallments(
  tx: TxClient,
  invoiceId: number,
): Promise<void> {
  const invoice = await tx.invoice.findUnique({
    where: { id: invoiceId },
    select: {
      id: true,
      amount: true,
      paidAmount: true,
      invoiceDate: true,
      isLayaway: true,
    },
  });

  if (!invoice?.isLayaway) {
    return;
  }

  const plan = await tx.layawayPlan.findUnique({
    where: { invoiceId },
    include: {
      installments: {
        orderBy: [{ dueDate: "asc" }, { id: "asc" }],
      },
    },
  });

  if (!plan || plan.isCancelled) {
    return;
  }

  const expectedSchedule = buildExpectedLayawaySchedule(invoice, plan);
  if (expectedSchedule.length === 0) {
    return;
  }

  const { pairs, unmatchedExisting } = matchInstallmentsToSchedule(
    plan.installments,
    expectedSchedule,
  );

  for (const installment of unmatchedExisting) {
    if (installment.isPaid) {
      await tx.layawayInstallment.update({
        where: { id: installment.id },
        data: {
          isPaid: false,
          paidAmount: null,
          paidDate: null,
          paymentId: null,
        },
      });
    }
    await tx.layawayInstallment.delete({
      where: { id: installment.id },
    });
  }

  const syncedRows: Array<{
    id: number;
    label: string;
    amount: number;
    isPaid: boolean;
    paidAmount: number | null;
    paymentId: number | null;
    paidDate: Date | null;
  }> = [];

  for (const pair of pairs) {
    const nextAmount = roundMoney(pair.expected.amount);

    if (pair.existing) {
      await tx.layawayInstallment.update({
        where: { id: pair.existing.id },
        data: {
          dueDate: pair.expected.dueDate,
          amount: nextAmount,
          label: pair.expected.label,
        },
      });

      syncedRows.push({
        id: pair.existing.id,
        label: pair.expected.label,
        amount: nextAmount,
        isPaid: pair.existing.isPaid,
        paidAmount: pair.existing.paidAmount
          ? toNumber(pair.existing.paidAmount)
          : null,
        paymentId: pair.existing.paymentId,
        paidDate: pair.existing.paidDate,
      });
      continue;
    }

    const created = await tx.layawayInstallment.create({
      data: {
        layawayPlanId: plan.id,
        dueDate: pair.expected.dueDate,
        amount: nextAmount,
        label: pair.expected.label,
        isPaid: false,
      },
    });

    syncedRows.push({
      id: created.id,
      label: pair.expected.label,
      amount: nextAmount,
      isPaid: false,
      paidAmount: null,
      paymentId: null,
      paidDate: null,
    });
  }

  const paidUpdates = reconcilePaidInstallments(
    syncedRows,
    toNumber(invoice.paidAmount),
  );

  for (const row of syncedRows) {
    const paidState = paidUpdates.get(row.id);
    if (!paidState) continue;

    const nextIsPaid = paidState.isPaid;
    await tx.layawayInstallment.update({
      where: { id: row.id },
      data: {
        isPaid: nextIsPaid,
        paidAmount: nextIsPaid ? (paidState.paidAmount ?? row.amount) : null,
        paidDate: nextIsPaid ? row.paidDate ?? new Date() : null,
        paymentId: nextIsPaid ? paidState.paymentId ?? row.paymentId : null,
      },
    });
  }
}

export async function repairLayawayInstallmentsForInvoice(
  tx: TxClient,
  invoiceId: number,
): Promise<LayawayInstallmentRepairPreview | null> {
  const invoice = await tx.invoice.findUnique({
    where: { id: invoiceId },
    select: {
      id: true,
      invoiceNumber: true,
      amount: true,
      paidAmount: true,
      invoiceDate: true,
      isLayaway: true,
      status: true,
    },
  });

  if (!invoice?.isLayaway) {
    return null;
  }

  const plan = await tx.layawayPlan.findUnique({
    where: { invoiceId },
    include: {
      installments: {
        orderBy: [{ dueDate: "asc" }, { id: "asc" }],
      },
    },
  });

  if (!plan || plan.installments.length === 0) {
    return null;
  }

  const preview = previewLayawayInstallmentRepair(
    invoice,
    plan,
    plan.installments,
  );

  if (!preview) {
    return null;
  }

  await syncLayawayPlanInstallments(tx, invoiceId);

  return preview;
}
