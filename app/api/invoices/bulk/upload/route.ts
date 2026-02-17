import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '../../../../../lib/auth';
import Papa from 'papaparse';
import prisma from '../../../../../lib/prisma';
import {
  validateInvoiceRow,
  detectInvoiceDuplicates,
  parseItemsToJSON,
  InvoiceRow
} from '../../../../../lib/csv-validation';
import { generateInvoiceNumber, calculateInvoiceStatus } from '../../../../../lib/invoice-utils';

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
    const parseResult = Papa.parse<InvoiceRow>(text, {
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
      const rowErrors = validateInvoiceRow(row, index + 2);
      validationErrors.push(...rowErrors);
    });

    // Check for duplicates
    const duplicates = detectInvoiceDuplicates(rows);

    if (validationErrors.length > 0 || duplicates.length > 0) {
      return NextResponse.json({
        error: 'Validation failed. All rows must be valid before upload.',
        validationErrors,
        duplicates
      }, { status: 400 });
    }

    // Create all invoices in a transaction
    const createdInvoices = await prisma.$transaction(async (tx) => {
      const invoices = [];
      
      // Get starting invoice number
      const year = new Date().getFullYear();
      const lastInvoice = await tx.invoice.findFirst({
        where: {
          invoiceNumber: {
            startsWith: `INV-${year}-`
          }
        },
        orderBy: {
          invoiceNumber: 'desc'
        }
      });
      
      let nextNumber = 1;
      if (lastInvoice) {
        const lastNumber = parseInt(lastInvoice.invoiceNumber.split('-')[2]);
        nextNumber = lastNumber + 1;
      }

      for (const row of rows) {
        const subtotal = parseFloat(row.subtotal);
        const tax = parseFloat(row.tax);
        const discount = parseFloat(row.discount);
        const amount = subtotal + tax - discount;
        const dueDate = new Date(row.dueDate);
        const isLayaway = row.isLayaway.toLowerCase() === 'true';
        const externalInvoiceNumber = row.externalInvoiceNumber?.trim() || null;

        // Generate sequential invoice number
        const invoiceNumber = `INV-${year}-${nextNumber.toString().padStart(4, '0')}`;
        nextNumber++;

        // Parse items - distribute subtotal across items
        const items = parseItemsToJSON(row.items);
        
        // Calculate price per item based on total subtotal
        if (items.length > 0) {
          const totalQuantity = items.reduce((sum: number, item: any) => sum + item.quantity, 0);
          const pricePerUnit = subtotal / totalQuantity;
          items.forEach((item: any) => {
            item.price = pricePerUnit;
          });
        }

        // Calculate initial status
        const status = calculateInvoiceStatus(amount, 0, dueDate);

        // Create invoice
        const invoice = await tx.invoice.create({
          data: {
            invoiceNumber,
            clientName: row.clientName,
            items,
            subtotal,
            tax,
            discount,
            amount,
            paidAmount: 0,
            dueDate,
            status,
            isLayaway,
            description: null,
            userId: user.id,
            externalInvoiceNumber,
            source: 'csv'
          }
        });

        invoices.push(invoice);
      }

      return invoices;
    });

    return NextResponse.json({
      success: true,
      message: `Successfully created ${createdInvoices.length} invoice(s)`,
      count: createdInvoices.length,
      invoiceIds: createdInvoices.map(inv => inv.id)
    });

  } catch (error: any) {
    console.error('Bulk upload invoices error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
