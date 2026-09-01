import { PrismaClient } from "@prisma/client";
import {
  getChequeVaultUnallocatedAmount,
  recordChequeVaultExcessAsStoreCredit,
  resolveChequeVaultCustomer,
  ChequeVaultCustomerResolutionError,
} from "../lib/cheque-vault-store-credit";

const prisma = new PrismaClient();

/**
 * Backfill store credit for approved cheques with unallocated amounts.
 *
 * Run:   npx tsx scripts/repair-cheque-vault-store-credit.ts
 * Apply: npx tsx scripts/repair-cheque-vault-store-credit.ts --apply
 */
async function main() {
  const apply = process.argv.includes("--apply");

  const cheques = await prisma.chequeVault.findMany({
    where: {
      status: "APPROVED",
      isDeleted: false,
    },
    include: {
      invoiceAllocations: {
        include: {
          invoice: {
            select: {
              id: true,
              customerId: true,
              invoiceNumber: true,
            },
          },
        },
      },
    },
    orderBy: { id: "asc" },
  });

  const chequeMethod = await prisma.paymentMethodEntry.findFirst({
    where: { name: "Cheque" },
    select: { id: true },
  });

  if (!chequeMethod) {
    throw new Error('Payment method "Cheque" not found');
  }

  let repaired = 0;
  let skipped = 0;
  let totalCredit = 0;

  for (const cheque of cheques) {
    const excessAmount = getChequeVaultUnallocatedAmount(
      Number(cheque.amount),
      cheque.invoiceAllocations,
    );

    if (excessAmount <= 0.01) {
      continue;
    }

    const existingCredit = await prisma.payment.findFirst({
      where: {
        source: "store_credit_excess",
        isAbandoned: false,
        notes: { contains: `cheque vault #${cheque.id}` },
      },
      select: { id: true, paymentCode: true },
    });

    if (existingCredit) {
      console.log(
        `- SKIP #${cheque.id} (${cheque.chequeNumber}): already has ${existingCredit.paymentCode}`,
      );
      skipped += 1;
      continue;
    }

    if (!cheque.invoiceAllocations.length) {
      console.log(
        `- SKIP #${cheque.id} (${cheque.chequeNumber}): $${excessAmount.toFixed(2)} unallocated but no invoice links`,
      );
      skipped += 1;
      continue;
    }

    let customerId: number | null;
    try {
      customerId = await resolveChequeVaultCustomer(
        prisma,
        cheque.invoiceAllocations.map((allocation) => allocation.invoice),
        cheque.customerEmail,
      );
    } catch (error) {
      const message =
        error instanceof ChequeVaultCustomerResolutionError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Unknown customer resolution error";
      console.log(
        `- SKIP #${cheque.id} (${cheque.chequeNumber}): $${excessAmount.toFixed(2)} — ${message}`,
      );
      skipped += 1;
      continue;
    }

    if (!customerId) {
      console.log(
        `- SKIP #${cheque.id} (${cheque.chequeNumber}): $${excessAmount.toFixed(2)} — no customer linked to invoices`,
      );
      skipped += 1;
      continue;
    }

    const approvedBy = cheque.approvedById ?? 1;

    console.log(
      `${apply ? "REPAIR" : "DRY-RUN"} #${cheque.id} (${cheque.chequeNumber}): $${excessAmount.toFixed(2)} → customer ${customerId}`,
    );

    if (!apply) {
      repaired += 1;
      totalCredit += excessAmount;
      continue;
    }

    const result = await prisma.$transaction(async (tx) =>
      recordChequeVaultExcessAsStoreCredit(tx, {
        chequeId: cheque.id,
        chequeNumber: cheque.chequeNumber,
        chequeDate: cheque.chequeDate,
        excessAmount,
        customerId,
        methodId: chequeMethod.id,
        userId: approvedBy,
        approvedByName: "repair-cheque-vault-store-credit",
      }),
    );

    console.log(`  Created ${result.paymentRef}`);
    repaired += 1;
    totalCredit += excessAmount;
  }

  console.log(
    apply
      ? `Repaired ${repaired} cheque(s); $${totalCredit.toFixed(2)} store credit added. Skipped ${skipped}.`
      : `Dry run: ${repaired} cheque(s) would receive $${totalCredit.toFixed(2)} store credit. Skipped ${skipped}. Re-run with --apply to execute.`,
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
