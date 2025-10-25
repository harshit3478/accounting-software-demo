import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../../../lib/prisma';
import { requireAuth } from '../../../../../lib/auth';

interface Suggestion {
  invoice: {
    id: number;
    invoiceNumber: string;
    clientName: string;
    amount: number;
    paidAmount: number;
    remaining: number;
    status: string;
    dueDate: string;
  };
  confidence: number;
  reason: string;
}

// Simple string similarity (Levenshtein distance based)
function stringSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  
  if (s1 === s2) return 1.0;
  if (s1.includes(s2) || s2.includes(s1)) return 0.8;
  
  // Simple word overlap check
  const words1 = s1.split(/\s+/);
  const words2 = s2.split(/\s+/);
  const commonWords = words1.filter(w => words2.includes(w));
  const similarity = (commonWords.length * 2) / (words1.length + words2.length);
  
  return similarity;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;
    const paymentId = parseInt(id);

    // Get the payment details
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        paymentMatches: true
      }
    });

    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    const paymentAmount = payment.amount.toNumber();
    const paymentDate = payment.paymentDate;

    // Calculate already allocated amount
    const alreadyAllocated = payment.paymentMatches.reduce((sum: number, match: any) => {
      return sum + match.amount.toNumber();
    }, 0);
    const remainingToAllocate = paymentAmount - alreadyAllocated;

    // Get all unpaid/partially paid invoices
    const invoices = await prisma.invoice.findMany({
      where: {
        status: {
          in: ['pending', 'partial', 'overdue']
        }
      },
      include: {
        payments: true,
        paymentMatches: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    const suggestions: Suggestion[] = [];

    for (const invoice of invoices) {
      // Calculate remaining balance
      const directPayments = invoice.payments.reduce((sum: number, p: any) => sum + p.amount.toNumber(), 0);
      const matchedPayments = invoice.paymentMatches.reduce((sum: number, m: any) => sum + m.amount.toNumber(), 0);
      const totalPaid = directPayments + matchedPayments;
      const remaining = invoice.amount.toNumber() - totalPaid;

      if (remaining <= 0) continue; // Skip fully paid invoices

      let confidence = 0;
      let reason = '';

      // Rule 1: Exact amount match (95% confidence)
      if (Math.abs(remainingToAllocate - remaining) < 0.01) {
        confidence = 95;
        reason = 'Exact amount match';
      }
      // Rule 2: Payment amount matches invoice total (90% confidence)
      else if (Math.abs(paymentAmount - invoice.amount.toNumber()) < 0.01) {
        confidence = 90;
        reason = 'Payment matches invoice total';
      }
      // Rule 3: Within 5% of remaining balance (80% confidence)
      else if (Math.abs(remainingToAllocate - remaining) / remaining <= 0.05) {
        confidence = 80;
        reason = 'Amount close to remaining balance';
      }
      // Rule 4: Partial payment candidate (70% confidence)
      else if (remainingToAllocate < remaining) {
        confidence = 70;
        reason = 'Possible partial payment';
      }
      // Rule 5: Date proximity bonus
      else {
        const daysDiff = Math.abs(
          (paymentDate.getTime() - invoice.createdAt.getTime()) / (1000 * 60 * 60 * 24)
        );
        if (daysDiff <= 7) {
          confidence = 60;
          reason = 'Created within same week';
        } else if (daysDiff <= 30) {
          confidence = 50;
          reason = 'Created within same month';
        }
      }

      // Boost confidence if we have client name info (from manual entry or other sources)
      // For now, we don't have client name in payment, but we can add this later

      if (confidence >= 50) {
        suggestions.push({
          invoice: {
            id: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            clientName: invoice.clientName,
            amount: invoice.amount.toNumber(),
            paidAmount: totalPaid,
            remaining,
            status: invoice.status,
            dueDate: invoice.dueDate.toISOString().split('T')[0]
          },
          confidence,
          reason
        });
      }
    }

    // Sort by confidence (highest first), then by date (newest first)
    suggestions.sort((a, b) => {
      if (b.confidence !== a.confidence) {
        return b.confidence - a.confidence;
      }
      return new Date(b.invoice.dueDate).getTime() - new Date(a.invoice.dueDate).getTime();
    });

    // Return top 5 suggestions
    return NextResponse.json({
      paymentId,
      paymentAmount,
      remainingToAllocate,
      suggestions: suggestions.slice(0, 5)
    });

  } catch (error: any) {
    console.error('Get payment suggestions error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
