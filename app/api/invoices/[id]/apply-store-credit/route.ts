import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "../../../../../lib/auth";
import { hasPermission } from "../../../../../lib/permissions";
import prisma from "../../../../../lib/prisma";
import { applyAvailableStoreCreditToInvoice } from "../../../../../lib/store-credit-apply";
import { updateInvoiceAfterPayment } from "../../../../../lib/invoice-utils";
import { getInvoiceAmountDue } from "../../../../../lib/invoice-display";
import { serializeInvoiceEditHistoryEntry } from "../../../../../lib/user-display";

function money(value: { toNumber?: () => number } | number | null | undefined) {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  return Number(value.toNumber?.() ?? value);
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth();
    const { id: idParam } = await params;
    const invoiceId = parseInt(idParam, 10);

    if (!Number.isFinite(invoiceId)) {
      return NextResponse.json({ error: "Invalid invoice ID" }, { status: 400 });
    }

    const body = await request.json();
    const requestedAmount = roundMoney(Number(body?.amount));

    if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) {
      return NextResponse.json(
        { error: "Amount must be greater than 0" },
        { status: 400 },
      );
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        customer: {
          select: { id: true, name: true, storeCredit: true },
        },
      },
    });

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    if (!invoice.customerId || !invoice.customer) {
      return NextResponse.json(
        { error: "Link a customer to this invoice before applying store credit" },
        { status: 400 },
      );
    }

    if (
      invoice.status === "abandoned" &&
      !hasPermission(user, "invoices.addPaymentOnAbandoned")
    ) {
      return NextResponse.json(
        { error: "You do not have permission to add payments to abandoned invoices" },
        { status: 403 },
      );
    }

    if (invoice.status === "inactive") {
      return NextResponse.json(
        { error: "Cannot apply store credit to an inactive invoice" },
        { status: 400 },
      );
    }

    const amountDue = roundMoney(
      getInvoiceAmountDue({
        status: invoice.status,
        amount: money(invoice.amount),
        paidAmount: money(invoice.paidAmount),
        subtotal: money(invoice.subtotal),
        tax: money(invoice.tax),
        discount: money(invoice.discount),
        earlyPaymentDiscount: money(invoice.earlyPaymentDiscount),
        unitDiscountAmount: money(invoice.unitDiscountAmount),
        shippingDiscountAmount: money(invoice.shippingDiscountAmount),
        shippingFee: money(invoice.shippingFee),
        insuranceAmount: money(invoice.insuranceAmount),
        layawayFee: money(invoice.layawayFee),
        lateFee: money(invoice.lateFee),
        processingFee: money(invoice.processingFee),
        isLayaway: invoice.isLayaway,
      }),
    );
    const availableCredit = roundMoney(money(invoice.customer.storeCredit));

    if (amountDue <= 0.009) {
      return NextResponse.json(
        { error: "This invoice has no remaining balance" },
        { status: 400 },
      );
    }

    if (availableCredit <= 0.009) {
      return NextResponse.json(
        { error: "This customer has no store credit" },
        { status: 400 },
      );
    }

    if (requestedAmount > availableCredit + 0.001) {
      return NextResponse.json(
        {
          error: `Amount exceeds available store credit ($${availableCredit.toFixed(2)})`,
        },
        { status: 400 },
      );
    }

    if (requestedAmount > amountDue + 0.001) {
      return NextResponse.json(
        {
          error: `Amount exceeds the invoice balance ($${amountDue.toFixed(2)})`,
        },
        { status: 400 },
      );
    }

    const applied = await prisma.$transaction(async (tx) => {
      const result = await applyAvailableStoreCreditToInvoice(tx, {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        customerId: invoice.customerId!,
        maxAmount: requestedAmount,
        userId: user.id,
      });

      if (result.appliedAmount + 0.009 < requestedAmount) {
        throw new Error(
          `Only $${result.appliedAmount.toFixed(2)} of unmatched store credit could be applied. The customer's balance does not match open store-credit payments.`,
        );
      }

      return result;
    });

    await updateInvoiceAfterPayment(invoice.id);

    const [refreshedInvoice, refreshedCustomer, editHistoryEntry] =
      await Promise.all([
        prisma.invoice.findUnique({
          where: { id: invoice.id },
          select: { paidAmount: true, status: true, amount: true },
        }),
        prisma.customer.findUnique({
          where: { id: invoice.customerId },
          select: { storeCredit: true },
        }),
        prisma.invoiceEditHistory.create({
          data: {
            invoiceId: invoice.id,
            editedById: user.id,
            reason: `Applied $${applied.appliedAmount.toFixed(2)} store credit`,
            changes: {
              storeCreditApplied: {
                from: 0,
                to: applied.appliedAmount,
                payments: applied.payments,
              },
            },
          },
          include: {
            editedBy: {
              select: { id: true, name: true, email: true },
            },
          },
        }),
      ]);

    return NextResponse.json({
      success: true,
      appliedAmount: applied.appliedAmount,
      payments: applied.payments,
      storeCredit: roundMoney(money(refreshedCustomer?.storeCredit)),
      invoice: {
        paidAmount: roundMoney(money(refreshedInvoice?.paidAmount)),
        status: refreshedInvoice?.status,
        amount: roundMoney(money(refreshedInvoice?.amount)),
      },
      editHistoryEntry: serializeInvoiceEditHistoryEntry(editHistoryEntry),
    });
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.error("Error applying store credit:", error);
    return NextResponse.json(
      { error: error.message || "Failed to apply store credit" },
      { status: 500 },
    );
  }
}
