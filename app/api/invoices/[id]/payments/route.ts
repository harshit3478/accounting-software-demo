import { type NextRequest, NextResponse } from "next/server";
import prisma from "../../../../../lib/prisma";
import { requireAuth } from "../../../../../lib/auth";
import { formatPaymentCode } from "../../../../../lib/payment-code";

type PaymentMethodLike = {
  id: number;
  name: string;
  icon: string | null;
  color: string;
};

function serializePaymentRow(
  payment: {
    id: number;
    amount: { toNumber: () => number };
    source: string | null;
    paymentCode?: string | null;
    paymentDate: Date;
    notes: string | null;
    createdAt: Date;
    method: PaymentMethodLike;
    user?: { name: string | null } | null;
    isAbandoned?: boolean;
    refundProofUrl?: string | null;
  },
  extras?: { type?: "direct" | "matched"; matchId?: number },
) {
  return {
    id: payment.id,
    amount: payment.amount.toNumber(),
    source: payment.source,
    paymentCode: payment.paymentCode || formatPaymentCode(payment.id),
    method: payment.method,
    date: payment.paymentDate.toISOString(),
    notes: payment.notes,
    createdAt: payment.createdAt.toISOString(),
    createdBy: payment.user?.name || "Unknown",
    isAbandoned: payment.isAbandoned ?? false,
    isRefund: !!(payment.isAbandoned && payment.refundProofUrl),
    type: extras?.type,
    matchId: extras?.matchId,
  };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAuth();
    const { id } = await params;
    const invoiceId = parseInt(id, 10);

    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: { status: true, invoiceNumber: true },
    });

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

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
    const allPaymentsMap = new Map<number, ReturnType<typeof serializePaymentRow>>();

    for (const payment of directPayments) {
      allPaymentsMap.set(
        payment.id,
        serializePaymentRow(payment, { type: "direct" }),
      );
    }

    for (const match of matchedPayments) {
      if (allPaymentsMap.has(match.payment.id)) {
        continue;
      }

      allPaymentsMap.set(
        match.payment.id,
        serializePaymentRow(match.payment, {
          type: "matched",
          matchId: match.id,
        }),
      );
    }

    const payments = Array.from(allPaymentsMap.values()).sort(
      (a, b) => b.id - a.id,
    );

    let abandonmentRefunds: ReturnType<typeof serializePaymentRow>[] = [];
    if (invoice.status === "abandoned") {
      const refundRows = await prisma.payment.findMany({
        where: {
          isAbandoned: true,
          refundProofUrl: { not: null },
          abandonReason: {
            contains: `abandoned invoice ${invoice.invoiceNumber}`,
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
        orderBy: { id: "desc" },
      });

      abandonmentRefunds = refundRows.map((payment) =>
        serializePaymentRow(payment),
      );
    }

    return NextResponse.json({ payments, abandonmentRefunds });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Fetch invoice payments error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
