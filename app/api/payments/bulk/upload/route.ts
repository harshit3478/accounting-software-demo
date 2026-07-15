import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "../../../../../lib/auth";
import prisma from "../../../../../lib/prisma";
import { stampPaymentCode } from "../../../../../lib/payment-code";
import { updateInvoiceAfterPayment } from "../../../../../lib/invoice-utils";
import {
  validatePaymentRow,
  detectPaymentDuplicates,
} from "../../../../../lib/csv-validation";
import { parsePaymentSpreadsheet } from "../../../../../lib/payment-bulk-sheet";

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();

    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const rows = await parsePaymentSpreadsheet(file);

    if (rows.length === 0) {
      return NextResponse.json(
        {
          error: "File is empty",
        },
        { status: 400 },
      );
    }

    const activeMethods = await prisma.paymentMethodEntry.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    });
    const validMethodNames = activeMethods.map((method) => method.name);
    const methodMap = new Map(
      activeMethods.map((m) => [m.name.toLowerCase(), m.id]),
    );

    const validationErrors: any[] = [];
    rows.forEach((row, index) => {
      const rowErrors = validatePaymentRow(row, index + 2, validMethodNames);
      validationErrors.push(...rowErrors);
    });

    const duplicates = detectPaymentDuplicates(rows);

    if (validationErrors.length > 0 || duplicates.length > 0) {
      return NextResponse.json(
        {
          error: "Validation failed. All rows must be valid before upload.",
          validationErrors,
          duplicates,
        },
        { status: 400 },
      );
    }

    const createdPayments = await prisma.$transaction(async (tx) => {
      const payments = [];
      let matchedCount = 0;
      let unmatchedCount = 0;

      for (const row of rows) {
        const amount = parseFloat(row.amount);
        const paymentDate = new Date(row.paymentDate);
        const methodId = methodMap.get(row.method.toLowerCase());

        if (!methodId) {
          throw new Error(`Unknown payment method: ${row.method}`);
        }

        let invoiceId = null;
        let isMatched = false;

        if (row.invoiceNumber && row.clientName) {
          const invoice = await tx.invoice.findFirst({
            where: {
              invoiceNumber: row.invoiceNumber.trim(),
              clientName: {
                contains: row.clientName.trim(),
              },
            },
          });

          if (invoice) {
            invoiceId = invoice.id;
            isMatched = true;
          }
        }

        const payment = await tx.payment.create({
          data: {
            amount,
            paymentDate,
            methodId,
            notes: row.notes?.trim() || null,
            userId: user.id,
            invoiceId,
            isMatched,
            source: "csv_upload",
          },
        });

        await stampPaymentCode(tx, payment.id);

        if (invoiceId) {
          await tx.paymentInvoiceMatch.create({
            data: {
              paymentId: payment.id,
              invoiceId,
              amount: payment.amount,
              userId: user.id,
            },
          });

          matchedCount++;
        } else {
          unmatchedCount++;
        }

        payments.push(payment);
      }

      const matchedInvoiceIds = [
        ...new Set(
          payments
            .filter((p) => p.invoiceId != null)
            .map((p) => p.invoiceId as number),
        ),
      ];
      return { payments, matchedCount, unmatchedCount, matchedInvoiceIds };
    });

    for (const invoiceId of createdPayments.matchedInvoiceIds) {
      await updateInvoiceAfterPayment(invoiceId);
    }

    const totalCount = createdPayments.payments.length;
    const message =
      createdPayments.matchedCount > 0
        ? `Successfully created ${totalCount} payment(s): ${createdPayments.matchedCount} matched, ${createdPayments.unmatchedCount} unmatched`
        : `Successfully created ${totalCount} unmatched payment(s)`;

    return NextResponse.json({
      success: true,
      message,
      count: totalCount,
      matchedCount: createdPayments.matchedCount,
      unmatchedCount: createdPayments.unmatchedCount,
      paymentIds: createdPayments.payments.map((p) => p.id),
      notice:
        createdPayments.unmatchedCount > 0
          ? "Use Payment Matching to link unmatched payments to invoices."
          : null,
    });
  } catch (error: any) {
    console.error("Bulk upload payments error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
