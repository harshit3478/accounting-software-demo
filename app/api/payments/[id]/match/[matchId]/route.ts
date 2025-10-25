import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { updateInvoiceAfterPayment } from '@/lib/invoice-utils';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; matchId: string }> }
) {
  try {
    await requireAuth();
    const { id, matchId } = await params;
    const paymentId = parseInt(id);
    const matchIdInt = parseInt(matchId);

    // Find the match
    const match = await prisma.paymentInvoiceMatch.findUnique({
      where: { id: matchIdInt },
      include: {
        payment: true,
        invoice: {
          select: {
            id: true,
            invoiceNumber: true
          }
        }
      }
    });

    if (!match) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 });
    }

    // Verify match belongs to the specified payment
    if (match.paymentId !== paymentId) {
      return NextResponse.json({ error: 'Match does not belong to this payment' }, { status: 400 });
    }

    const invoiceId = match.invoiceId;

    // Delete the match
    await prisma.paymentInvoiceMatch.delete({
      where: { id: matchIdInt }
    });

    // Update payment to unmatched
    await prisma.payment.update({
      where: { id: paymentId },
      data: { isMatched: false }
    });

    // Recalculate invoice totals
    await updateInvoiceAfterPayment(invoiceId);

    // Fetch updated payment
    const updatedPayment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        paymentMatches: {
          include: {
            invoice: {
              select: {
                id: true,
                invoiceNumber: true,
                clientName: true,
                amount: true,
                paidAmount: true,
                status: true
              }
            }
          }
        }
      }
    });

    // Fetch updated invoice
    const updatedInvoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: {
        id: true,
        invoiceNumber: true,
        clientName: true,
        amount: true,
        paidAmount: true,
        status: true
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Match removed successfully',
      payment: updatedPayment ? {
        ...updatedPayment,
        amount: updatedPayment.amount.toNumber(),
        paymentMatches: updatedPayment.paymentMatches.map(m => ({
          ...m,
          amount: m.amount.toNumber(),
          invoice: {
            ...m.invoice,
            amount: m.invoice.amount.toNumber(),
            paidAmount: m.invoice.paidAmount.toNumber()
          }
        }))
      } : null,
      invoice: updatedInvoice ? {
        ...updatedInvoice,
        amount: updatedInvoice.amount.toNumber(),
        paidAmount: updatedInvoice.paidAmount.toNumber()
      } : null
    });

  } catch (error: any) {
    console.error('Unmatch payment error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
