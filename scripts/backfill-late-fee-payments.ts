import { PrismaClient } from "@prisma/client";
import { updateInvoiceAfterPayment } from "../lib/invoice-utils";
import { computeInvoiceLineItemTotal } from "../lib/invoice-display";

const prisma = new PrismaClient();
const DRY_RUN = process.env.DRY_RUN === "1" || process.env.DRY_RUN === "true";

type InvoiceLike = {
  subtotal: number;
  tax: number;
  discount: number;
  earlyPaymentDiscount: number;
  shippingFee: number;
  insuranceAmount: number;
  layawayFee: number;
  processingFee: number;
  isLayaway: boolean;
  amount: number;
  payments: Array<{ source: string; amount: number }>;
};

function toInvoiceLike(invoice: {
  subtotal: unknown;
  tax: unknown;
  discount: unknown;
  earlyPaymentDiscount: unknown;
  shippingFee: unknown;
  insuranceAmount: unknown;
  layawayFee: unknown;
  processingFee: unknown;
  isLayaway: boolean;
  amount: unknown;
  payments: Array<{ source: string; amount: unknown }>;
}): InvoiceLike {
  return {
    subtotal: Number(invoice.subtotal),
    tax: Number(invoice.tax),
    discount: Number(invoice.discount),
    earlyPaymentDiscount: Number(invoice.earlyPaymentDiscount),
    shippingFee: Number(invoice.shippingFee),
    insuranceAmount: Number(invoice.insuranceAmount),
    layawayFee: Number(invoice.layawayFee),
    processingFee: Number(invoice.processingFee),
    isLayaway: invoice.isLayaway,
    amount: Number(invoice.amount),
    payments: invoice.payments.map((payment) => ({
      source: payment.source,
      amount: Number(payment.amount),
    })),
  };
}

/** Invoice total from line items, excluding late fees entirely. */
function computeBaseAmountWithoutLateFee(invoice: InvoiceLike): number {
  return computeInvoiceLineItemTotal({
    ...invoice,
    lateFee: 0,
    payments: invoice.payments.filter((payment) => payment.source !== "late_fee"),
  });
}

/** Expected total = base line items + stored lateFee column (already net of removals). */
function computeExpectedTotal(invoice: InvoiceLike, lateFee: number): number {
  return Number((computeBaseAmountWithoutLateFee(invoice) + lateFee).toFixed(2));
}

async function getMigratedPaymentIds(invoiceId: number): Promise<Set<number>> {
  const entries = await prisma.invoiceEditHistory.findMany({
    where: { invoiceId },
    select: { changes: true },
  });

  const ids = new Set<number>();
  for (const entry of entries) {
    const changes = entry.changes as {
      lateFeeApplied?: { migratedFromPaymentId?: number };
    } | null;
    const paymentId = Number(changes?.lateFeeApplied?.migratedFromPaymentId ?? 0);
    if (paymentId > 0) {
      ids.add(paymentId);
    }
  }
  return ids;
}

async function migrateLegacyLateFeePayments() {
  const lateFeePayments = await prisma.payment.findMany({
    where: { source: "late_fee" },
    select: {
      id: true,
      invoiceId: true,
      amount: true,
      notes: true,
      paymentCode: true,
      userId: true,
    },
    orderBy: { id: "asc" },
  });

  if (lateFeePayments.length === 0) {
    console.log("Phase 1: No legacy late_fee payments found — nothing to migrate.");
    return { migratedPayments: 0, affectedInvoices: 0 };
  }

  console.log(
    `Phase 1: Found ${lateFeePayments.length} legacy late_fee payment(s) to migrate.`,
  );
  console.log(
    "  Note: Waived late fees are NOT migrated (they were never stored as late_fee payments).",
  );

  const paymentsByInvoice = new Map<number, typeof lateFeePayments>();
  for (const payment of lateFeePayments) {
    if (!payment.invoiceId) continue;
    const list = paymentsByInvoice.get(payment.invoiceId) || [];
    list.push(payment);
    paymentsByInvoice.set(payment.invoiceId, list);
  }

  let migratedPayments = 0;

  for (const [invoiceId, payments] of paymentsByInvoice.entries()) {
    const migratedIds = await getMigratedPaymentIds(invoiceId);
    const toMigrate = payments.filter(
      (payment) => !migratedIds.has(payment.id),
    );

    if (toMigrate.length < payments.length) {
      console.log(
        `  Invoice ${invoiceId}: skipping ${payments.length - toMigrate.length} already-migrated payment(s)`,
      );
    }

    if (toMigrate.length === 0) continue;

    const totalLateFee = toMigrate.reduce(
      (sum, payment) => sum + Number(payment.amount),
      0,
    );

    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: { invoiceNumber: true, lateFee: true },
    });

    if (!invoice) {
      console.warn(`  Skip invoice ${invoiceId}: not found`);
      continue;
    }

    console.log(
      `  Invoice ${invoice.invoiceNumber}: migrate ${toMigrate.length} late_fee payment(s), total $${totalLateFee.toFixed(2)}`,
    );

    if (DRY_RUN) {
      migratedPayments += toMigrate.length;
      continue;
    }

    await prisma.$transaction(async (tx) => {
      const currentLateFee = Number(
        (
          await tx.invoice.findUnique({
            where: { id: invoiceId },
            select: { lateFee: true },
          })
        )?.lateFee ?? 0,
      );
      const nextLateFee = Number((currentLateFee + totalLateFee).toFixed(2));

      if (nextLateFee > currentLateFee) {
        await tx.invoice.update({
          where: { id: invoiceId },
          data: { lateFee: nextLateFee },
        });
      }

      for (const payment of toMigrate) {
        const amount = Number(payment.amount);
        const reason =
          payment.notes?.replace(/^Late fee:\s*/i, "") || "Late fee applied";

        await tx.invoiceEditHistory.create({
          data: {
            invoiceId,
            editedById: payment.userId,
            reason: `[Backfill] Late fee applied: ${reason}`,
            changes: {
              lateFeeApplied: {
                amount,
                reason,
                migratedFromPaymentId: payment.id,
                migratedFromPaymentCode: payment.paymentCode,
              },
            },
          },
        });

        await tx.payment.delete({ where: { id: payment.id } });
      }
    });

    await updateInvoiceAfterPayment(invoiceId);
    migratedPayments += toMigrate.length;
  }

  return {
    migratedPayments,
    affectedInvoices: paymentsByInvoice.size,
  };
}

/**
 * Fix invoices where lateFee is stored but amount was recalculated without it.
 * Only bumps amount when the gap matches the missing late-fee portion.
 */
async function repairInvoiceAmountsMissingLateFee() {
  const invoicesWithLateFee = await prisma.invoice.findMany({
    where: { lateFee: { gt: 0 } },
    include: { payments: { select: { source: true, amount: true } } },
  });

  if (invoicesWithLateFee.length === 0) {
    console.log("Phase 2: No invoices with lateFee > 0 — nothing to repair.");
    return { repairedInvoices: 0 };
  }

  console.log(
    `Phase 2: Checking ${invoicesWithLateFee.length} invoice(s) with lateFee > 0 for amount repair.`,
  );

  let repairedInvoices = 0;

  for (const invoice of invoicesWithLateFee) {
    const lateFee = Number(invoice.lateFee);
    const storedAmount = Number(invoice.amount);
    const invoiceLike = toInvoiceLike(invoice);
    const expectedTotal = computeExpectedTotal(invoiceLike, lateFee);
    const missingLateFee = Number((expectedTotal - storedAmount).toFixed(2));

    // Only repair when amount is short by roughly the late-fee portion (not other drift).
    if (missingLateFee <= 0.009 || Math.abs(missingLateFee - lateFee) > 0.02) {
      continue;
    }

    console.log(
      `  Invoice ${invoice.invoiceNumber}: repair amount $${storedAmount.toFixed(2)} -> $${expectedTotal.toFixed(2)} (missing late fee $${missingLateFee.toFixed(2)})`,
    );

    if (DRY_RUN) {
      repairedInvoices += 1;
      continue;
    }

    await prisma.invoice.update({
      where: { id: invoice.id },
      data: { amount: expectedTotal },
    });
    await updateInvoiceAfterPayment(invoice.id);
    repairedInvoices += 1;
  }

  return { repairedInvoices };
}

async function main() {
  if (DRY_RUN) {
    console.log("DRY RUN — no database changes will be made.\n");
  }

  console.log("=== Late fee backfill ===");
  console.log("This script does NOT apply new late fees to overdue installments.");
  console.log("It only:");
  console.log("  1) Moves old late_fee *payment* records into invoice.lateFee");
  console.log("  2) Repairs invoice.amount when it is missing that lateFee\n");

  const phase1 = await migrateLegacyLateFeePayments();
  const phase2 = await repairInvoiceAmountsMissingLateFee();

  console.log("\n=== Summary ===");
  console.log(`Phase 1 migrated payments: ${phase1.migratedPayments}`);
  console.log(`Phase 2 repaired invoices:  ${phase2.repairedInvoices}`);
  if (DRY_RUN) {
    console.log("\nRe-run without DRY_RUN=1 to apply changes.");
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
