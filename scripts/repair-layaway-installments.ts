import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import {
  previewLayawayInstallmentRepair,
  repairLayawayInstallmentsForInvoice,
  type LayawayInstallmentRepairPreview,
} from "../lib/repair-layaway-installments";

const prisma = new PrismaClient();
const BATCH_SIZE = 100;

/**
 * Repair layaway installment rows that were built from remaining balance
 * instead of the full invoice total (e.g. $33.41 instead of ~$360.91).
 *
 * - Recalculates installment amounts from invoice.amount + plan settings
 * - Reconciles isPaid / paidAmount from invoice.paidAmount (due-date order)
 * - Creates missing unpaid installments and removes extra unpaid rows
 *
 * Run:  npx tsx scripts/repair-layaway-installments.ts
 * Apply: npx tsx scripts/repair-layaway-installments.ts --apply
 * One invoice: npx tsx scripts/repair-layaway-installments.ts --invoice=17307
 */
async function main() {
  const apply = process.argv.includes("--apply");
  const invoiceArg = process.argv.find((arg) => arg.startsWith("--invoice="));
  const invoiceFilter = invoiceArg
    ? Number.parseInt(invoiceArg.split("=")[1] ?? "", 10)
    : null;

  if (invoiceArg && (!invoiceFilter || Number.isNaN(invoiceFilter))) {
    throw new Error("Invalid --invoice value. Example: --invoice=17307");
  }

  console.log("Repair layaway installments — starting...");
  console.log(
    apply
      ? "Mode: APPLY (will write changes)"
      : "Mode: dry run (no writes)",
  );

  console.log("Connecting to database...");
  await prisma.$connect();
  console.log("Connected.");

  if (invoiceFilter) {
    console.log(`Filtering to invoice id ${invoiceFilter}.`);
  }

  const previews: LayawayInstallmentRepairPreview[] = [];
  let scanned = 0;
  let cursor: number | undefined;

  while (true) {
    console.log(
      cursor
        ? `Fetching layaway invoices after id ${cursor}...`
        : "Fetching layaway invoices...",
    );

    const invoices = await prisma.invoice.findMany({
      where: {
        isLayaway: true,
        ...(invoiceFilter ? { id: invoiceFilter } : {}),
        layawayPlan: {
          is: {
            installments: {
              some: {},
            },
          },
        },
      },
      select: {
        id: true,
        invoiceNumber: true,
        amount: true,
        paidAmount: true,
        invoiceDate: true,
        isLayaway: true,
        status: true,
        layawayPlan: {
          select: {
            id: true,
            months: true,
            paymentFrequency: true,
            downPayment: true,
            isCancelled: true,
            installments: {
              orderBy: { dueDate: "asc" },
            },
          },
        },
      },
      orderBy: { id: "asc" },
      take: invoiceFilter ? 1 : BATCH_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });

    if (invoices.length === 0) {
      break;
    }

    for (const invoice of invoices) {
      scanned += 1;
      const plan = invoice.layawayPlan;
      if (!plan) continue;

      const preview = previewLayawayInstallmentRepair(
        invoice,
        plan,
        plan.installments,
      );

      if (preview) {
        previews.push(preview);
      }
    }

    console.log(
      `  scanned ${scanned} invoice(s), ${previews.length} need repair so far`,
    );

    cursor = invoices[invoices.length - 1]?.id;

    if (invoiceFilter || invoices.length < BATCH_SIZE) {
      break;
    }
  }

  console.log(
    `\nScanned ${scanned} layaway invoice(s); ${previews.length} need repair.`,
  );

  if (previews.length === 0) {
    return;
  }

  for (const preview of previews) {
    console.log(
      `\n- ${preview.invoiceNumber} (id ${preview.invoiceId}): schedule ${preview.scheduleSumBefore.toFixed(2)} -> ${preview.scheduleSumAfter.toFixed(2)} (invoice ${preview.invoiceAmount.toFixed(2)}, paid ${preview.paidAmount.toFixed(2)})`,
    );

    for (const change of preview.changes) {
      const parts = [
        `${change.label}: amount ${change.amount.from.toFixed(2)} -> ${change.amount.to.toFixed(2)}`,
      ];

      if (change.isPaid) {
        parts.push(
          `paid ${change.isPaid.from ? "yes" : "no"} -> ${change.isPaid.to ? "yes" : "no"}`,
        );
      }

      console.log(`  • ${parts.join("; ")}`);
    }

    if (preview.createdInstallments.length > 0) {
      console.log(
        `  • create ${preview.createdInstallments.length} missing installment(s)`,
      );
    }

    if (preview.removedInstallmentIds.length > 0) {
      console.log(
        `  • remove ${preview.removedInstallmentIds.length} extra unpaid installment(s)`,
      );
    }
  }

  if (!apply) {
    console.log(
      `\nDry run: ${previews.length} invoice(s) would be repaired. Re-run with --apply to write changes.`,
    );
    return;
  }

  let repaired = 0;

  for (const preview of previews) {
    console.log(`Applying repair for ${preview.invoiceNumber}...`);
    await prisma.$transaction(async (tx) => {
      await repairLayawayInstallmentsForInvoice(tx, preview.invoiceId);
    });
    repaired += 1;
  }

  console.log(`\nRepaired ${repaired} layaway invoice(s).`);
}

main()
  .catch((error) => {
    console.error("Repair failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
