import type { Prisma } from "@prisma/client";
import {
  buildLayawayInstallmentSchedule,
  calculateLayawayInstallmentAmount,
  type LayawayPaymentFrequency,
} from "./layaway-installments";

const AMOUNT_TOLERANCE = 0.02;
const SUM_TOLERANCE = 0.05;

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

function amountsDiffer(a: number, b: number) {
  return Math.abs(a - b) > AMOUNT_TOLERANCE;
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

export function previewLayawayInstallmentRepair(
  invoice: LayawayInvoiceRow,
  plan: LayawayPlanRow,
  installments: LayawayInstallmentRow[],
): LayawayInstallmentRepairPreview | null {
  if (!invoice.isLayaway || installments.length === 0) {
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

  const expectedRegularAmount = calculateLayawayInstallmentAmount({
    totalAmount: invoiceAmount,
    downPayment: toNumber(plan.downPayment),
    months: plan.months,
    frequency: normalizeFrequency(plan.paymentFrequency),
  });

  const regularInstallments = installments.filter(
    (inst) => !isDownPaymentLabel(inst.label),
  );
  const hasShrunkenInstallments = regularInstallments.some((inst) => {
    const amount = toNumber(inst.amount);
    return amount > 0 && amount < expectedRegularAmount - AMOUNT_TOLERANCE;
  });
  const scheduleSumMismatch = amountsDiffer(scheduleSumBefore, invoiceAmount);

  if (!hasShrunkenInstallments && !scheduleSumMismatch) {
    return null;
  }

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

    if (existing.isPaid !== nextPaid.isPaid) {
      const change =
        changes.find((entry) => entry.installmentId === row.id) ??
        ({
          installmentId: row.id,
          label: row.label,
          amount: { from: toNumber(existing.amount), to: row.amount },
        } satisfies LayawayInstallmentRepairChange);

      if (!changes.includes(change)) {
        changes.push(change);
      }

      change.isPaid = { from: existing.isPaid, to: nextPaid.isPaid };
    }

    if (existingPaidAmount !== nextPaid.paidAmount) {
      const change =
        changes.find((entry) => entry.installmentId === row.id) ??
        ({
          installmentId: row.id,
          label: row.label,
          amount: { from: toNumber(existing.amount), to: row.amount },
        } satisfies LayawayInstallmentRepairChange);

      if (!changes.includes(change)) {
        changes.push(change);
      }

      change.paidAmount = {
        from: existingPaidAmount,
        to: nextPaid.paidAmount,
      };
    }

    if (existing.paymentId !== nextPaid.paymentId) {
      const change =
        changes.find((entry) => entry.installmentId === row.id) ??
        ({
          installmentId: row.id,
          label: row.label,
          amount: { from: toNumber(existing.amount), to: row.amount },
        } satisfies LayawayInstallmentRepairChange);

      if (!changes.includes(change)) {
        changes.push(change);
      }

      change.paymentId = {
        from: existing.paymentId,
        to: nextPaid.paymentId,
      };
    }
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

  if (
    changes.length === 0 &&
    createdInstallments.length === 0 &&
    removedInstallmentIds.length === 0
  ) {
    return null;
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
        orderBy: { dueDate: "asc" },
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

  const expectedSchedule = buildExpectedLayawaySchedule(invoice, plan);
  const { pairs, unmatchedExisting } = matchInstallmentsToSchedule(
    plan.installments,
    expectedSchedule,
  );

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

  const paidUpdates = reconcilePaidInstallments(
    correctedRows,
    toNumber(invoice.paidAmount),
  );

  for (const pair of pairs) {
    if (!pair.existing) continue;

    const nextAmount = roundMoney(pair.expected.amount);
    const paidState = paidUpdates.get(pair.existing.id);
    const nextIsPaid = paidState?.isPaid ?? pair.existing.isPaid;

    await tx.layawayInstallment.update({
      where: { id: pair.existing.id },
      data: {
        amount: nextAmount,
        isPaid: nextIsPaid,
        paidAmount: nextIsPaid ? (paidState?.paidAmount ?? nextAmount) : null,
        paidDate: nextIsPaid ? pair.existing.paidDate : null,
        paymentId: nextIsPaid ? paidState?.paymentId ?? pair.existing.paymentId : null,
      },
    });
  }

  for (const pair of pairs) {
    if (pair.existing) continue;

    const created = await tx.layawayInstallment.create({
      data: {
        layawayPlanId: plan.id,
        dueDate: pair.expected.dueDate,
        amount: roundMoney(pair.expected.amount),
        label: pair.expected.label,
        isPaid: false,
      },
    });

    correctedRows.push({
      id: created.id,
      label: created.label,
      amount: toNumber(created.amount),
      isPaid: false,
      paidAmount: null,
      paymentId: null,
    });
  }

  for (const installment of unmatchedExisting) {
    if (installment.isPaid) continue;
    await tx.layawayInstallment.delete({
      where: { id: installment.id },
    });
  }

  return preview;
}
