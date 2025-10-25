import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../../../lib/prisma';
import { requireAuth } from '../../../../../lib/auth';
import { updateInvoiceAfterPayment } from '../../../../../lib/invoice-utils';

interface MatchRequest {
  matches: Array<{
    invoiceId: number;
    amount: number;
  }>;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const paymentId = parseInt(id);
    const body: MatchRequest = await request.json();

    // Validate payment exists
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        paymentMatches: true
      }
    });

    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    // Calculate already allocated amount
    const alreadyAllocated = payment.paymentMatches.reduce((sum, match) => {
      return sum + match.amount.toNumber();
    }, 0);

    // Calculate total new allocation
    const newAllocation = body.matches.reduce((sum, match) => sum + match.amount, 0);
    const totalAllocation = alreadyAllocated + newAllocation;
    const paymentAmount = payment.amount.toNumber();

    // Validate: total allocation cannot exceed payment amount
    if (totalAllocation > paymentAmount) {
      return NextResponse.json({
        error: `Total allocation ($${totalAllocation.toFixed(2)}) exceeds payment amount ($${paymentAmount.toFixed(2)})`
      }, { status: 400 });
    }

    // Validate each match
    for (const match of body.matches) {
      if (match.amount <= 0) {
        return NextResponse.json({
          error: 'Match amount must be positive'
        }, { status: 400 });
      }

      // Check invoice exists and get remaining balance
      const invoice = await prisma.invoice.findUnique({
        where: { id: match.invoiceId },
        include: {
          payments: true,
          paymentMatches: true
        }
      });

      if (!invoice) {
        return NextResponse.json({
          error: `Invoice ${match.invoiceId} not found`
        }, { status: 404 });
      }

      // Calculate invoice remaining balance
      const directPayments = invoice.payments.reduce((sum, p) => sum + p.amount.toNumber(), 0);
      const matchedPayments = invoice.paymentMatches.reduce((sum, m) => sum + m.amount.toNumber(), 0);
      const totalPaid = directPayments + matchedPayments;
      const remaining = invoice.amount.toNumber() - totalPaid;

      if (match.amount > remaining) {
        return NextResponse.json({
          error: `Match amount ($${match.amount.toFixed(2)}) exceeds invoice ${invoice.invoiceNumber} remaining balance ($${remaining.toFixed(2)})`
        }, { status: 400 });
      }
    }

    // Create all matches in a transaction
    const createdMatches = await prisma.$transaction(async (tx) => {
      const matches = await Promise.all(
        body.matches.map(match =>
          tx.paymentInvoiceMatch.create({
            data: {
              paymentId,
              invoiceId: match.invoiceId,
              amount: match.amount,
              userId: user.id
            },
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
          })
        )
      );

      // Update payment isMatched status if fully allocated
      const isFullyMatched = totalAllocation >= paymentAmount;
      await tx.payment.update({
        where: { id: paymentId },
        data: { isMatched: isFullyMatched }
      });

      return matches;
    });

    // Update all affected invoices (outside transaction for safety)
    const affectedInvoiceIds = [...new Set(body.matches.map(m => m.invoiceId))];
    await Promise.all(
      affectedInvoiceIds.map(invoiceId => updateInvoiceAfterPayment(invoiceId))
    );

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

    // Serialize response
    const serializedPayment = {
      ...updatedPayment!,
      amount: updatedPayment!.amount.toNumber(),
      paymentMatches: updatedPayment!.paymentMatches.map(match => ({
        ...match,
        amount: match.amount.toNumber(),
        invoice: {
          ...match.invoice,
          amount: match.invoice.amount.toNumber(),
          paidAmount: match.invoice.paidAmount.toNumber()
        }
      }))
    };

    return NextResponse.json({
      success: true,
      payment: serializedPayment,
      matchesCreated: createdMatches.length
    });

  } catch (error: any) {
    console.error('Match payment error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
