import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '../../../../../lib/auth';
import Papa from 'papaparse';
import prisma from '../../../../../lib/prisma';
import {
  validatePaymentRow,
  detectPaymentDuplicates,
  PaymentRow
} from '../../../../../lib/csv-validation';

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Read file content
    const text = await file.text();

    // Parse CSV
    const parseResult = Papa.parse<PaymentRow>(text, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header: string) => header.trim(),
      transform: (value: string) => value.trim()
    });

    if (parseResult.errors.length > 0) {
      return NextResponse.json({
        error: 'CSV parsing error',
        details: parseResult.errors
      }, { status: 400 });
    }

    const rows = parseResult.data;
    
    if (rows.length === 0) {
      return NextResponse.json({
        error: 'CSV file is empty'
      }, { status: 400 });
    }

    // Validate all rows first
    const validationErrors: any[] = [];
    rows.forEach((row, index) => {
      const rowErrors = validatePaymentRow(row, index + 2);
      validationErrors.push(...rowErrors);
    });

    // Check for duplicates
    const duplicates = detectPaymentDuplicates(rows);

    if (validationErrors.length > 0 || duplicates.length > 0) {
      return NextResponse.json({
        error: 'Validation failed. All rows must be valid before upload.',
        validationErrors,
        duplicates
      }, { status: 400 });
    }

    // Look up all payment methods by name for mapping
    const allMethods = await prisma.paymentMethodEntry.findMany();
    const methodMap = new Map(allMethods.map(m => [m.name.toLowerCase(), m.id]));

    // Create all payments in a transaction
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

        // Attempt to find invoice for matching
        let invoiceId = null;
        let isMatched = false;

        if (row.invoiceNumber && row.clientName) {
          const invoice = await tx.invoice.findFirst({
            where: {
              invoiceNumber: row.invoiceNumber.trim(),
              clientName: {
                contains: row.clientName.trim(),
                mode: 'insensitive'
              }
            }
          });

          if (invoice) {
            invoiceId = invoice.id;
            isMatched = true;
          }
        }

        // Create payment
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
          }
        });

        // Create PaymentInvoiceMatch if invoice was found
        if (invoiceId) {
          await tx.paymentInvoiceMatch.create({
            data: {
              paymentId: payment.id,
              invoiceId,
              amount: payment.amount
            }
          });
          
          // Update invoice paid amount
          await tx.invoice.update({
            where: { id: invoiceId },
            data: {
              paidAmount: {
                increment: payment.amount
              }
            }
          });
          
          matchedCount++;
        } else {
          unmatchedCount++;
        }

        payments.push(payment);
      }

      return { payments, matchedCount, unmatchedCount };
    });

    const totalCount = createdPayments.payments.length;
    const message = createdPayments.matchedCount > 0
      ? `Successfully created ${totalCount} payment(s): ${createdPayments.matchedCount} matched, ${createdPayments.unmatchedCount} unmatched`
      : `Successfully created ${totalCount} unmatched payment(s)`;

    return NextResponse.json({
      success: true,
      message,
      count: totalCount,
      matchedCount: createdPayments.matchedCount,
      unmatchedCount: createdPayments.unmatchedCount,
      paymentIds: createdPayments.payments.map(p => p.id),
      notice: createdPayments.unmatchedCount > 0 
        ? 'Use Payment Matching to link unmatched payments to invoices.' 
        : null
    });

  } catch (error: any) {
    console.error('Bulk upload payments error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
