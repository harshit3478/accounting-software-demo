import { NextRequest, NextResponse } from "next/server";
import prisma from "../../../../../lib/prisma";
import { requireAuth } from "../../../../../lib/auth";
import { updateInvoiceAfterPayment } from "../../../../../lib/invoice-utils";
import { applyLateFeeToInvoice } from "../../../../../lib/late-fee";
import { createOrIncrementPaymentInvoiceMatch } from "../../../../../lib/payment-invoice-match";

interface MatchRequest {
  matches: Array<{
    invoiceId: number;
    amount: number;
  }>;
  lateFeeAmount?: number;
  lateFeeWaivedReason?: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const paymentId = parseInt(id);
    const body: MatchRequest = await request.json();
    const normalizedLateFeeAmount = Number(body.lateFeeAmount ?? 0);
    const normalizedLateFeeWaivedReason =
      typeof body.lateFeeWaivedReason === "string"
        ? body.lateFeeWaivedReason.trim()
        : "";

    // Validate payment exists
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        paymentMatches: true,
      },
    });

    if (!payment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    if (payment.isAbandoned) {
      return NextResponse.json(
        { error: "Cannot match an abandoned payment to an invoice" },
        { status: 400 },
      );
    }

    // Calculate already allocated amount
    const alreadyAllocated = payment.paymentMatches.reduce((sum, match) => {
      return sum + match.amount.toNumber();
    }, 0);

    // Calculate total new allocation
    const newAllocation = body.matches.reduce(
      (sum, match) => sum + match.amount,
      0,
    );
    const totalAllocation = alreadyAllocated + newAllocation;
    const paymentAmount = payment.amount.toNumber();

    let ownerCustomerId: number | null =
      (payment as any).customerId != null
        ? Number((payment as any).customerId)
        : null;

    if (payment.source === "store_credit_excess" && !ownerCustomerId) {
      const creditTx = await (
        prisma as any
      ).customerCreditTransaction.findFirst({
        where: {
          paymentId,
          type: "credit",
        },
        orderBy: { createdAt: "desc" },
      });

      if (!creditTx?.customerId) {
        return NextResponse.json(
          {
            error: "Store credit owner could not be resolved for this payment",
          },
          { status: 400 },
        );
      }

      ownerCustomerId = creditTx.customerId;
    }

    // Validate: total allocation cannot exceed payment amount
    if (totalAllocation > paymentAmount) {
      return NextResponse.json(
        {
          error: `Total allocation ($${totalAllocation.toFixed(2)}) exceeds payment amount ($${paymentAmount.toFixed(2)})`,
        },
        { status: 400 },
      );
    }

    // Validate each match
    for (const match of body.matches) {
      if (match.amount <= 0) {
        return NextResponse.json(
          {
            error: "Match amount must be positive",
          },
          { status: 400 },
        );
      }

      // Check invoice exists and get remaining balance
      const invoice = await prisma.invoice.findUnique({
        where: { id: match.invoiceId },
        include: {
          payments: {
            where: { isAbandoned: false },
          },
          paymentMatches: {
            include: {
              payment: {
                select: { isAbandoned: true },
              },
            },
          },
        },
      });

      if (!invoice) {
        return NextResponse.json(
          {
            error: `Invoice ${match.invoiceId} not found`,
          },
          { status: 404 },
        );
      }

      if (
        ownerCustomerId !== null &&
        (!invoice.customerId || invoice.customerId !== ownerCustomerId)
      ) {
        return NextResponse.json(
          {
            error:
              "This payment can only be matched to invoices for the same customer",
          },
          { status: 400 },
        );
      }

      // Calculate invoice remaining balance
      const directPayments = invoice.payments.reduce(
        (sum, p) => sum + p.amount.toNumber(),
        0,
      );
      const matchedPayments = invoice.paymentMatches
        .filter((m) => !m.payment.isAbandoned)
        .reduce((sum, m) => sum + m.amount.toNumber(), 0);
      const totalPaid = directPayments + matchedPayments;
      const invoiceAmount = invoice.amount.toNumber();
      const remaining = invoiceAmount - totalPaid;

      // Allow small epsilon for floating point precision (1 cent)
      const EPSILON = 0.01;

      if (match.amount > remaining + EPSILON) {
        return NextResponse.json(
          {
            error: `Match amount ($${match.amount.toFixed(2)}) exceeds invoice ${invoice.invoiceNumber} remaining balance ($${remaining.toFixed(2)}). Current status: ${invoice.status}, Total paid: $${totalPaid.toFixed(2)}, Invoice amount: $${invoiceAmount.toFixed(2)}`,
          },
          { status: 400 },
        );
      }
    }

    // Create all matches in a transaction
    const createdMatches = await prisma.$transaction(async (tx) => {
      const matches = await Promise.all(
        body.matches.map(async (match) => {
          const record = await createOrIncrementPaymentInvoiceMatch(tx, {
            paymentId,
            invoiceId: match.invoiceId,
            amount: match.amount,
            userId: user.id,
          });

          return tx.paymentInvoiceMatch.findUniqueOrThrow({
            where: { id: record.id },
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
          });
        }),
      );

      // Update payment isMatched status if fully allocated
      const isFullyMatched = totalAllocation >= paymentAmount;
      const inheritCustomerId =
        !ownerCustomerId && matches[0]?.invoice
          ? (
              await tx.invoice.findUnique({
                where: { id: matches[0].invoice.id },
                select: { customerId: true },
              })
            )?.customerId
          : null;

      await tx.payment.update({
        where: { id: paymentId },
        data: {
          isMatched: isFullyMatched,
          ...(inheritCustomerId ? { customerId: inheritCustomerId } : {}),
        },
      });

      if (normalizedLateFeeWaivedReason) {
        await tx.payment.update({
          where: { id: paymentId },
          data: {
            notes: [
              payment.notes || "",
              `Late fee waived: ${normalizedLateFeeWaivedReason}`,
            ]
              .filter(Boolean)
              .join(" | "),
          },
        });
      }

      if (normalizedLateFeeAmount > 0 && body.matches.length > 0) {
        await applyLateFeeToInvoice(tx, {
          invoiceId: body.matches[0].invoiceId,
          amount: normalizedLateFeeAmount,
          userId: user.id,
          reason: null,
        });
      }

      console.log(`Payment ${paymentId} matched:`, {
        paymentAmount,
        totalAllocation,
        isFullyMatched,
        matchesCreated: matches.length,
        invoices: matches.map((m) => m.invoice.invoiceNumber),
      });

      return matches;
    });

    // Update all affected invoices (outside transaction for safety)
    const affectedInvoiceIds = [
      ...new Set(body.matches.map((m) => m.invoiceId)),
    ];
    await Promise.all(
      affectedInvoiceIds.map((invoiceId) =>
        updateInvoiceAfterPayment(invoiceId),
      ),
    );

    // Fetch updated payment
    const updatedPayment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
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
      },
    });

    // Serialize response
    const serializedPayment = {
      ...updatedPayment!,
      amount: updatedPayment!.amount.toNumber(),
      paymentMatches: updatedPayment!.paymentMatches.map((match) => ({
        ...match,
        amount: match.amount.toNumber(),
        invoice: {
          ...match.invoice,
          amount: match.invoice.amount.toNumber(),
          paidAmount: match.invoice.paidAmount.toNumber(),
        },
      })),
    };

    return NextResponse.json({
      success: true,
      payment: serializedPayment,
      matchesCreated: createdMatches.length,
    });
  } catch (error: any) {
    console.error("Match payment error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
