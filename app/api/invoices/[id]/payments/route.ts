import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../../../lib/prisma';
import { requireAuth } from '../../../../../lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;
    const invoiceId = parseInt(id);

    // Fetch direct payments (where payment.invoiceId = invoiceId)
    const directPayments = await prisma.payment.findMany({
      where: { invoiceId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    // Fetch matched payments (through PaymentInvoiceMatch table)
    const matchedPayments = await prisma.paymentInvoiceMatch.findMany({
      where: { invoiceId },
      include: {
        payment: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          }
        }
      }
    });

    // Combine and format payments
    const allPayments = [
      // Direct payments
      ...directPayments.map(payment => ({
        id: payment.id,
        amount: payment.amount.toNumber(),
        method: payment.method,
        date: payment.paymentDate.toISOString(),
        notes: payment.notes,
        createdAt: payment.createdAt.toISOString(),
        createdBy: payment.user?.name || 'Unknown',
        type: 'direct' as const
      })),
      // Matched payments
      ...matchedPayments.map(match => ({
        id: match.payment.id,
        amount: match.amount.toNumber(), // Use match amount, not full payment amount
        method: match.payment.method,
        date: match.payment.paymentDate.toISOString(),
        notes: match.payment.notes,
        createdAt: match.createdAt.toISOString(),
        createdBy: match.payment.user?.name || 'Unknown',
        type: 'matched' as const,
        matchId: match.id
      }))
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json(allPayments);
  } catch (error: any) {
    console.error('Fetch invoice payments error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
