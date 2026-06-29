import prisma from "./prisma";
import { sendDuePaymentReminderEmail } from "./email";
import { daysBetweenBusiness } from "./business-date";

export interface DueReminderSettingSnapshot {
  daysAfterDueDate: number;
  daysBetweenReminders: number;
  isActive: boolean;
}

export interface RestockingFeeSnapshot {
  amount: number;
  isPercentage: boolean;
  isActive: boolean;
}

const DEFAULT_SETTING: DueReminderSettingSnapshot = {
  daysAfterDueDate: 1,
  daysBetweenReminders: 7,
  isActive: false,
};

function daysBetween(start: Date, end: Date): number {
  return daysBetweenBusiness(start, end);
}

export async function getDueReminderSettingSnapshot(): Promise<DueReminderSettingSnapshot> {
  const model = (prisma as any)?.dueReminderSetting;
  if (!model) {
    return DEFAULT_SETTING;
  }

  const row = await model.findFirst({ orderBy: { updatedAt: "desc" } });
  if (!row) {
    return DEFAULT_SETTING;
  }

  return {
    daysAfterDueDate: Number(row.daysAfterDueDate ?? 1),
    daysBetweenReminders: Number(row.daysBetweenReminders ?? 7),
    isActive: !!row.isActive,
  };
}

export async function getRestockingFeeSnapshot(): Promise<RestockingFeeSnapshot> {
  const model = (prisma as any)?.restockingFeeSetting;
  if (!model) {
    return { amount: 0, isPercentage: false, isActive: false };
  }

  const row = await model.findFirst({ orderBy: { updatedAt: "desc" } });
  if (!row) {
    return { amount: 0, isPercentage: false, isActive: false };
  }

  return {
    amount: Number(row.amount ?? 0),
    isPercentage: !!row.isPercentage,
    isActive: !!row.isActive,
  };
}

export function formatRestockingFeeNotice(
  invoiceAmount: number,
  restocking: RestockingFeeSnapshot,
): string | null {
  if (!restocking.isActive || restocking.amount <= 0) {
    return "Please be advised that continued non-payment may result in a restocking fee and cancellation of your order, per our terms and conditions.";
  }

  const feeAmount = restocking.isPercentage
    ? (invoiceAmount * restocking.amount) / 100
    : restocking.amount;

  const feeLabel = restocking.isPercentage
    ? `${restocking.amount}% ($${feeAmount.toFixed(2)})`
    : `$${feeAmount.toFixed(2)}`;

  return `Please be advised that if payment is not received, a restocking fee of ${feeLabel} may apply and your order may be cancelled, per our terms and conditions.`;
}

function getInvoiceRemaining(invoice: {
  amount: { toNumber?: () => number } | number;
  paidAmount: { toNumber?: () => number } | number;
}): number {
  const amount = Number(
    (invoice.amount as any)?.toNumber?.() ?? invoice.amount ?? 0,
  );
  const paid = Number(
    (invoice.paidAmount as any)?.toNumber?.() ?? invoice.paidAmount ?? 0,
  );
  return Math.max(amount - paid, 0);
}

export function shouldSendDueReminder(
  invoice: {
    dueDate: Date;
    dueReminderCount: number;
    lastDueReminderAt: Date | null;
    amount: { toNumber?: () => number } | number;
    paidAmount: { toNumber?: () => number } | number;
    status: string;
  },
  setting: DueReminderSettingSnapshot,
  now = new Date(),
): { send: boolean; reminderNumber: 1 | 2 | 3 | null } {
  if (!setting.isActive) {
    return { send: false, reminderNumber: null };
  }

  if (
    invoice.status === "paid" ||
    invoice.status === "abandoned" ||
    invoice.status === "inactive"
  ) {
    return { send: false, reminderNumber: null };
  }

  const remaining = getInvoiceRemaining(invoice);
  if (remaining <= 0.01) {
    return { send: false, reminderNumber: null };
  }

  if (invoice.dueReminderCount >= 3) {
    return { send: false, reminderNumber: null };
  }

  const daysPastDue = daysBetween(new Date(invoice.dueDate), now);
  if (daysPastDue < setting.daysAfterDueDate) {
    return { send: false, reminderNumber: null };
  }

  const nextReminderNumber = (invoice.dueReminderCount + 1) as 1 | 2 | 3;

  if (invoice.dueReminderCount === 0) {
    return { send: true, reminderNumber: 1 };
  }

  if (!invoice.lastDueReminderAt) {
    return { send: true, reminderNumber: nextReminderNumber };
  }

  const daysSinceLast = daysBetween(invoice.lastDueReminderAt, now);
  if (daysSinceLast >= setting.daysBetweenReminders) {
    return { send: true, reminderNumber: nextReminderNumber };
  }

  return { send: false, reminderNumber: null };
}

export async function processDueReminderEmails(options?: {
  setting?: DueReminderSettingSnapshot;
  restocking?: RestockingFeeSnapshot;
}) {
  const setting = options?.setting ?? (await getDueReminderSettingSnapshot());
  const restocking = options?.restocking ?? (await getRestockingFeeSnapshot());

  if (!setting.isActive) {
    return {
      processed: 0,
      sent: 0,
      skipped: 0,
      failed: 0,
      details: [] as Array<{
        invoiceId: number;
        invoiceNumber: string;
        reminderNumber?: number;
        status: "sent" | "skipped" | "failed";
        error?: string;
      }>,
    };
  }

  const now = new Date();
  const invoices = await prisma.invoice.findMany({
    where: {
      status: { in: ["pending", "overdue", "partial"] },
      dueReminderCount: { lt: 3 },
      customer: {
        email: { not: null },
      },
    },
    include: {
      customer: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  const details: Array<{
    invoiceId: number;
    invoiceNumber: string;
    reminderNumber?: number;
    status: "sent" | "skipped" | "failed";
    error?: string;
  }> = [];

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const invoice of invoices) {
    const customerEmail = invoice.customer?.email?.trim();
    if (!customerEmail) {
      skipped += 1;
      details.push({
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        status: "skipped",
        error: "Missing customer email",
      });
      continue;
    }

    const decision = shouldSendDueReminder(invoice, setting, now);
    if (!decision.send || !decision.reminderNumber) {
      skipped += 1;
      continue;
    }

    const remaining = getInvoiceRemaining(invoice);
    const restockingNotice =
      decision.reminderNumber === 3
        ? formatRestockingFeeNotice(Number(invoice.amount), restocking)
        : null;

    const emailResult = await sendDuePaymentReminderEmail({
      reminderNumber: decision.reminderNumber,
      customer: {
        name: invoice.customer?.name || invoice.clientName,
        email: customerEmail,
      },
      invoice: {
        invoiceNumber: invoice.invoiceNumber,
        amount: Number(invoice.amount),
        paidAmount: Number(invoice.paidAmount),
        remaining,
        dueDate: invoice.dueDate,
        isLayaway: invoice.isLayaway,
      },
      restockingNotice,
    });

    if (emailResult.success) {
      await prisma.$transaction(async (tx) => {
        await tx.invoice.update({
          where: { id: invoice.id },
          data: {
            dueReminderCount: decision.reminderNumber,
            lastDueReminderAt: now,
          },
        });
        await (tx as any).invoiceDueReminderLog.create({
          data: {
            invoiceId: invoice.id,
            reminderNumber: decision.reminderNumber,
            recipientEmail: customerEmail,
            success: true,
          },
        });
      });
      sent += 1;
      details.push({
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        reminderNumber: decision.reminderNumber,
        status: "sent",
      });
    } else {
      await (prisma as any).invoiceDueReminderLog.create({
        data: {
          invoiceId: invoice.id,
          reminderNumber: decision.reminderNumber,
          recipientEmail: customerEmail,
          success: false,
          errorMessage: String(emailResult.error || "Failed to send email"),
        },
      });
      failed += 1;
      details.push({
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        reminderNumber: decision.reminderNumber,
        status: "failed",
        error: String(emailResult.error || "Failed to send email"),
      });
    }
  }

  return {
    processed: invoices.length,
    sent,
    skipped,
    failed,
    details,
  };
}

export async function resetDueReminderTracking(invoiceId: number) {
  await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      dueReminderCount: 0,
      lastDueReminderAt: null,
    },
  });
}
