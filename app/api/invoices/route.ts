import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../lib/prisma';
import { requireAuth } from '../../../lib/auth';
import { generateInvoiceNumber, calculateInvoiceStatus } from '../../../lib/invoice-utils';
import { invalidateDashboard } from '../../../lib/cache-helpers';

export async function GET() {
  try {
    const user = await requireAuth();

    const invoices = await prisma.invoice.findMany({
      include: { 
        payments: true,
        paymentMatches: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Convert Decimal to number for JSON serialization
    const serializedInvoices = invoices.map(invoice => ({
      ...invoice,
      subtotal: invoice.subtotal.toNumber(),
      tax: invoice.tax.toNumber(),
      discount: invoice.discount.toNumber(),
      amount: invoice.amount.toNumber(),
      paidAmount: invoice.paidAmount.toNumber(),
      payments: invoice.payments.map(payment => ({
        ...payment,
        amount: payment.amount.toNumber()
      }))
    }));

    return NextResponse.json(serializedInvoices);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const { clientName, items, subtotal, tax, discount, dueDate, description, isLayaway } = await request.json();

    // Generate unique invoice number
    const invoiceNumber = await generateInvoiceNumber();

    // Calculate total amount
    const taxAmount = tax || 0;
    const discountAmount = discount || 0;
    const totalAmount = parseFloat(subtotal) + parseFloat(taxAmount) - parseFloat(discountAmount);

    const invoice = await prisma.invoice.create({
      data: {
        userId: user.id,
        invoiceNumber,
        clientName,
        items: items || null,
        subtotal: parseFloat(subtotal),
        tax: parseFloat(taxAmount),
        discount: parseFloat(discountAmount),
        amount: totalAmount,
        paidAmount: 0,
        dueDate: new Date(dueDate),
        status: 'pending',
        isLayaway: isLayaway || false,
        description,
      },
    });

    // Convert Decimal to number for response
    const serializedInvoice = {
      ...invoice,
      subtotal: invoice.subtotal.toNumber(),
      tax: invoice.tax.toNumber(),
      discount: invoice.discount.toNumber(),
      amount: invoice.amount.toNumber(),
      paidAmount: invoice.paidAmount.toNumber(),
    };

    // Invalidate dashboard cache
    invalidateDashboard();

    return NextResponse.json(serializedInvoice);
  } catch (error: any) {
    console.error('Create invoice error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}