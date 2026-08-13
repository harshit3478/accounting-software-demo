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
        items: true,
        earlyPaymentDiscount: true,
        unitDiscountAmount: true,
        unitDiscountOffer: true,
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

    const serializedInvoices = (unpaidInvoices as any[]).map((invoice) => ({
      ...invoice,
      amount: Number(invoice.amount?.toNumber?.() ?? invoice.amount ?? 0),
      paidAmount: Number(
        invoice.paidAmount?.toNumber?.() ?? invoice.paidAmount ?? 0,
      ),
      earlyPaymentDiscount: Number(
        invoice.earlyPaymentDiscount?.toNumber?.() ??
          invoice.earlyPaymentDiscount ??
          0,
      ),
      unitDiscountAmount: Number(
        invoice.unitDiscountAmount?.toNumber?.() ??
          invoice.unitDiscountAmount ??
          0,
      ),
      unitDiscountOffer: invoice.unitDiscountOffer ?? null,
      invoiceDate:
        invoice.invoiceDate instanceof Date
          ? invoice.invoiceDate.toISOString()
          : invoice.invoiceDate,
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
