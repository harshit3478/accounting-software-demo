import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma';
import { requireAuth } from '../../../../lib/auth';
import { updateInvoiceAfterPayment } from '../../../../lib/invoice-utils';
import { Prisma } from '@prisma/client';

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();
    const { paymentId, invoiceId, amount } = body;

    if (!paymentId || !invoiceId || !amount) {
      return NextResponse.json(
        { error: 'Missing required fields: paymentId, invoiceId, amount' },
        { status: 400 }
      );
    }

    const amountToLink = new Prisma.Decimal(amount);

    if (amountToLink.isNegative() || amountToLink.isZero()) {
        return NextResponse.json(
            { error: 'Amount must be greater than 0' },
            { status: 400 }
        );
    }

    // Start a transaction to ensure integrity
    const result = await prisma.$transaction(async (tx) => {
      // 1. Fetch Payment and its current matches
      const payment = await tx.payment.findUnique({
        where: { id: paymentId },
        include: { paymentMatches: true }
      });

      if (!payment) {
        throw new Error('Payment not found');
      }

      // Safeguard: If payment is directly linked via invoiceId column, it considers fully used by that invoice
      if (payment.invoiceId) {
          throw new Error('Payment is already directly allocated to an invoice. Cannot create additional manual links.');
      }

      // Calculate available balance on payment
      const matchedAmount = payment.paymentMatches.reduce(
        (sum, match) => sum.add(match.amount),
        new Prisma.Decimal(0)
      );
      const paymentAvailable = payment.amount.sub(matchedAmount);

      if (amountToLink.gt(paymentAvailable)) {
        throw new Error(`Payment has insufficient allocation remaining. Available: ${paymentAvailable}`);
      }

      // 2. Fetch Invoice
      const invoice = await tx.invoice.findUnique({
        where: { id: invoiceId }
      });

      if (!invoice) {
        throw new Error('Invoice not found');
      }

      // Calculate remaining balance on invoice
      // Note: We use paidAmount from invoice, but we should verify it implies matches
      // But updateInvoiceAfterPayment keeps it in sync.
      const invoiceRemaining = invoice.amount.sub(invoice.paidAmount);

      // Allow a small epsilon for float issues? standard practice with Decimals is exact.
      // But let's check strict greater than.
      if (amountToLink.gt(invoiceRemaining)) {
         // Optionally, we could clamp it, but for now throwing error is safer
         throw new Error(`Amount exceeds invoice remaining balance. Remaining: ${invoiceRemaining}`);
      }

      // 3. Create the Match
      const match = await tx.paymentInvoiceMatch.create({
        data: {
          paymentId,
          invoiceId,
          amount: amountToLink,
          userId: user.id
        }
      });

      // 4. Update Payment isMatched status
      // If the NEW matched amount is close/equal to total payment amount, mark as matched
      const newMatchedTotal = matchedAmount.add(amountToLink);
      // Logic: if newMatchedTotal >= payment.amount
      const isNowFullyMatched = newMatchedTotal.gte(payment.amount);
      
      if (isNowFullyMatched !== payment.isMatched) {
          await tx.payment.update({
              where: { id: paymentId },
              data: { isMatched: isNowFullyMatched }
          });
      }
      
      return match;
    });

    // 5. Update Invoice Status (Outside transaction since it uses its own logic/checks)
    // Although ideally it should be inside, updateInvoiceAfterPayment uses top-level prisma client usually, 
    // unless we pass tx. Let's see if updateInvoiceAfterPayment accepts tx.
    // It imports prisma from lib/prisma, so it uses the global one.
    // For safety, we call it after.
    await updateInvoiceAfterPayment(invoiceId);

    return NextResponse.json({ success: true, match: result });

  } catch (error: any) {
    console.error('Error linking payment:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to link payment' },
      { status: 500 }
    );
  }
}
