import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient, PaymentMethod } from '@prisma/client';
import { requireAuth } from '../../../lib/auth';
import { updateInvoiceAfterPayment } from '../../../lib/invoice-utils';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(request.url);
    const invoiceId = searchParams.get('invoiceId');

    let where: any = user.role === 'admin' ? {} : { userId: user.id };
    
    // Filter by invoiceId if provided
    if (invoiceId) {
      where.invoiceId = parseInt(invoiceId);
    }

    const payments = await prisma.payment.findMany({
      where,
      include: { 
        invoice: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        paymentMatches: {
          include: {
            invoice: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Convert Decimal to number for JSON serialization
    const serializedPayments = payments.map(payment => ({
      ...payment,
      amount: payment.amount.toNumber(),
      invoice: payment.invoice ? {
        ...payment.invoice,
        amount: payment.invoice.amount.toNumber(),
        paidAmount: payment.invoice.paidAmount.toNumber(),
        subtotal: payment.invoice.subtotal.toNumber(),
        tax: payment.invoice.tax.toNumber(),
        discount: payment.invoice.discount.toNumber(),
      } : null
    }));

    return NextResponse.json(serializedPayments);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const { invoiceId, amount, paymentDate, method, notes } = await request.json();

    const payment = await prisma.payment.create({
      data: {
        invoiceId: invoiceId ? parseInt(invoiceId) : null,
        amount: parseFloat(amount),
        paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
        method: method as PaymentMethod,
        notes,
        userId: user.id,
        isMatched: !!invoiceId, // If invoiceId provided, it's matched
      },
    });

    // Update invoice status if payment is linked
    if (invoiceId) {
      await updateInvoiceAfterPayment(parseInt(invoiceId));
    }

    return NextResponse.json(payment);
  } catch (error: any) {
    console.error('Create payment error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}