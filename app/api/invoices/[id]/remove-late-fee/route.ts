import { NextRequest, NextResponse } from "next/server";
import prisma from "../../../../../lib/prisma";
import { requireAuth } from "../../../../../lib/auth";
import { removeLateFeeFromInvoice } from "../../../../../lib/late-fee";
import { updateInvoiceAfterPayment } from "../../../../../lib/invoice-utils";
import { invalidateDashboard } from "../../../../../lib/cache-helpers";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const invoiceId = parseInt(id, 10);

    if (!Number.isFinite(invoiceId)) {
      return NextResponse.json(
        { error: "Invalid invoice id" },
        { status: 400 },
      );
    }

    const { paymentId, historyEntryId, reason } = await request.json();
    const parsedPaymentId = Number(paymentId);
    const parsedHistoryEntryId = Number(historyEntryId);
    const trimmedReason = typeof reason === "string" ? reason.trim() : "";

    if (!Number.isFinite(parsedPaymentId) && !Number.isFinite(parsedHistoryEntryId)) {
      return NextResponse.json(
        { error: "Valid history entry id or payment id is required" },
        { status: 400 },
      );
    }

    if (!trimmedReason) {
      return NextResponse.json(
        { error: "Reason is required to remove a late fee" },
        { status: 400 },
      );
    }

    const removal = await prisma.$transaction(async (tx) => {
      const result = await removeLateFeeFromInvoice(tx, {
        invoiceId,
        paymentId: Number.isFinite(parsedPaymentId) ? parsedPaymentId : undefined,
        historyEntryId: Number.isFinite(parsedHistoryEntryId)
          ? parsedHistoryEntryId
          : undefined,
      });

      const historyEntry = await tx.invoiceEditHistory.create({
        data: {
          invoiceId,
          editedById: user.id,
          reason: `[Late fee removed] ${trimmedReason}`,
          changes: {
            lateFeeRemoved: {
              historyEntryId: "historyEntryId" in result ? result.historyEntryId : null,
              paymentId: "paymentId" in result ? result.paymentId : null,
              paymentCode: "paymentCode" in result ? result.paymentCode : null,
              amount: result.feeAmount,
              previousNotes:
                ("notes" in result ? result.notes : null) ??
                ("reason" in result ? result.reason : null),
              invoiceAmount: {
                from: result.previousInvoiceAmount,
                to: result.nextInvoiceAmount,
              },
            },
          },
        },
        include: {
          editedBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      return { ...result, historyEntry };
    });

    await updateInvoiceAfterPayment(invoiceId);
    invalidateDashboard();

    const updatedInvoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        layawayPlan: {
          include: {
            installments: {
              orderBy: { dueDate: "asc" },
            },
          },
        },
      },
    });

    if (!updatedInvoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      removedAmount: removal.feeAmount,
      invoice: {
        id: updatedInvoice.id,
        amount: updatedInvoice.amount.toNumber(),
        lateFee: Number((updatedInvoice as any).lateFee?.toNumber?.() ?? 0),
        paidAmount: updatedInvoice.paidAmount.toNumber(),
        status: updatedInvoice.status,
        layawayPlan: updatedInvoice.layawayPlan
          ? {
              ...updatedInvoice.layawayPlan,
              downPayment: updatedInvoice.layawayPlan.downPayment.toNumber(),
              installments: updatedInvoice.layawayPlan.installments.map(
                (inst) => ({
                  ...inst,
                  amount: inst.amount.toNumber(),
                  paidAmount: inst.paidAmount?.toNumber?.() ?? null,
                }),
              ),
            }
          : null,
      },
      editHistoryEntry: {
        id: removal.historyEntry.id,
        reason: removal.historyEntry.reason,
        createdAt: removal.historyEntry.createdAt.toISOString(),
        changes: removal.historyEntry.changes,
        editedBy: removal.historyEntry.editedBy,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
