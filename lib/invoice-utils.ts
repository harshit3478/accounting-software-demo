import prisma from "./prisma";
import {
  creditEarlyDiscountOverpaymentAsStoreCredit,
  getEarlyPaymentDiscountSettingSnapshot,
  maybeApplyEarlyPaymentDiscount,
  roundMoney,
} from "./early-payment-discount";
import {
  creditUnitDiscountOverpaymentAsStoreCredit,
  maybeApplyUnitDiscount,
} from "./unit-discount";
import { resetDueReminderTracking } from "./due-reminders";

/**
 * Generates a unique invoice number in format: INV-YYYY-NNNN
 * Example: INV-2025-0001
 */
export async function generateInvoiceNumber(tx?: any): Promise<string> {
  const year = new Date().getFullYear();
  const db = tx || prisma;

  // Get the last invoice number for this year
  const lastInvoice = await db.invoice.findFirst({
    where: {
      invoiceNumber: {
        startsWith: `INV-${year}-`,
      },
    },
    orderBy: {
      invoiceNumber: "desc",
    },
  });

  let nextNumber = 1;

  if (lastInvoice) {
    // Extract the number part and increment
    const lastNumber = parseInt(lastInvoice.invoiceNumber.split("-")[2]);
    nextNumber = lastNumber + 1;
  }

  // Format with leading zeros (0001, 0002, etc.)
  const formattedNumber = nextNumber.toString().padStart(4, "0");

  return `INV-${year}-${formattedNumber}`;
}

/**
 * Calculate invoice status based on paid amount and due date
 *
 * Note: Uses a small epsilon (0.01) for floating-point comparison to handle
 * precision issues with currency calculations. This means amounts within $0.01
 * are considered equal.
 */
export function calculateInvoiceStatus(
  amount: number,
  paidAmount: number,
  dueDate: Date,
): "paid" | "pending" | "overdue" | "partial" {
  const now = new Date();

  // Use epsilon for floating-point comparison (0.01 = 1 cent tolerance)
  const EPSILON = 0.01;
  const remaining = amount - paidAmount;

  // Invoice is fully paid if remaining is <= epsilon (accounting for floating point)
  if (remaining <= EPSILON) {
    return "paid";
  }

  // Invoice is partially paid if some payment made but still has remaining balance
  if (paidAmount > EPSILON && remaining > EPSILON) {
    return "partial";
  }

  // Invoice is overdue if no payment made and past due date
  if (paidAmount < EPSILON && dueDate < now) {
    return "overdue";
  }

  // Default to pending (no payment, not yet overdue)
  return "pending";
}

/**
 * Update invoice status and paid amount after a payment is added, removed, or modified
 *
 * This function:
 * 1. Calculates total paid from both direct payments and payment matches
 * 2. Determines the correct invoice status
 * 3. Updates the invoice in the database
 * 4. Handles overpayment scenarios (logs warning for future credit note implementation)
 *
 * @param invoiceId - The ID of the invoice to update
 * @returns Promise with optional store credit added from early discount overpayment
 */
export async function updateInvoiceAfterPayment(
  invoiceId: number,
): Promise<{ earlyDiscountStoreCredit: number }> {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      payments: true,
      paymentMatches: {
        include: {
          payment: {
            select: {
              paymentDate: true,
              isAbandoned: true,
            },
          },
        },
      },
    },
  });

  if (!invoice) {
    console.warn(`updateInvoiceAfterPayment: Invoice ${invoiceId} not found`);
    return { earlyDiscountStoreCredit: 0 };
  }

  // Remove stale matches left on abandoned payments (e.g. re-linked after abandon).
  const invalidMatchIds = invoice.paymentMatches
    .filter((match) => match.payment.isAbandoned)
    .map((match) => match.id);
  if (invalidMatchIds.length > 0) {
    await prisma.paymentInvoiceMatch.deleteMany({
      where: { id: { in: invalidMatchIds } },
    });
    invoice.paymentMatches = invoice.paymentMatches.filter(
      (match) => !match.payment.isAbandoned,
    );
  }

  // Calculate total paid amount from direct payments and payment matches.
  // Prefer the direct payment row when a payment is represented in both forms.
  const directPaymentIds = new Set(
    invoice.payments.map((payment) => payment.id),
  );
  const directPayments = invoice.payments
    .filter(
      (payment) =>
        !payment.isAbandoned &&
        payment.source !== "store_credit_applied" &&
        payment.source !== "late_fee",
    )
    .reduce((sum, p) => sum + Number(p.amount), 0);
  const matchedPayments = invoice.paymentMatches
    .filter(
      (match) =>
        !match.payment.isAbandoned && !directPaymentIds.has(match.paymentId),
    )
    .reduce((sum, m) => sum + Number(m.amount), 0);
  const totalPaid = directPayments + matchedPayments;

  // Convert invoice amount to number for comparison
  const invoiceAmount = Number(invoice.amount);
  const overpayment = totalPaid - invoiceAmount;

  // Calculate new status based on total paid and due date
  const newStatus = calculateInvoiceStatus(
    invoiceAmount,
    totalPaid,
    invoice.dueDate,
  );

  // Log the update for debugging
  console.log(`Updating invoice ${invoice.invoiceNumber}:`, {
    amount: invoiceAmount,
    previousPaidAmount: Number(invoice.paidAmount),
    newPaidAmount: totalPaid,
    directPayments,
    matchedPayments,
    previousStatus: invoice.status,
    newStatus,
    remaining: invoiceAmount - totalPaid,
  });

  // TODO: Handle overpayment with credit notes
  // If overpayment > $0.01, consider creating a credit note for the customer
  if (overpayment > 0.01) {
    console.warn(
      `⚠️ Overpayment detected on invoice ${invoice.invoiceNumber}:`,
      {
        invoiceAmount,
        totalPaid,
        overpayment: overpayment.toFixed(2),
        clientName: invoice.clientName,
        suggestion:
          "Consider implementing credit note functionality to track this overpayment",
      },
    );
    // Future enhancement: Create a credit note record
    // await createCreditNote({ invoiceId, amount: overpayment, reason: 'Overpayment' });
  }

  // Update invoice with new paid amount and status
  await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      paidAmount: totalPaid,
      status: newStatus,
    },
  });

  const earlyPaymentSetting = await getEarlyPaymentDiscountSettingSnapshot();
  const discountApplied = await prisma.$transaction(async (tx) => {
    const unitDiscountApplied = await maybeApplyUnitDiscount(tx, {
      invoice: {
        ...invoice,
        paidAmount: totalPaid,
      },
      totalPaid,
    });

    const amountAfterUnitDiscount = unitDiscountApplied
      ? roundMoney(Math.max(invoiceAmount - unitDiscountApplied, 0))
      : invoiceAmount;

    const earlyDiscountApplied = await maybeApplyEarlyPaymentDiscount(tx, {
      invoice: {
        ...invoice,
        amount: amountAfterUnitDiscount,
        paidAmount: totalPaid,
      },
      totalPaid,
      setting: earlyPaymentSetting,
    });

    return { unitDiscountApplied, earlyDiscountApplied };
  });

  let finalInvoiceAmount = invoiceAmount;
  let earlyDiscountStoreCredit = 0;
  const appliedUnitDiscount = discountApplied.unitDiscountApplied;
  const appliedEarlyDiscount = discountApplied.earlyDiscountApplied;

  if (appliedUnitDiscount) {
    finalInvoiceAmount = Math.max(invoiceAmount - appliedUnitDiscount, 0);
    console.log(
      `Applied unit discount of $${appliedUnitDiscount.toFixed(2)} on invoice ${invoice.invoiceNumber}`,
    );
  }

  if (appliedEarlyDiscount) {
    finalInvoiceAmount = Math.max(
      finalInvoiceAmount - appliedEarlyDiscount,
      0,
    );
    console.log(
      `Applied early payment discount of $${appliedEarlyDiscount.toFixed(2)} on invoice ${invoice.invoiceNumber}`,
    );
  }

  if (appliedUnitDiscount || appliedEarlyDiscount) {
    const adjustedStatus = calculateInvoiceStatus(
      finalInvoiceAmount,
      totalPaid,
      invoice.dueDate,
    );

    await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: adjustedStatus,
      },
    });

    const overpaymentAfterDiscount = roundMoney(totalPaid - finalInvoiceAmount);
    if (overpaymentAfterDiscount > 0.01 && invoice.customerId) {
      const latestPayment = [...invoice.payments]
        .filter(
          (payment) =>
            payment.source !== "store_credit_applied" &&
            payment.source !== "late_fee",
        )
        .sort(
          (left, right) =>
            new Date(right.paymentDate).getTime() -
            new Date(left.paymentDate).getTime(),
        )[0];

      let methodId: number | undefined = latestPayment?.methodId;
      if (!methodId) {
        const fallbackMethod = await prisma.paymentMethodEntry.findFirst({
          where: { isActive: true },
          orderBy: { sortOrder: "asc" },
        });
        methodId = fallbackMethod?.id;
      }

      if (methodId) {
        const creditUserId = latestPayment?.userId;
        if (!creditUserId) {
          console.warn(
            `Discount overpayment on ${invoice.invoiceNumber} could not be credited: no user available for audit trail`,
          );
        } else {
          const creditInput = {
            customerId: invoice.customerId,
            invoiceId: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            amount: overpaymentAfterDiscount,
            methodId,
            userId: creditUserId,
          };
          earlyDiscountStoreCredit = appliedEarlyDiscount
            ? await creditEarlyDiscountOverpaymentAsStoreCredit(creditInput)
            : await creditUnitDiscountOverpaymentAsStoreCredit(creditInput);

          if (earlyDiscountStoreCredit > 0) {
            console.log(
              `Credited $${earlyDiscountStoreCredit.toFixed(2)} store credit from discount on invoice ${invoice.invoiceNumber}`,
            );
          }
        }
      } else {
        console.warn(
          `Discount overpayment on ${invoice.invoiceNumber} could not be credited: no payment method available`,
        );
      }
    }
  }

  const finalStatus =
    appliedUnitDiscount || appliedEarlyDiscount
      ? calculateInvoiceStatus(finalInvoiceAmount, totalPaid, invoice.dueDate)
      : newStatus;

  if (finalStatus === "paid") {
    await resetDueReminderTracking(invoiceId);
  }

  // Auto-mark layaway installments as paid based on total paid amount
  if (invoice.isLayaway) {
    await syncLayawayInstallments(invoiceId, totalPaid);
  }

  return { earlyDiscountStoreCredit };
}

/**
 * Sync layaway installment paid status based on total amount paid on the invoice.
 *
 * Walks through installments in due-date order, marking them as paid (with today's date)
 * until the cumulative installment total exceeds the total paid amount.
 * If a previously-paid installment should now be unpaid (e.g. payment was deleted),
 * it will be reverted.
 */
async function syncLayawayInstallments(invoiceId: number, totalPaid: number) {
  const plan = await prisma.layawayPlan.findUnique({
    where: { invoiceId },
    include: { installments: { orderBy: { dueDate: "asc" } } },
  });

  if (!plan || plan.isCancelled) return;

  let runningTotal = 0;
  const EPSILON = 0.01;
  const today = new Date();

  for (const inst of plan.installments) {
    const instAmount = Number(inst.amount);
    runningTotal += instAmount;

    if (runningTotal <= totalPaid + EPSILON) {
      // This installment should be marked as paid
      if (!inst.isPaid) {
        await prisma.layawayInstallment.update({
          where: { id: inst.id },
          data: {
            isPaid: true,
            paidDate: today,
            paidAmount: instAmount,
          },
        });
      }
    } else {
      // This installment should NOT be marked as paid
      if (inst.isPaid) {
        await prisma.layawayInstallment.update({
          where: { id: inst.id },
          data: {
            isPaid: false,
            paidDate: null,
            paidAmount: null,
          },
        });
      }
    }
  }
}
