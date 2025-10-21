import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import prisma from '../../../../lib/prisma';
import { requireAuth } from '../../../../lib/auth';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { clientName, items, subtotal, tax, discount, dueDate, description, isLayaway } = await request.json();
    
    const { id } = await params;
    const invoiceId = parseInt(id);

    // Check if invoice exists and user has permission
    const existingInvoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
    });

    if (!existingInvoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    if (user.role !== 'admin' && existingInvoice.userId !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Calculate total amount
    const taxAmount = tax || 0;
    const discountAmount = discount || 0;
    const totalAmount = parseFloat(subtotal) + parseFloat(taxAmount) - parseFloat(discountAmount);

    const invoice = await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        clientName,
        items: items as any, // JSON field - cast to any to bypass strict typing
        subtotal: parseFloat(subtotal),
        tax: parseFloat(taxAmount),
        discount: parseFloat(discountAmount),
        amount: totalAmount,
        dueDate: new Date(dueDate),
        description,
        isLayaway: isLayaway || false,
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

    return NextResponse.json(serializedInvoice);
  } catch (error: any) {
    console.error('Update invoice error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    
    // Only admins can delete invoices
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Only admins can delete invoices' }, { status: 403 });
    }

    const { id } = await params;
    const invoiceId = parseInt(id);

    // Check if invoice exists
    const existingInvoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        payments: true,
        paymentMatches: true,
      }
    });

    if (!existingInvoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // Delete related payment matches first
    if (existingInvoice.paymentMatches.length > 0) {
      await prisma.paymentInvoiceMatch.deleteMany({
        where: { invoiceId },
      });
    }

    // Update payments that reference this invoice (set invoiceId to null)
    if (existingInvoice.payments.length > 0) {
      await prisma.payment.updateMany({
        where: { invoiceId },
        data: { invoiceId: null },
      });
    }

    // Delete the invoice
    await prisma.invoice.delete({
      where: { id: invoiceId },
    });

    return NextResponse.json({ message: 'Invoice deleted successfully' });
  } catch (error: any) {
    console.error('Delete invoice error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
