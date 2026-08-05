import { NextRequest, NextResponse } from "next/server";
import prisma from "../../../../../lib/prisma";
import { requireAuth } from "../../../../../lib/auth";
import { invalidateDashboard } from "../../../../../lib/cache-helpers";
import { updateInvoiceAfterPayment } from "../../../../../lib/invoice-utils";
import {
  cleanupAbandonedStoreCreditPayment,
  collectInvoiceIdsAffectedByPaymentAbandon,
} from "../../../../../lib/abandoned-store-credit-cleanup";

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

    const affectedInvoiceIds = collectInvoiceIdsAffectedByPaymentAbandon(
      existingPayment,
    );

    // Start transaction to ensure consistency
    const result = await prisma.$transaction(async (tx) => {
      const updatedPayment = await tx.payment.update({
        where: { id: paymentId },
        data: {
          isAbandoned: true,
          invoiceId: null,
          abandonedAt: new Date(),
          abandonedBy: user.id,
          abandonReason: reason.trim(),
        },
        include: {
          paymentMatches: true,
          creditTransactions: true,
        },
      });

      const cleanup = await cleanupAbandonedStoreCreditPayment(tx, {
        paymentId,
        paymentCode: existingPayment.paymentCode,
        reason: reason.trim(),
        userId: user.id,
        creditTransactions: existingPayment.creditTransactions,
        paymentMatches: existingPayment.paymentMatches,
      });

      for (const invoiceId of cleanup.affectedInvoiceIds) {
        affectedInvoiceIds.add(invoiceId);
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
