import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient, Prisma } from '@prisma/client';
import { requireAuth } from '../../../../lib/auth';

const prisma = new PrismaClient();

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

    // Prepare update data with proper typing
    const updateData: Prisma.InvoiceUpdateInput = {
      clientName,
      subtotal: parseFloat(subtotal),
      tax: parseFloat(taxAmount),
      discount: parseFloat(discountAmount),
      amount: totalAmount,
      dueDate: new Date(dueDate),
      description,
      isLayaway: isLayaway || false,
    };

    // Add items separately with proper JSON typing
    if (items) {
      updateData.items = items as Prisma.InputJsonValue;
    } else {
      updateData.items = Prisma.DbNull;
    }

    const invoice = await prisma.invoice.update({
      where: { id: invoiceId },
      data: updateData,
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
