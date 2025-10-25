import { NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma';
import { requireAuth } from '../../../../lib/auth';

export async function GET() {
  try {
    await requireAuth();

    // Fetch all payments with their matches
    const allPayments = await prisma.payment.findMany({
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        paymentMatches: {
          include: {
            invoice: {
              select: {
                id: true,
                invoiceNumber: true,
                clientName: true,
                amount: true
              }
            }
          }
        }
      },
      orderBy: {
        paymentDate: 'asc' // Oldest first
      }
    });

    // Filter to only include payments with remaining unallocated amount
    const payments = allPayments.filter(payment => {
      const paymentAmount = payment.amount.toNumber();
      const allocatedAmount = payment.paymentMatches.reduce((sum, match) => {
        return sum + match.amount.toNumber();
      }, 0);
      const remainingAmount = paymentAmount - allocatedAmount;
      
      // Include if has remaining amount (not fully allocated)
      return remainingAmount > 0;
    });

    // Calculate summary statistics (only for unallocated amounts)
    const totalAmount = payments.reduce((sum, payment) => {
      const paymentAmount = payment.amount.toNumber();
      const allocatedAmount = payment.paymentMatches.reduce((sum, match) => {
        return sum + match.amount.toNumber();
      }, 0);
      return sum + (paymentAmount - allocatedAmount);
    }, 0);

    // Serialize Decimal values
    const serializedPayments = payments.map(payment => ({
      ...payment,
      amount: payment.amount.toNumber(),
      paymentMatches: payment.paymentMatches.map(match => ({
        ...match,
        amount: match.amount.toNumber(),
        invoice: {
          ...match.invoice,
          amount: match.invoice.amount.toNumber()
        }
      }))
    }));

    return NextResponse.json({
      payments: serializedPayments,
      summary: {
        count: payments.length,
        totalAmount
      }
    });
  } catch (error: any) {
    console.error('Fetch unmatched payments error:', error);
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
}
