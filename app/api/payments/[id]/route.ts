import { NextRequest, NextResponse } from "next/server";
import prisma from "../../../../lib/prisma";
import { requireAuth } from "../../../../lib/auth";
import { updateInvoiceAfterPayment } from "../../../../lib/invoice-utils";
import { invalidateDashboard } from "../../../../lib/cache-helpers";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const paymentId = parseInt(id, 10);

    if (isNaN(paymentId)) {
      return NextResponse.json(
        { error: "Invalid payment ID" },
        { status: 400 },
      );
    }

    const { invoiceId, amount, paymentDate, methodId, notes, editReason } =
      await request.json();

    const reason = typeof editReason === "string" ? editReason.trim() : "";
    if (!reason) {
      return NextResponse.json(
        { error: "Edit reason is required" },
        { status: 400 },
      );
    }

    const existingPayment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: { paymentMatches: true },
    });

    if (!existingPayment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    const nextAmount = typeof amount === "number" ? amount : parseFloat(amount);
    if (!Number.isFinite(nextAmount) || nextAmount <= 0) {
      return NextResponse.json(
        { error: "Valid amount is required" },
        { status: 400 },
      );
    }

    const nextMethodId = parseInt(String(methodId), 10);
    if (!Number.isFinite(nextMethodId)) {
      return NextResponse.json(
        { error: "Valid payment method is required" },
        { status: 400 },
      );
    }

    const normalizedInvoiceId =
      invoiceId === null || invoiceId === undefined || invoiceId === ""
        ? null
        : parseInt(String(invoiceId), 10);

    if (normalizedInvoiceId !== null && !Number.isFinite(normalizedInvoiceId)) {
      return NextResponse.json(
        { error: "Invalid invoice ID" },
        { status: 400 },
      );
    }

    const existingAmount = existingPayment.amount.toNumber();
    const amountChanged = Math.abs(existingAmount - nextAmount) > 0.0001;
    const invoiceChanged =
      (existingPayment.invoiceId || null) !== normalizedInvoiceId;
    if (
      existingPayment.paymentMatches.length > 0 &&
      (amountChanged || invoiceChanged)
    ) {
      return NextResponse.json(
        {
          error:
            "Cannot change amount or invoice on a matched payment. Unmatch and relink first.",
        },
        { status: 400 },
      );
    }

    const nextData = {
      invoiceId: normalizedInvoiceId,
      amount: nextAmount,
      paymentDate: paymentDate
        ? new Date(paymentDate)
        : existingPayment.paymentDate,
      methodId: nextMethodId,
      notes: notes || null,
      isMatched: normalizedInvoiceId !== null,
    };

    const changes: Record<string, { from: any; to: any }> = {};
    const trackChange = (key: string, fromValue: any, toValue: any) => {
      const fromSerialized =
        fromValue instanceof Date ? fromValue.toISOString() : fromValue;
      const toSerialized =
        toValue instanceof Date ? toValue.toISOString() : toValue;
      if (JSON.stringify(fromSerialized) !== JSON.stringify(toSerialized)) {
        changes[key] = { from: fromSerialized, to: toSerialized };
      }
    };

    trackChange(
      "invoiceId",
      existingPayment.invoiceId || null,
      nextData.invoiceId,
    );
    trackChange("amount", existingAmount, nextData.amount);
    trackChange(
      "paymentDate",
      existingPayment.paymentDate,
      nextData.paymentDate,
    );
    trackChange("methodId", existingPayment.methodId, nextData.methodId);
    trackChange("notes", existingPayment.notes || null, nextData.notes || null);

    const updatedPayment = await prisma.$transaction(async (tx) => {
      const updated = await tx.payment.update({
        where: { id: paymentId },
        data: nextData,
        include: {
          method: true,
          invoice: true,
        },
      });

      await (tx as any).paymentEditHistory.create({
        data: {
          paymentId,
          editedById: user.id,
          reason,
          changes: Object.keys(changes).length > 0 ? changes : null,
        },
      });

      return updated;
    });

    // Keep invoice statuses accurate after payment edits
    if (existingPayment.invoiceId) {
      await updateInvoiceAfterPayment(existingPayment.invoiceId);
    }
    if (
      updatedPayment.invoiceId &&
      updatedPayment.invoiceId !== existingPayment.invoiceId
    ) {
      await updateInvoiceAfterPayment(updatedPayment.invoiceId);
    }

    invalidateDashboard();

    return NextResponse.json({
      ...updatedPayment,
      amount: updatedPayment.amount.toNumber(),
      invoice: updatedPayment.invoice
        ? {
            ...updatedPayment.invoice,
            subtotal: updatedPayment.invoice.subtotal.toNumber(),
            tax: updatedPayment.invoice.tax.toNumber(),
            discount: updatedPayment.invoice.discount.toNumber(),
            amount: updatedPayment.invoice.amount.toNumber(),
            paidAmount: updatedPayment.invoice.paidAmount.toNumber(),
          }
        : null,
    });
  } catch (error: any) {
    console.error("Update payment error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
