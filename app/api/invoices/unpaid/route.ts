import { NextRequest, NextResponse } from "next/server";
import prisma from "../../../../lib/prisma";
import { requireAuth } from "../../../../lib/auth";

export async function GET(request: NextRequest) {
  try {
    await requireAuth();

    const customerIdParam = request.nextUrl.searchParams.get("customerId");
    const customerId = customerIdParam ? Number(customerIdParam) : undefined;
    const includeUnassigned =
      request.nextUrl.searchParams.get("includeUnassigned") === "true";

    const unpaidInvoices = await prisma.invoice.findMany({
      where: {
        status: {
          in: ["pending", "partial", "overdue"],
        },
        ...(customerId && Number.isFinite(customerId)
          ? includeUnassigned
            ? { OR: [{ customerId }, { customerId: null }] }
            : { customerId }
          : {}),
      },
      select: {
        id: true,
        invoiceNumber: true,
        clientName: true,
        amount: true,
        paidAmount: true,
        dueDate: true,
        invoiceDate: true,
        earlyPaymentDiscount: true,
        status: true,
        customerId: true,
        isLayaway: true,
        layawayPlan: {
          select: {
            id: true,
            invoiceId: true,
            isCancelled: true,
            installments: {
              select: {
                id: true,
                label: true,
                dueDate: true,
                amount: true,
                isPaid: true,
              },
              orderBy: {
                dueDate: "asc",
              },
            },
          },
        },
      },
      orderBy: {
        dueDate: "asc", // Due soonest first
      },
    });

    const serializedInvoices = unpaidInvoices.map((invoice) => ({
      ...invoice,
      amount: invoice.amount.toNumber(),
      paidAmount: invoice.paidAmount.toNumber(),
      earlyPaymentDiscount: invoice.earlyPaymentDiscount.toNumber(),
      invoiceDate: invoice.invoiceDate.toISOString(),
    }));

    return NextResponse.json(serializedInvoices);
  } catch (error) {
    console.error("Error fetching unpaid invoices:", error);
    return NextResponse.json(
      { error: "Failed to fetch invoices" },
      { status: 500 },
    );
  }
}
