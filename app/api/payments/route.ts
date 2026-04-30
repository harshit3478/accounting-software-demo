import { NextRequest, NextResponse } from "next/server";
import prisma from "../../../lib/prisma";
import { requireAuth } from "../../../lib/auth";
import { updateInvoiceAfterPayment } from "../../../lib/invoice-utils";
import { invalidateDashboard } from "../../../lib/cache-helpers";
import { sendPaymentConfirmation } from "../../../lib/email";
import { stampPaymentCode } from "../../../lib/payment-code";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(request.url);

    // Pagination params
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const skip = (page - 1) * limit;

    // Filter params
    const invoiceId = searchParams.get("invoiceId");
    const search = searchParams.get("search") || "";
    const method = searchParams.get("method") || "all";
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    let where: any = {};

    // Filter by invoiceId if provided
    if (invoiceId) {
      where.invoiceId = parseInt(invoiceId);
    }

    // Search filter
    if (search) {
      where.OR = [
        { notes: { contains: search } },
        {
          invoice: {
            OR: [
              { invoiceNumber: { contains: search } },
              { clientName: { contains: search } },
            ],
          },
        },
      ];
    }

    // Method filter (now by methodId)
    if (method !== "all") {
      const methodId = parseInt(method);
      if (!isNaN(methodId)) {
        where.methodId = methodId;
      }
    }

    // Date range filter
    if (startDate && endDate) {
      where.paymentDate = {
        gte: new Date(startDate),
        lte: new Date(new Date(endDate).setHours(23, 59, 59, 999)),
      };
    }

    // Sort params
    const sortBy = searchParams.get("sortBy") || "date";
    const sortDirection = (searchParams.get("sortDirection") || "desc") as
      | "asc"
      | "desc";

    // Build orderBy
    let orderBy: any;
    switch (sortBy) {
      case "amount":
        orderBy = { amount: sortDirection };
        break;
      case "client":
        orderBy = { invoice: { clientName: sortDirection } };
        break;
      case "date":
      default:
        orderBy = { paymentDate: sortDirection };
        break;
    }

    // Get total count
    const total = await prisma.payment.count({ where });

    const payments = await (prisma as any).payment.findMany({
      where,
      include: {
        invoice: true,
        method: true,
        editHistory: {
          orderBy: { createdAt: "desc" },
          include: {
            editedBy: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
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
            invoice: true,
          },
        },
      },
      orderBy,
      skip,
      take: limit,
    });

    // Convert Decimal to number for JSON serialization
    const serializedPayments = payments.map((payment: any) => ({
      ...payment,
      amount: payment.amount.toNumber(),
      editHistory: (payment.editHistory || []).map((entry: any) => ({
        ...entry,
        createdAt: entry.createdAt?.toISOString
          ? entry.createdAt.toISOString()
          : entry.createdAt,
      })),
      invoice: payment.invoice
        ? {
            ...payment.invoice,
            amount: payment.invoice.amount.toNumber(),
            paidAmount: payment.invoice.paidAmount.toNumber(),
            subtotal: payment.invoice.subtotal.toNumber(),
            tax: payment.invoice.tax.toNumber(),
            discount: payment.invoice.discount.toNumber(),
          }
        : null,
    }));

    return NextResponse.json({
      payments: serializedPayments,
      pagination: {
        total,
        pages: Math.ceil(total / limit),
        page,
        limit,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const { invoiceId, amount, paymentDate, methodId, notes, source } =
      await request.json();

    if (!methodId) {
      return NextResponse.json(
        { error: "Payment method is required" },
        { status: 400 },
      );
    }

    const requestedAmount = parseFloat(amount);
    if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) {
      return NextResponse.json(
        { error: "Valid amount is required" },
        { status: 400 },
      );
    }

    const roundMoney = (value: number) => Math.round(value * 100) / 100;

    let payment: any = null;
    let storeCreditAdded = 0;

    if (invoiceId) {
      const parsedInvoiceId = parseInt(invoiceId);
      const invoice = await (prisma as any).invoice.findUnique({
        where: { id: parsedInvoiceId },
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              email: true,
              storeCredit: true,
            },
          },
        },
      });

      if (!invoice) {
        return NextResponse.json(
          { error: "Invoice not found" },
          { status: 404 },
        );
      }

      const remaining = roundMoney(
        Number(invoice.amount) - Number(invoice.paidAmount),
      );
      const appliedAmount = roundMoney(
        Math.min(requestedAmount, Math.max(remaining, 0)),
      );
      const excessAmount = roundMoney(requestedAmount - appliedAmount);

      if (excessAmount > 0 && !invoice.customerId) {
        return NextResponse.json(
          {
            error:
              "Cannot store excess payment as credit because this invoice has no linked customer",
          },
          { status: 400 },
        );
      }

      const txResult = await prisma.$transaction(async (tx) => {
        let mainPayment: any = null;

        if (appliedAmount > 0) {
          mainPayment = await tx.payment.create({
            data: {
              invoiceId: parsedInvoiceId,
              amount: appliedAmount,
              paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
              methodId: parseInt(methodId),
              notes,
              userId: user.id,
              isMatched: true,
              source: source || "manual",
            },
            include: { method: true },
          });

          await stampPaymentCode(tx, mainPayment.id);
        }

        if (excessAmount > 0) {
          const creditPayment = await tx.payment.create({
            data: {
              invoiceId: null,
              amount: excessAmount,
              paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
              methodId: parseInt(methodId),
              notes: `Store credit from excess payment on ${invoice.invoiceNumber}${notes ? ` | ${notes}` : ""}`,
              userId: user.id,
              isMatched: false,
              source: "store_credit_excess",
            },
          });

          await stampPaymentCode(tx, creditPayment.id);

          await (tx as any).customer.update({
            where: { id: invoice.customerId },
            data: {
              storeCredit: {
                increment: excessAmount,
              },
            },
          });

          await (tx as any).customerCreditTransaction.create({
            data: {
              customerId: invoice.customerId,
              amount: excessAmount,
              type: "credit",
              reason: `Excess payment captured as store credit from ${invoice.invoiceNumber}`,
              paymentId: creditPayment.id,
              invoiceId: parsedInvoiceId,
              createdById: user.id,
            },
          });
        }

        return {
          payment: mainPayment,
          appliedAmount,
          excessAmount,
        };
      });

      payment = txResult.payment;
      storeCreditAdded = txResult.excessAmount;

      await updateInvoiceAfterPayment(parsedInvoiceId);

      // Fire-and-forget: email failure must never block the payment response
      const newRemaining = roundMoney(
        Math.max(remaining - txResult.appliedAmount, 0),
      );
      if (invoice.customer?.email && txResult.payment) {
        sendPaymentConfirmation(
          {
            id: txResult.payment.id,
            amount: txResult.appliedAmount,
            paymentDate: txResult.payment.paymentDate,
          },
          {
            invoiceNumber: invoice.invoiceNumber,
            amount: Number(invoice.amount),
            newRemaining,
          },
          { name: invoice.customer.name, email: invoice.customer.email },
        ).catch((err) =>
          console.error("[Email] sendPaymentConfirmation failed:", err),
        );
      }
    } else {
      payment = await prisma.payment.create({
        data: {
          invoiceId: null,
          amount: requestedAmount,
          paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
          methodId: parseInt(methodId),
          notes,
          userId: user.id,
          isMatched: false,
          source: source || "manual",
        },
        include: { method: true },
      });

      await stampPaymentCode(prisma, payment.id);
    }

    // Invalidate dashboard cache
    invalidateDashboard();

    return NextResponse.json({
      payment,
      storeCreditAdded,
      message:
        storeCreditAdded > 0
          ? `Payment recorded. $${storeCreditAdded.toFixed(2)} saved as store credit.`
          : "Payment recorded successfully",
    });
  } catch (error: any) {
    console.error("Create payment error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
