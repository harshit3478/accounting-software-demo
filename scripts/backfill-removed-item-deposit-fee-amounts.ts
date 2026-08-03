import { type InvoiceStatus, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Repair invoices whose amount dropped applied removed-item deposit fees after a
 * later edit (for example, removing shipping) recalculated totalAmount without
 * preserving historical removedItemDepositFee entries from edit history.
 *
 * Run with: npx tsx scripts/backfill-removed-item-deposit-fee-amounts.ts
 * Add --apply to write changes; otherwise it runs as a dry run.
 */
const RECALCULABLE_STATUSES: InvoiceStatus[] = [
  "paid",
  "pending",
  "overdue",
  "partial",
  "inactive",
];

function getAppliedRemovedItemDepositFeeTotal(
  editHistory: Array<{ changes: unknown }>,
): number {
  return Number(
    editHistory
      .reduce((sum, entry) => {
        const changes = entry.changes as {
          removedItemDepositFee?: { action?: string; amount?: number };
        } | null;
        const removedFee = changes?.removedItemDepositFee;
        if (removedFee?.action === "apply") {
          return sum + Number(removedFee.amount || 0);
        }
        return sum;
      }, 0)
      .toFixed(2),
  );
}

function getRecalculationFeeTotal(
  editHistory: Array<{ changes: unknown }>,
): number {
  return Number(
    editHistory
      .reduce((sum, entry) => {
        const changes = entry.changes as {
          recalculationFee?: { amount?: number };
        } | null;
        return sum + Number(changes?.recalculationFee?.amount || 0);
      }, 0)
      .toFixed(2),
  );
}

function computeExpectedAmount(invoice: {
  subtotal: { toNumber(): number };
  tax: { toNumber(): number };
  discount: { toNumber(): number };
  shippingFee: { toNumber(): number };
  insuranceAmount: { toNumber(): number } | null;
  layawayFee: { toNumber(): number } | null;
  editHistory: Array<{ changes: unknown }>;
}): number {
  const appliedRemovedDepositFee = getAppliedRemovedItemDepositFeeTotal(
    invoice.editHistory,
  );
  const recalculationFee = getRecalculationFeeTotal(invoice.editHistory);

  return Number(
    (
      invoice.subtotal.toNumber() +
      invoice.tax.toNumber() -
      invoice.discount.toNumber() +
      invoice.shippingFee.toNumber() +
      Number(invoice.insuranceAmount?.toNumber?.() ?? 0) +
      Number(invoice.layawayFee?.toNumber?.() ?? 0) +
      appliedRemovedDepositFee +
      recalculationFee
    ).toFixed(2),
  );
}

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
  const batchSize = 200;
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
        subtotal: true,
        tax: true,
        discount: true,
        shippingFee: true,
        insuranceAmount: true,
        layawayFee: true,
        editHistory: {
          select: { changes: true },
          orderBy: { createdAt: "asc" },
        },
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
      const appliedRemovedDepositFee = getAppliedRemovedItemDepositFeeTotal(
        invoice.editHistory,
      );
      if (appliedRemovedDepositFee <= 0) {
        continue;
      }

      const currentAmount = invoice.amount.toNumber();
      const expectedAmount = computeExpectedAmount(invoice);
      const delta = Number((expectedAmount - currentAmount).toFixed(2));

      if (Math.abs(delta) <= 0.01) {
        continue;
      }

      // Only repair the known failure mode: amount is missing applied removed
      // deposit fees that are still recorded in edit history.
      if (Math.abs(delta - appliedRemovedDepositFee) > 0.01) {
        console.log(
          `Skipping ${invoice.invoiceNumber} (id ${invoice.id}): unexpected delta ${delta.toFixed(2)} (applied removed deposit ${appliedRemovedDepositFee.toFixed(2)})`,
        );
        continue;
      }

      mismatched += 1;
      const nextStatus =
        invoice.status === "inactive"
          ? "inactive"
          : calculateInvoiceStatus(
              expectedAmount,
              invoice.paidAmount.toNumber(),
              invoice.dueDate,
            );

      console.log(
        `${invoice.invoiceNumber} (id ${invoice.id}): amount ${currentAmount.toFixed(2)} -> ${expectedAmount.toFixed(2)} ` +
          `(+${delta.toFixed(2)} removed deposit fee)` +
          (nextStatus !== invoice.status
            ? `, status ${invoice.status} -> ${nextStatus}`
            : ""),
      );

      if (apply) {
        await prisma.invoice.update({
          where: { id: invoice.id },
          data: {
            amount: expectedAmount,
            ...(nextStatus !== invoice.status ? { status: nextStatus } : {}),
          },
        });
        updated += 1;
      }
    }

    cursor = invoices[invoices.length - 1].id;
  }

  console.log(
    `\nScanned ${scanned} invoice(s). Found ${mismatched} with missing removed-item deposit fee amount.`,
  );
  if (apply) {
    console.log(`Updated ${updated} invoice(s).`);
  } else {
    console.log("Dry run only. Re-run with --apply to write changes.");
  }
}

main()
  .catch((error) => {
    console.error("Backfill removed item deposit fee amounts failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
