import { PrismaClient } from "@prisma/client";
import { repairAbandonedStoreCreditPayment } from "../lib/abandoned-store-credit-cleanup";
import { updateInvoiceAfterPayment } from "../lib/invoice-utils";

const prisma = new PrismaClient();

/**
 * Repair invoices/customer credit state after abandoned store-credit payments.
 *
 * - Deletes stale matches still linked to abandoned payments
 * - Voids store_credit_applied rows that came from those payments
 * - Recalculates affected invoice paidAmount/status
 *
 * Run:  npx tsx scripts/repair-abandoned-store-credit.ts
 * Apply: npx tsx scripts/repair-abandoned-store-credit.ts --apply
 */
async function main() {
  const apply = process.argv.includes("--apply");

  const abandonedPayments = await prisma.payment.findMany({
    where: {
      isAbandoned: true,
      OR: [
        { source: "store_credit_excess" },
        { creditTransactions: { some: { type: "credit" } } },
      ],
    },
    include: {
      creditTransactions: true,
      paymentMatches: true,
    },
    orderBy: { id: "asc" },
  });

  const affectedInvoiceIds = new Set<number>();
  let repairedPayments = 0;

  console.log(
    `Found ${abandonedPayments.length} abandoned payment(s) with store credit history.`,
  );

  for (const payment of abandonedPayments) {
    const matchCount = payment.paymentMatches.length;
    const debitCount = payment.creditTransactions.filter(
      (tx) => tx.type === "debit" && tx.paymentId === payment.id,
    ).length;

    if (matchCount === 0 && debitCount === 0) {
      continue;
    }

    console.log(
      `- PAY-${String(payment.id).padStart(6, "0")}: ${matchCount} stale match(es), ${debitCount} applied debit(s)`,
    );

    if (!apply) {
      repairedPayments += 1;
      continue;
    }

    const invoiceIds = await prisma.$transaction(async (tx) =>
      repairAbandonedStoreCreditPayment(tx, payment, 1),
    );

    for (const invoiceId of invoiceIds) {
      affectedInvoiceIds.add(invoiceId);
    }

    repairedPayments += 1;
  }

  if (apply) {
    for (const invoiceId of affectedInvoiceIds) {
      await updateInvoiceAfterPayment(invoiceId);
    }
  }

  console.log(
    apply
      ? `Repaired ${repairedPayments} payment(s); recalculated ${affectedInvoiceIds.size} invoice(s).`
      : `Dry run: ${repairedPayments} payment(s) would be repaired. Re-run with --apply to write changes.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
