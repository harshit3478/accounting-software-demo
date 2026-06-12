import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { hasPermission, isSuperAdmin, requireAuth } from "@/lib/auth";
import {
  canDeleteChequeRequest,
  canEditChequeRequest,
  canLinkInvoicesOnCheque,
  isChequeRequestReadOnly,
  isChequeVaultReviewer,
} from "@/lib/cheque-vault-permissions";
import { isLinkableInvoiceStatus } from "@/lib/invoice-linkable-status";
import { deleteFromR2 } from "@/lib/r2-client";

function serializeCheque(cheque: any) {
  return {
    ...cheque,
    amount: Number(cheque.amount),
    invoiceAllocations: (cheque.invoiceAllocations || []).map((a: any) => ({
      ...a,
      allocatedAmount: Number(a.allocatedAmount),
      invoice: a.invoice
        ? {
            ...a.invoice,
            amount: Number(a.invoice.amount),
            paidAmount: Number(a.invoice.paidAmount),
          }
        : null,
    })),
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const chequeId = parseInt(id);

    if (isNaN(chequeId)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const cheque = await prisma.chequeVault.findUnique({
      where: { id: chequeId },
      include: {
        uploadedBy: { select: { id: true, name: true, email: true } },
        approvedBy: { select: { id: true, name: true } },
        invoiceAllocations: {
          include: {
            invoice: {
              select: {
                id: true,
                invoiceNumber: true,
                clientName: true,
                amount: true,
                paidAmount: true,
                status: true,
                payments: {
                  where: { isAbandoned: false },
                  select: {
                    id: true,
                    paymentCode: true,
                    amount: true,
                    paymentDate: true,
                    source: true,
                    method: { select: { name: true } },
                  },
                  orderBy: { createdAt: "desc" },
                },
              },
            },
          },
        },
      },
    });

    if (!cheque) {
      return NextResponse.json({ error: "Cheque not found" }, { status: 404 });
    }

    return NextResponse.json({ cheque: serializeCheque(cheque) });
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[cheque-vault/[id] GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const chequeId = parseInt(id);

    if (isNaN(chequeId)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const body = await request.json();
    const { invoices, chequeNumber, payorName, payeeName, amount, chequeDate, bankName, customerEmail } = body;

    const cheque = await prisma.chequeVault.findUnique({ where: { id: chequeId } });
    if (!cheque) {
      return NextResponse.json({ error: "Cheque not found" }, { status: 404 });
    }

    if (isChequeRequestReadOnly(cheque)) {
      return NextResponse.json(
        { error: "Approved or rejected cheques cannot be modified" },
        { status: 400 },
      );
    }

    const wantsFieldUpdate =
      chequeNumber !== undefined ||
      payorName !== undefined ||
      payeeName !== undefined ||
      amount !== undefined ||
      chequeDate !== undefined ||
      bankName !== undefined ||
      customerEmail !== undefined;
    const wantsInvoiceUpdate = invoices !== undefined;

    const canApprove = hasPermission(user, "chequeVault.approve");
    const reviewer = isChequeVaultReviewer({
      isSuperAdmin: isSuperAdmin(user),
      canApprove,
    });

    if (reviewer) {
      if (wantsFieldUpdate) {
        return NextResponse.json(
          { error: "Reviewers can only link invoices, not edit cheque details" },
          { status: 403 },
        );
      }
      if (
        wantsInvoiceUpdate &&
        !canLinkInvoicesOnCheque(cheque, user.id, {
          isSuperAdmin: isSuperAdmin(user),
          canApprove,
        })
      ) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      if (!wantsInvoiceUpdate) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    } else {
      if (cheque.uploadedById !== user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      if (wantsFieldUpdate && !canEditChequeRequest(cheque, user.id)) {
        return NextResponse.json(
          { error: "You can only edit your own pending requests" },
          { status: 403 },
        );
      }
      if (
        wantsInvoiceUpdate &&
        !canLinkInvoicesOnCheque(cheque, user.id, { canApprove: false })
      ) {
        return NextResponse.json(
          { error: "You can only link invoices on your own pending requests" },
          { status: 403 },
        );
      }
    }

    const updateData: any = {};

    // Invoice allocations update
    if (invoices !== undefined) {
      const allocationList: { invoiceId: number; allocatedAmount: number }[] = invoices;

      if (allocationList.length > 0) {
        // Validate all invoices exist and are in a linkable status
        for (const alloc of allocationList) {
          const inv = await prisma.invoice.findUnique({
            where: { id: alloc.invoiceId },
            select: { id: true, status: true },
          });
          if (!inv) {
            return NextResponse.json({ error: `Invoice ${alloc.invoiceId} not found` }, { status: 404 });
          }
          if (!isLinkableInvoiceStatus(inv.status)) {
            return NextResponse.json(
              {
                error: `Invoice ${alloc.invoiceId} must be unpaid (pending, partial, or overdue)`,
              },
              { status: 400 },
            );
          }
        }

        // Replace all allocations atomically
        await prisma.$transaction([
          prisma.chequeVaultInvoice.deleteMany({ where: { chequeVaultId: chequeId } }),
          prisma.chequeVaultInvoice.createMany({
            data: allocationList.map((a) => ({
              chequeVaultId: chequeId,
              invoiceId: a.invoiceId,
              allocatedAmount: a.allocatedAmount,
            })),
          }),
        ]);
      } else {
        // Clear all allocations
        await prisma.chequeVaultInvoice.deleteMany({ where: { chequeVaultId: chequeId } });
      }
    }

    // Field updates
    if (chequeNumber !== undefined) updateData.chequeNumber = chequeNumber;
    if (payorName !== undefined) updateData.payorName = payorName;
    else if (payeeName !== undefined) updateData.payorName = payeeName; // backwards compat
    if (amount !== undefined) updateData.amount = parseFloat(amount);
    if (chequeDate !== undefined) updateData.chequeDate = new Date(chequeDate);
    if (bankName !== undefined) updateData.bankName = bankName;
    if (customerEmail !== undefined) updateData.customerEmail = customerEmail || null;

    // Re-submit after correction: reset status to PENDING
    if (cheque.status === "NEEDS_CORRECTION" && Object.keys(updateData).length > 0) {
      updateData.status = "PENDING";
      updateData.correctionNote = null;
    }

    const updated = await prisma.chequeVault.update({
      where: { id: chequeId },
      data: updateData,
      include: {
        uploadedBy: { select: { id: true, name: true, email: true } },
        approvedBy: { select: { id: true, name: true } },
        invoiceAllocations: {
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

    // Compute overpayment warning
    const chequeAmount = Number(updated.amount);
    const totalAllocated = (updated.invoiceAllocations || []).reduce(
      (sum: number, a: any) => sum + Number(a.allocatedAmount),
      0
    );
    const response: any = { cheque: serializeCheque(updated) };
    if (totalAllocated > chequeAmount + 0.01) {
      response.warning = `Allocated total ($${totalAllocated.toFixed(2)}) exceeds cheque amount ($${chequeAmount.toFixed(2)})`;
    }

    return NextResponse.json(response);
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[cheque-vault/[id] PATCH]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const chequeId = parseInt(id);

    if (isNaN(chequeId)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const cheque = await prisma.chequeVault.findUnique({
      where: { id: chequeId },
      select: {
        id: true,
        status: true,
        uploadedById: true,
        imageFileName: true,
      },
    });

    if (!cheque) {
      return NextResponse.json({ error: "Cheque not found" }, { status: 404 });
    }

    if (!canDeleteChequeRequest(cheque, user.id)) {
      if (cheque.status !== "PENDING") {
        return NextResponse.json(
          {
            error:
              "Only pending requests can be deleted. Approved or reviewed cheques cannot be removed.",
          },
          { status: 400 },
        );
      }
      return NextResponse.json(
        { error: "You can only delete your own pending requests" },
        { status: 403 },
      );
    }

    await prisma.chequeVault.delete({ where: { id: chequeId } });

    if (cheque.imageFileName) {
      deleteFromR2(cheque.imageFileName).catch((err) =>
        console.error("[cheque-vault/[id] DELETE] R2 cleanup failed:", err),
      );
    }

    return NextResponse.json({ message: "Cheque request deleted" });
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[cheque-vault/[id] DELETE]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
