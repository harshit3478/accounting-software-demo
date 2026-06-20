import { NextRequest, NextResponse } from "next/server";
import prisma from "../../../../lib/prisma";
import { requireAuth } from "../../../../lib/auth";
import { updateInvoiceAfterPayment } from "../../../../lib/invoice-utils";
import { Prisma } from "@prisma/client";
import { stampPaymentCode } from "../../../../lib/payment-code";
import { createLateFeePayment } from "../../../../lib/late-fee";

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();
    const {
      paymentId,
      invoiceId,
      amount,
      lateFeeAmount,
      lateFeeReason,
      lateFeeWaivedReason,
    } = body;

    if (!paymentId || !invoiceId || !amount) {
      return NextResponse.json(
        { error: "Missing required fields: paymentId, invoiceId, amount" },
        { status: 400 },
      );
    }

    const amountToLink = new Prisma.Decimal(amount);
    const normalizedLateFeeAmount = Number(lateFeeAmount ?? 0);
    const normalizedLateFeeReason =
      typeof lateFeeReason === "string" ? lateFeeReason.trim() : "";
    const normalizedLateFeeWaivedReason =
      typeof lateFeeWaivedReason === "string" ? lateFeeWaivedReason.trim() : "";

    if (amountToLink.isNegative() || amountToLink.isZero()) {
      return NextResponse.json(
        { error: "Amount must be greater than 0" },
        { status: 400 },
      );
    }

    // Start a transaction to ensure integrity
    const result = await prisma.$transaction(async (tx) => {
      // 1. Fetch Payment and its current matches
      const payment = await tx.payment.findUnique({
        where: { id: paymentId },
        include: { paymentMatches: true },
      });

      if (!payment) {
        throw new Error("Payment not found");
      }

      // Safeguard: If payment is directly linked via invoiceId column, it considers fully used by that invoice
      if (payment.invoiceId) {
        throw new Error(
          "Payment is already directly allocated to an invoice. Cannot create additional manual links.",
        );
      }

      // Calculate available balance on payment
      const matchedAmount = payment.paymentMatches.reduce(
        (sum, match) => sum.add(match.amount),
        new Prisma.Decimal(0),
      );
      const paymentAvailable = payment.amount.sub(matchedAmount);
      const canSplitResidualIntoCredit =
        payment.paymentMatches.length === 0 &&
        payment.source !== "store_credit_excess";

      if (amountToLink.gt(paymentAvailable)) {
        throw new Error(
          `Payment has insufficient allocation remaining. Available: ${paymentAvailable}`,
        );
      }

      const remainingAfterLink = paymentAvailable.sub(amountToLink);

      // 2. Fetch Invoice
      const invoice = await tx.invoice.findUnique({
        where: { id: invoiceId },
      });

      if (!invoice) {
        throw new Error("Invoice not found");
      }

      if (
        remainingAfterLink.gt(0) &&
        canSplitResidualIntoCredit &&
        !invoice.customerId
      ) {
        throw new Error(
          "Cannot convert the remaining payment balance to store credit because this invoice has no linked customer",
        );
      }

      // Store-credit excess payments are customer-scoped and must only apply
      // to invoices belonging to the same customer.
      if (payment.source === "store_credit_excess") {
        const creditTx = await (tx as any).customerCreditTransaction.findFirst({
          where: {
            paymentId: payment.id,
            type: "credit",
          },
          orderBy: { createdAt: "desc" },
        });

        if (!creditTx?.customerId) {
          throw new Error(
            "Store credit owner could not be resolved for this payment",
          );
        }

        if (!invoice.customerId || invoice.customerId !== creditTx.customerId) {
          throw new Error(
            "This store credit can only be linked to invoices of the original customer",
          );
        }
      }

      // Calculate remaining balance on invoice
      // Note: We use paidAmount from invoice, but we should verify it implies matches
      // But updateInvoiceAfterPayment keeps it in sync.
      const invoiceRemaining = invoice.amount.sub(invoice.paidAmount);

      // Allow a small epsilon for float issues? standard practice with Decimals is exact.
      // But let's check strict greater than.
      if (amountToLink.gt(invoiceRemaining)) {
        // Optionally, we could clamp it, but for now throwing error is safer
        throw new Error(
          `Amount exceeds invoice remaining balance. Remaining: ${invoiceRemaining}`,
        );
      }

      // 3. Create the Match
      const match = await tx.paymentInvoiceMatch.create({
        data: {
          paymentId,
          invoiceId,
          amount: amountToLink,
          userId: user.id,
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

      if (normalizedLateFeeAmount > 0) {
        await createLateFeePayment(tx, {
          invoiceId,
          methodId: payment.methodId,
          paymentDate: payment.paymentDate,
          amount: normalizedLateFeeAmount,
          userId: user.id,
          reason: normalizedLateFeeReason || null,
        });

        await tx.invoice.update({
          where: { id: invoiceId },
          data: {
            amount: {
              increment: normalizedLateFeeAmount,
            },
          },
        });
      }

      // 4. If this is a regular payment and it still has remaining balance,
      // split the remainder into customer-scoped store credit so it cannot be
      // reused against unrelated invoices.
      if (remainingAfterLink.gt(0) && canSplitResidualIntoCredit) {
        await tx.payment.update({
          where: { id: paymentId },
          data: {
            amount: amountToLink,
            isMatched: true,
          },
        });

        const creditPayment = await tx.payment.create({
          data: {
            invoiceId: null,
            amount: remainingAfterLink,
            paymentDate: payment.paymentDate,
            methodId: payment.methodId,
            notes: `Store credit from excess payment on ${invoice.invoiceNumber}${payment.notes ? ` | ${payment.notes}` : ""}`,
            userId: user.id,
            isMatched: false,
            source: "store_credit_excess",
          },
        });

        await stampPaymentCode(tx, creditPayment.id);

        // NOTE: we intentionally do NOT update customer.storeCredit or create the
        // customerCreditTransaction inside this large interactive transaction to
        // avoid timeouts on slower DB connections. Instead we return the created
        // creditPayment id and remaining amount so we can perform a small follow
        // up transaction after commit.

        return {
          match,
          creditPaymentId: creditPayment.id,
          remainingAfterLink: remainingAfterLink.toString(),
          customerId: invoice.customerId,
        };
      } else {
        // Store-credit payments keep their remaining balance available for the
        // same customer, so only mark them fully matched when exhausted.
        const newMatchedTotal = matchedAmount.add(amountToLink);
        const isNowFullyMatched = newMatchedTotal.gte(payment.amount);

        if (isNowFullyMatched !== payment.isMatched) {
          await tx.payment.update({
            where: { id: paymentId },
            data: { isMatched: isNowFullyMatched },
          });
        }
      }

      if (payment.source === "store_credit_excess") {
        const ownerTx = await (tx as any).customerCreditTransaction.findFirst({
          where: { paymentId: payment.id },
          orderBy: { createdAt: "desc" },
        });

        const creditAppliedPayment = await tx.payment.create({
          data: {
            invoiceId,
            amount: amountToLink,
            paymentDate: payment.paymentDate,
            methodId: payment.methodId,
            notes: `Store credit applied (From payment ${payment.paymentCode || `#${payment.id}`})${payment.notes ? ` | ${payment.notes}` : ""}`,
            userId: user.id,
            isMatched: true,
            source: "store_credit_applied",
          },
        });

        await stampPaymentCode(tx, creditAppliedPayment.id);

        return {
          match,
          debitFromCustomerId: ownerTx?.customerId ?? null,
          debitAmount: amountToLink.toString(),
          paymentId: payment.id,
          creditAppliedPaymentId: creditAppliedPayment.id,
        };
      }

      return { match };
    });

    // If the transaction returned a created credit payment, perform a small
    // follow-up transaction to update the customer's store credit and create
    // the customerCreditTransaction record. Keeping this separate avoids long
    // interactive transactions which can time out.
    if ((result as any).creditPaymentId) {
      const payload = result as any;
      await prisma.$transaction([
        prisma.customer.update({
          where: { id: payload.customerId },
          data: {
            storeCredit: {
              increment: new Prisma.Decimal(payload.remainingAfterLink),
            },
          },
        }),
        prisma.customerCreditTransaction.create({
          data: {
            customerId: payload.customerId,
            amount: new Prisma.Decimal(payload.remainingAfterLink),
            type: "credit",
            reason: `Excess payment captured as store credit from ${invoiceId}`,
            paymentId: payload.creditPaymentId,
            invoiceId,
            createdById: user.id,
          },
        }),
      ]);
    }

    // If the transaction returned a debit instruction (using existing store
    // credit), perform a short transaction to decrement the customer's store
    // credit and record the customerCreditTransaction of type 'debit'.
    if ((result as any).debitFromCustomerId) {
      const payload = result as any;
      await prisma.$transaction([
        prisma.customer.update({
          where: { id: payload.debitFromCustomerId },
          data: {
            storeCredit: {
              decrement: new Prisma.Decimal(payload.debitAmount),
            },
          },
        }),
        prisma.customerCreditTransaction.create({
          data: {
            customerId: payload.debitFromCustomerId,
            amount: new Prisma.Decimal(payload.debitAmount),
            type: "debit",
            reason: `Applied store credit to invoice ${invoiceId}`,
            paymentId: payload.paymentId,
            invoiceId,
            createdById: user.id,
          },
        }),
      ]);
    }

    // 5. Update Invoice Status (outside transactions)
    const invoiceUpdateResult = await updateInvoiceAfterPayment(invoiceId);

    // Normalize response shape: return match
    const match = (result as any).match;
    return NextResponse.json({
      success: true,
      match,
      storeCreditAdded: invoiceUpdateResult.earlyDiscountStoreCredit,
      message:
        invoiceUpdateResult.earlyDiscountStoreCredit > 0
          ? `Payment linked. $${invoiceUpdateResult.earlyDiscountStoreCredit.toFixed(2)} saved as store credit from early payment discount.`
          : undefined,
    });
  } catch (error: any) {
    console.error("Error linking payment:", error);
    return NextResponse.json(
      { error: error.message || "Failed to link payment" },
      { status: 500 },
    );
  }
}
