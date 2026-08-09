import { NextRequest, NextResponse } from "next/server";
import prisma from "../../../../lib/prisma";
import { requireAuth } from "../../../../lib/auth";

export async function GET(request: NextRequest) {
  try {
    await requireAuth();

    const url = new URL(request.url);
    const customerIdParam = url.searchParams.get("customerId");
    const customerId = customerIdParam ? Number(customerIdParam) : undefined;
    // Legacy + QB payments often have no customerId yet — include those when linking.
    const includeUnassigned =
      url.searchParams.get("includeUnassigned") === "true" ||
      url.searchParams.get("includeQuickbooks") === "true";

    const whereClause: any = {
      isMatched: false,
      isAbandoned: false,
    };

    if (customerId && Number.isFinite(customerId)) {
      const customerScoped: any[] = [
        { customerId },
        { invoice: { customerId } },
        {
          source: "store_credit_excess",
          creditTransactions: { some: { customerId } },
        },
      ];

      if (includeUnassigned) {
        customerScoped.push({ customerId: null });
      }

      whereClause.OR = customerScoped;
    } else if (includeUnassigned) {
      // Invoice has no customer yet — show unmatched payments without a customer
      whereClause.customerId = null;
    }

    const allPayments = await prisma.payment.findMany({
      where: whereClause,
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        method: {
          select: {
            id: true,
            name: true,
            icon: true,
            color: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
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
              },
            },
          },
        },
        creditTransactions: {
          select: {
            id: true,
            customerId: true,
            amount: true,
            type: true,
          },
        },
      },
      orderBy: {
        paymentDate: "asc",
      },
    });

    const payments = allPayments.filter((payment) => {
      const paymentAmount = payment.amount.toNumber();
      const allocatedAmount = payment.paymentMatches.reduce((sum, match) => {
        return sum + match.amount.toNumber();
      }, 0);
      return paymentAmount - allocatedAmount > 0;
    });

    const totalAmount = payments.reduce((sum, payment) => {
      const paymentAmount = payment.amount.toNumber();
      const allocatedAmount = payment.paymentMatches.reduce((sum, match) => {
        return sum + match.amount.toNumber();
      }, 0);
      return sum + (paymentAmount - allocatedAmount);
    }, 0);

    const serializedPayments = payments.map((payment) => {
      const paymentAmount = payment.amount.toNumber();
      const allocatedAmount = payment.paymentMatches.reduce((sum, match) => {
        return sum + match.amount.toNumber();
      }, 0);
      const remainingAmount = paymentAmount - allocatedAmount;

      return {
        ...payment,
        amount: paymentAmount,
        allocatedAmount,
        remainingAmount,
        paymentMatches: payment.paymentMatches.map((match) => ({
          ...match,
          amount: match.amount.toNumber(),
          invoice: {
            ...match.invoice,
            amount: match.invoice.amount.toNumber(),
          },
        })),
      };
    });

    return NextResponse.json({
      payments: serializedPayments,
      summary: {
        count: payments.length,
        totalAmount,
      },
    });
  } catch (error: any) {
    console.error("Fetch unmatched payments error:", error);
    const status = error.message === "Unauthorized" ? 401 : 403;
    return NextResponse.json({ error: error.message }, { status });
  }
}
