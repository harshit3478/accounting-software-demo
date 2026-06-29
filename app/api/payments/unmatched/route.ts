import { NextRequest, NextResponse } from "next/server";
import prisma from "../../../../lib/prisma";
import { requireAuth } from "../../../../lib/auth";

export async function GET(request: NextRequest) {
  try {
    await requireAuth();

    const url = new URL(request.url);
    const customerIdParam = url.searchParams.get("customerId");
    const customerId = customerIdParam ? Number(customerIdParam) : undefined;

    // Build where clause: optionally limit to a specific customer. When
    // customerId is provided we include payments that belong to that
    // customer's invoices or are store-credit payments owned by that
    // customer (via customerCreditTransaction relation).
    const whereClause: any = {
      isMatched: false,
      isAbandoned: false,
    };

    if (customerId) {
      whereClause.OR = [
        { invoice: { customerId } },
        {
          source: "store_credit_excess",
          creditTransactions: { some: { customerId } },
        },
      ];
    }

    // Fetch payments that are not fully matched
    const allPayments = await prisma.payment.findMany({
      where: whereClause,
      include: {
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
        paymentDate: "asc", // Oldest first
      },
    });

    // Double-check and filter to only include payments with remaining unallocated amount
    const payments = allPayments.filter((payment) => {
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

    // Serialize Decimal values and add remaining amount
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
