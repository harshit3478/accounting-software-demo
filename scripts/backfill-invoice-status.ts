import { type InvoiceStatus, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Backfill invoice statuses that became stale after an edit changed the invoice
 * amount without recalculating status (e.g. a discount lowered the total to be
 * fully covered by an already-recorded payment, but status stayed "partial").
 *
 * Only "live" statuses are recomputed. Inactive/abandoned invoices are skipped
 * so their lifecycle state is preserved.
 *
 * Run with: npx tsx scripts/backfill-invoice-status.ts
 * Add --apply to write changes; otherwise it runs as a dry run.
 *
 * NOTE: the status logic below is intentionally inlined (kept in sync with
 * lib/invoice-utils.ts:calculateInvoiceStatus) so this standalone script only
 * depends on @prisma/client and does not pull in the app's runtime module
 * graph (email/nodemailer/etc.), which can fail to load outside Next.js.
 */
const RECALCULABLE_STATUSES: InvoiceStatus[] = [
  "paid",
  "pending",
  "overdue",
  "partial",
];

function calculateInvoiceStatus(
  amount: number,
  paidAmount: number,
  dueDate: Date,
): InvoiceStatus {
  const EPSILON = 0.01;
  const remaining = amount - paidAmount;

  if (remaining <= EPSILON) {
    return "paid";
  }
  if (paidAmount > EPSILON && remaining > EPSILON) {
    return "partial";
  }
  if (paidAmount < EPSILON && dueDate < new Date()) {
    return "overdue";
  }
  return "pending";
}

async function main() {
  const apply = process.argv.includes("--apply");
  const batchSize = 500;
  let cursor: number | undefined;
  let scanned = 0;
  let mismatched = 0;
  let updated = 0;

  while (true) {
    const invoices = await prisma.invoice.findMany({
      where: { status: { in: RECALCULABLE_STATUSES } },
      select: {
        id: true,
        invoiceNumber: true,
        amount: true,
        paidAmount: true,
        dueDate: true,
        status: true,
      },
      orderBy: { id: "asc" },
      take: batchSize,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });

    if (invoices.length === 0) {
      break;
    }

    for (const invoice of invoices) {
      scanned += 1;
      const recalculatedStatus = calculateInvoiceStatus(
        invoice.amount.toNumber(),
        invoice.paidAmount.toNumber(),
        invoice.dueDate,
      );

      if (recalculatedStatus !== invoice.status) {
        mismatched += 1;
        console.log(
          `${invoice.invoiceNumber} (id ${invoice.id}): ${invoice.status} -> ${recalculatedStatus} ` +
            `(amount=${invoice.amount.toNumber()}, paid=${invoice.paidAmount.toNumber()})`,
        );

        if (apply) {
          await prisma.invoice.update({
            where: { id: invoice.id },
            data: { status: recalculatedStatus },
          });
          updated += 1;
        }
      }
    }

    cursor = invoices[invoices.length - 1].id;
  }

  console.log(
    `\nScanned ${scanned} invoice(s). Found ${mismatched} with stale status.`,
  );
  if (apply) {
    console.log(`Updated ${updated} invoice(s).`);
  } else {
    console.log("Dry run only. Re-run with --apply to write changes.");
  }
}

main()
  .catch((error) => {
    console.error("Backfill invoice status failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
