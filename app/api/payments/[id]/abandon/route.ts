import { NextRequest, NextResponse } from "next/server";
import prisma from "../../../../../lib/prisma";
import { requireAuth } from "../../../../../lib/auth";
import { invalidateDashboard } from "../../../../../lib/cache-helpers";
import { updateInvoiceAfterPayment } from "../../../../../lib/invoice-utils";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const paymentId = parseInt(id, 10);
    const body = await request.json();
    const { reason } = body;

    if (isNaN(paymentId)) {
      return NextResponse.json(
        { error: "Invalid payment ID" },
        { status: 400 },
      );
    }

    if (!reason || typeof reason !== "string" || reason.trim().length === 0) {
      return NextResponse.json(
        { error: "Abandonment reason is required" },
        { status: 400 },
      );
    }

    const existingPayment: any = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        paymentMatches: true,
        creditTransactions: true,
        invoice: true,
      },
    });

    if (!existingPayment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    if (existingPayment?.isAbandoned) {
      return NextResponse.json(
        { error: "Payment is already abandoned" },
        { status: 400 },
      );
    }

    const affectedInvoiceIds = new Set<number>();
    if (existingPayment.invoiceId) {
      affectedInvoiceIds.add(existingPayment.invoiceId);
    }
    for (const match of existingPayment.paymentMatches || []) {
      affectedInvoiceIds.add(match.invoiceId);
    }

    // Start transaction to ensure consistency
    const result = await prisma.$transaction(async (tx) => {
      // 1. Mark payment as abandoned with tracking info
      const updatedPayment = await tx.payment.update({
        where: { id: paymentId },
        data: {
          isAbandoned: true,
          invoiceId: null, // Remove from invoice
          abandonedAt: new Date(),
          abandonedBy: user.id,
          abandonReason: reason.trim(),
        },
        include: {
          paymentMatches: true,
          creditTransactions: true,
        },
      });

      // 2. If payment was linked to an invoice, remove all payment matches
      if (
        existingPayment.paymentMatches &&
        existingPayment.paymentMatches.length > 0
      ) {
        for (const match of existingPayment.paymentMatches) {
          // Delete the match
          await tx.paymentInvoiceMatch.delete({
            where: { id: match.id },
          });
        }
      }

      // 3. If payment has credit transactions, reverse them
      if (
        existingPayment.creditTransactions &&
        existingPayment.creditTransactions.length > 0
      ) {
        for (const creditTx of existingPayment.creditTransactions) {
          if (creditTx.type === "credit") {
            // Create a debit transaction to reverse the credit
            await tx.customerCreditTransaction.create({
              data: {
                customerId: creditTx.customerId,
                amount: creditTx.amount,
                type: "debit",
                reason: "Payment abandoned - reversing credit",
                paymentId: null,
                createdById: user.id,
              },
            });

            // Update customer's storeCredit
            const customer = await tx.customer.findUnique({
              where: { id: creditTx.customerId },
            });
            if (customer) {
              await tx.customer.update({
                where: { id: creditTx.customerId },
                data: {
                  storeCredit: Math.max(
                    0,
                    customer.storeCredit.toNumber() -
                      creditTx.amount.toNumber(),
                  ),
                },
              });
            }
          }
        }
      }

      return updatedPayment;
    });

    for (const invoiceId of affectedInvoiceIds) {
      await updateInvoiceAfterPayment(invoiceId);
    }

    // Invalidate caches
    await invalidateDashboard();

    return NextResponse.json({
      success: true,
      payment: result,
    });
  } catch (error) {
    console.error("Error abandoning payment:", error);
    return NextResponse.json(
      { error: "Failed to abandon payment" },
      { status: 500 },
    );
  }
}
