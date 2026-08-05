import { NextRequest, NextResponse } from "next/server";
import prisma from "../../../../../lib/prisma";
import { requireAuth } from "../../../../../lib/auth";
import { formatPaymentCode } from "../../../../../lib/payment-code";
import {
  buildAbandonPaymentPreview,
  fetchStoreCreditApplicationsForPayment,
} from "../../../../../lib/abandon-payment-preview";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAuth();
    const { id } = await params;
    const paymentId = parseInt(id, 10);

    if (isNaN(paymentId)) {
      return NextResponse.json(
        { error: "Invalid payment ID" },
        { status: 400 },
      );
    }

    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
            clientName: true,
            amount: true,
            paidAmount: true,
            status: true,
          },
        },
        paymentMatches: {
          include: {
            invoice: {
              select: {
                id: true,
                invoiceNumber: true,
                clientName: true,
                amount: true,
                paidAmount: true,
                status: true,
              },
            },
          },
        },
        creditTransactions: {
          include: {
            customer: {
              select: {
                id: true,
                name: true,
                storeCredit: true,
              },
            },
          },
        },
      },
    });

    if (!payment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    if (payment.isAbandoned) {
      return NextResponse.json(
        { error: "Payment is already abandoned" },
        { status: 400 },
      );
    }

    const paymentCode = payment.paymentCode || formatPaymentCode(payment.id);
    const storeCreditApplications =
      await fetchStoreCreditApplicationsForPayment(
        prisma,
        paymentId,
        paymentCode,
      );

    const preview = buildAbandonPaymentPreview(payment, storeCreditApplications);

    return NextResponse.json(preview);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Abandon payment preview error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
