import { NextRequest, NextResponse } from "next/server";
import prisma from "../../../../../lib/prisma";
import { requireAuth } from "../../../../../lib/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAuth();
    const { id } = await params;
    const invoiceId = parseInt(id);

    // Fetch direct payments (where payment.invoiceId = invoiceId)
    const directPayments = await prisma.payment.findMany({
      where: {
        invoiceId,
        source: {
          not: "store_credit_applied",
        },
      },
      include: {
        method: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Fetch matched payments (through PaymentInvoiceMatch table)
    const matchedPayments = await prisma.paymentInvoiceMatch.findMany({
      where: { invoiceId },
      include: {
        payment: {
          include: {
            method: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    // Combine and format payments, preferring the direct row when the same
    // payment is represented in both direct and matched forms.
    const allPaymentsMap = new Map<
      number,
      {
        id: number;
        amount: number;
        method: any;
        date: string;
        notes: string | null;
        createdAt: string;
        createdBy: string;
        type: "direct" | "matched";
        matchId?: number;
      }
    >();

    for (const payment of directPayments) {
      allPaymentsMap.set(payment.id, {
        id: payment.id,
        amount: payment.amount.toNumber(),
        method: payment.method,
        date: payment.paymentDate.toISOString(),
        notes: payment.notes,
        createdAt: payment.createdAt.toISOString(),
        createdBy: payment.user?.name || "Unknown",
        type: "direct",
      });
    }

    for (const match of matchedPayments) {
      if (allPaymentsMap.has(match.payment.id)) {
        continue;
      }

      allPaymentsMap.set(match.payment.id, {
        id: match.payment.id,
        amount: match.amount.toNumber(), // Use match amount, not full payment amount
        method: match.payment.method,
        date: match.payment.paymentDate.toISOString(),
        notes: match.payment.notes,
        createdAt: match.createdAt.toISOString(),
        createdBy: match.payment.user?.name || "Unknown",
        type: "matched",
        matchId: match.id,
      });
    }

    const allPayments = Array.from(allPaymentsMap.values()).sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    return NextResponse.json(allPayments);
  } catch (error: any) {
    console.error("Fetch invoice payments error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
