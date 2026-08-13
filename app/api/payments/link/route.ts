import { NextRequest, NextResponse } from "next/server";
import prisma from "../../../../lib/prisma";
import { requireAuth } from "../../../../lib/auth";
import { updateInvoiceAfterPayment } from "../../../../lib/invoice-utils";
import { Prisma } from "@prisma/client";
import { stampPaymentCode } from "../../../../lib/payment-code";
import { applyLateFeeToInvoice } from "../../../../lib/late-fee";
import { recordStoreCreditApplication } from "../../../../lib/store-credit-apply";
import { createOrIncrementPaymentInvoiceMatch } from "../../../../lib/payment-invoice-match";
import { applyPaymentOverageAsProcessingFee } from "../../../../lib/processing-fee";
import { getCreditCardProcessingFeeSuggestion } from "../../../../lib/processing-fee-client";

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
      applyOverageAsProcessingFee,
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
    const shouldApplyProcessingFee = applyOverageAsProcessingFee === true;

    if (amountToLink.isNegative() || amountToLink.isZero()) {
      return NextResponse.json(
        { error: "Amount must be greater than 0" },
        { status: 400 },
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({
        where: { id: paymentId },
        include: {
          paymentMatches: true,
          method: { select: { id: true, name: true } },
        },
      });

      if (!payment) {
        throw new Error("Payment not found");
      }

      if (payment.isAbandoned) {
        throw new Error("Cannot link an abandoned payment to an invoice");
      }

      if (payment.invoiceId) {
        throw new Error(
          "Payment is already directly allocated to an invoice. Cannot create additional manual links.",
        );
      }

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
          "Cannot convert the remaining payment balance because this invoice has no linked customer",
        );
      }

      let paymentCustomerId =
        (payment as any).customerId != null
          ? Number((payment as any).customerId)
          : null;

      if (payment.source === "store_credit_excess" && !paymentCustomerId) {
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

        paymentCustomerId = creditTx.customerId;
      }

      if (paymentCustomerId) {
        if (!invoice.customerId || invoice.customerId !== paymentCustomerId) {
          throw new Error(
            "This payment can only be linked to invoices of the same customer",
          );
        }
      } else if (invoice.customerId) {
        await tx.payment.update({
          where: { id: paymentId },
          data: { customerId: invoice.customerId },
        });
        paymentCustomerId = invoice.customerId;
      }

      const invoiceRemaining = invoice.amount.sub(invoice.paidAmount);

      if (amountToLink.gt(invoiceRemaining)) {
        throw new Error(
          `Amount exceeds invoice remaining balance. Remaining: ${invoiceRemaining}`,
        );
      }

      const match = await createOrIncrementPaymentInvoiceMatch(tx, {
        paymentId,
        invoiceId,
        amount: amountToLink,
        userId: user.id,
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
        await applyLateFeeToInvoice(tx, {
          invoiceId,
          amount: normalizedLateFeeAmount,
          userId: user.id,
          reason: normalizedLateFeeReason || null,
        });
      }

      if (remainingAfterLink.gt(0) && canSplitResidualIntoCredit) {
        const remainingNumber = Number(remainingAfterLink.toFixed(2));
        const feeSuggestion = getCreditCardProcessingFeeSuggestion({
          paymentTotal: Number(payment.amount),
          amountToLink: Number(amountToLink),
          paymentAvailable: Number(paymentAvailable),
          quickbooksId: payment.quickbooksId,
          source: payment.source,
          methodName: payment.method?.name,
        });

        if (shouldApplyProcessingFee) {
          if (!feeSuggestion.eligible) {
            throw new Error(
              "Credit card processing fee can only be suggested when the leftover is at most 7% of the payment total for QuickBooks or card payments",
            );
          }

          await tx.payment.update({
            where: { id: paymentId },
            data: {
              amount: amountToLink,
              isMatched: true,
            },
          });

          await applyPaymentOverageAsProcessingFee(tx, {
            invoiceId,
            invoiceNumber: invoice.invoiceNumber,
            methodId: payment.methodId,
            paymentDate: payment.paymentDate,
            amount: remainingNumber,
            userId: user.id,
          });

          return {
            match,
            processingFeeApplied: remainingNumber,
            customerId: invoice.customerId,
          };
        }

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
            customerId: invoice.customerId,
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

        return {
          match,
          creditPaymentId: creditPayment.id,
          remainingAfterLink: remainingAfterLink.toString(),
          customerId: invoice.customerId,
        };
      } else {
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
        await recordStoreCreditApplication(tx, {
          paymentId: payment.id,
          invoiceId,
          invoiceNumber: invoice.invoiceNumber,
          amount: amountToLink.toNumber(),
          customerId: invoice.customerId!,
          userId: user.id,
        });

        return { match };
      }

      return { match };
    });

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

    const invoiceUpdateResult = await updateInvoiceAfterPayment(invoiceId);

    const match = (result as any).match;
    const processingFeeApplied = Number(
      (result as any).processingFeeApplied || 0,
    );
    const residualStoreCredit = Number(
      (result as any).remainingAfterLink || 0,
    );
    const storeCreditAdded =
      Math.round(
        (residualStoreCredit + invoiceUpdateResult.earlyDiscountStoreCredit) *
          100,
      ) / 100;
    return NextResponse.json({
      success: true,
      match,
      processingFeeApplied:
        processingFeeApplied > 0 ? processingFeeApplied : undefined,
      storeCreditAdded,
      message:
        processingFeeApplied > 0
          ? `$${processingFeeApplied.toFixed(2)} applied as credit card processing fee.`
          : storeCreditAdded > 0
            ? `Payment linked. $${storeCreditAdded.toFixed(2)} saved as store credit.`
            : undefined,
    });
  } catch (error: any) {
    console.error("Error linking payment:", error);

    if (error?.code === "P2002") {
      return NextResponse.json(
        {
          error:
            "This payment is already linked to this invoice. Refresh the page and try again.",
        },
        { status: 409 },
      );
    }

    return NextResponse.json(
      { error: error.message || "Failed to link payment" },
      { status: 500 },
    );
  }
}
