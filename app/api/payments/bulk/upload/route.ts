import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '../../../../../lib/auth';
import Papa from 'papaparse';
import prisma from '../../../../../lib/prisma';
import { PaymentMethod } from '@prisma/client';
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

    // Create all payments in a transaction
    // All payments will be unmatched (isMatched=false, invoiceId=null)
    const createdPayments = await prisma.$transaction(async (tx) => {
      const payments = [];

      for (const row of rows) {
        const amount = parseFloat(row.amount);
        const paymentDate = new Date(row.paymentDate);
        const method = row.method.toLowerCase() as PaymentMethod;

        const payment = await tx.payment.create({
          data: {
            amount,
            paymentDate,
            method,
            notes: null,
            userId: user.id,
            invoiceId: null,
            isMatched: false // Unmatched - requires manual matching
          }
        });

        payments.push(payment);
      }

      return payments;
    });

    return NextResponse.json({
      success: true,
      message: `Successfully created ${createdPayments.length} unmatched payment(s)`,
      count: createdPayments.length,
      paymentIds: createdPayments.map(p => p.id),
      notice: 'All payments are unmatched. Use Payment Matching to link them to invoices.'
    });

  } catch (error: any) {
    console.error('Bulk upload payments error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
