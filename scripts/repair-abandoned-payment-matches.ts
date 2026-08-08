import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import {
  calculateInvoiceStatus,
  updateInvoiceAfterPayment,
} from "../lib/invoice-utils";

const prisma = new PrismaClient();

/**
 * Repair invoices where abandoned payments still have payment_invoice_matches
 * and paidAmount was never recalculated.
 *
 * Dry run (default): preview stale matches + before/after paidAmount & status
 * Apply: call updateInvoiceAfterPayment (deletes abandoned matches, recalculates)
 *
 * Run:   npx tsx scripts/repair-abandoned-payment-matches.ts
 * Apply: npx tsx scripts/repair-abandoned-payment-matches.ts --apply
 * One:   npx tsx scripts/repair-abandoned-payment-matches.ts --invoice=19076
 */

type PreviewRow = {
  invoiceId: number;
  invoiceNumber: string;
  clientName: string;
  amount: number;
  currentPaidAmount: number;
  currentStatus: string;
  projectedPaidAmount: number;
  projectedStatus: string;
  paidAmountDelta: number;
  staleMatches: Array<{
    matchId: number;
    paymentId: number;
    paymentCode: string | null;
    matchAmount: number;
    abandonReason: string | null;
  }>;
};

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

async function previewInvoice(invoiceId: number): Promise<PreviewRow | null> {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      payments: true,
      paymentMatches: {
        include: {
          payment: {
            select: {
              id: true,
              paymentCode: true,
              isAbandoned: true,
              abandonReason: true,
            },
          },
        },
      },
    },
  });

  if (!invoice) return null;

  const staleMatches = invoice.paymentMatches
    .filter((match) => match.payment.isAbandoned)
    .map((match) => ({
      matchId: match.id,
      paymentId: match.paymentId,
      paymentCode: match.payment.paymentCode,
      matchAmount: Number(match.amount),
      abandonReason: match.payment.abandonReason,
    }));

  if (staleMatches.length === 0) return null;

  const activeMatches = invoice.paymentMatches.filter(
    (match) => !match.payment.isAbandoned,
  );
  const directPaymentIds = new Set(invoice.payments.map((payment) => payment.id));

  const directPayments = invoice.payments
    .filter(
      (payment) =>
        !payment.isAbandoned &&
        payment.source !== "store_credit_applied" &&
        payment.source !== "late_fee",
    )
    .reduce((sum, payment) => sum + Number(payment.amount), 0);

  const matchedPayments = activeMatches
    .filter((match) => !directPaymentIds.has(match.paymentId))
    .reduce((sum, match) => sum + Number(match.amount), 0);

  const projectedPaidAmount = roundMoney(directPayments + matchedPayments);
  const currentPaidAmount = Number(invoice.paidAmount);
  const amount = Number(invoice.amount);
  const projectedStatus = calculateInvoiceStatus(
    amount,
    projectedPaidAmount,
    invoice.dueDate,
  );

  return {
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    clientName: invoice.clientName,
    amount,
    currentPaidAmount,
    currentStatus: invoice.status,
    projectedPaidAmount,
    projectedStatus,
    paidAmountDelta: roundMoney(projectedPaidAmount - currentPaidAmount),
    staleMatches,
  };
}

async function main() {
  const apply = process.argv.includes("--apply");
  const invoiceArg = process.argv.find((arg) => arg.startsWith("--invoice="));
  const invoiceFilter = invoiceArg
    ? Number.parseInt(invoiceArg.split("=")[1] ?? "", 10)
    : null;

  if (invoiceArg && (!invoiceFilter || Number.isNaN(invoiceFilter))) {
    throw new Error("Invalid --invoice value. Example: --invoice=19076");
  }

  console.log("Repair abandoned payment matches — starting...");
  console.log(
    apply ? "Mode: APPLY (will write changes)" : "Mode: dry run (no writes)",
  );

  await prisma.$connect();

  const staleMatchRows = await prisma.paymentInvoiceMatch.findMany({
    where: {
      payment: { isAbandoned: true },
      ...(invoiceFilter ? { invoiceId: invoiceFilter } : {}),
    },
    select: { invoiceId: true },
    distinct: ["invoiceId"],
    orderBy: { invoiceId: "asc" },
  });

  const invoiceIds = staleMatchRows.map((row) => row.invoiceId);
  console.log(
    `Found ${invoiceIds.length} invoice(s) with abandoned payment match(es).`,
  );

  const previews: PreviewRow[] = [];
  for (const invoiceId of invoiceIds) {
    const preview = await previewInvoice(invoiceId);
    if (preview) previews.push(preview);
  }

  if (previews.length === 0) {
    console.log("Nothing to repair.");
    return;
  }

  let totalDelta = 0;
  for (const row of previews) {
    totalDelta += row.paidAmountDelta;
    console.log("");
    console.log(
      `${row.invoiceNumber} (id ${row.invoiceId}) — ${row.clientName}`,
    );
    console.log(
      `  amount=${row.amount.toFixed(2)}  paidAmount ${row.currentPaidAmount.toFixed(2)} -> ${row.projectedPaidAmount.toFixed(2)}  (delta ${row.paidAmountDelta.toFixed(2)})`,
    );
    console.log(
      `  status ${row.currentStatus} -> ${row.projectedStatus}`,
    );
    for (const match of row.staleMatches) {
      console.log(
        `  - stale match #${match.matchId}: ${match.paymentCode ?? `payment ${match.paymentId}`} $${match.matchAmount.toFixed(2)}` +
          (match.abandonReason ? ` (${match.abandonReason})` : ""),
      );
    }
  }

  console.log("");
  console.log(
    `Summary: ${previews.length} invoice(s); total paidAmount delta ${roundMoney(totalDelta).toFixed(2)}`,
  );

  if (!apply) {
    console.log("Dry run only. Re-run with --apply to write changes.");
    return;
  }

  console.log("");
  console.log("Applying via updateInvoiceAfterPayment...");
  for (const row of previews) {
    await updateInvoiceAfterPayment(row.invoiceId);
    const after = await prisma.invoice.findUnique({
      where: { id: row.invoiceId },
      select: {
        invoiceNumber: true,
        paidAmount: true,
        status: true,
      },
    });
    console.log(
      `  ${after?.invoiceNumber}: paidAmount=${Number(after?.paidAmount).toFixed(2)} status=${after?.status}`,
    );
  }

  console.log("Apply complete.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
