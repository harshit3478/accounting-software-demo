import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import prisma from '../../../../lib/prisma';
import { requireAuth } from '../../../../lib/auth';
import { invalidateDashboard } from '../../../../lib/cache-helpers';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { clientName, customerId, items, subtotal, tax, discount, dueDate, description, isLayaway } = await request.json();
    
    const { id } = await params;
    const invoiceId = parseInt(id);

    // Check if invoice exists
    const existingInvoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
    });

    if (!existingInvoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
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
        customerId: customerId !== undefined ? (customerId || null) : undefined,
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

    const { id } = await params;
    const invoiceId = parseInt(id);

    // Check if invoice exists
    const existingInvoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
    });

    if (!existingInvoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // Soft delete — set status to inactive
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: 'inactive' },
    });

    // Invalidate dashboard cache
    invalidateDashboard();

    return NextResponse.json({ message: 'Invoice deactivated successfully' });
  } catch (error: any) {
    console.error('Delete invoice error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
