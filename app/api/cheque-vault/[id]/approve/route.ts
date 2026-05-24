import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { stampPaymentCode } from "@/lib/payment-code";
import { updateInvoiceAfterPayment } from "@/lib/invoice-utils";
import { invalidateDashboard } from "@/lib/cache-helpers";
import { sendChequeStatusNotification } from "@/lib/email";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const chequeId = parseInt(id);

    if (isNaN(chequeId)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const cheque = await prisma.chequeVault.findUnique({
      where: { id: chequeId },
      include: {
        uploadedBy: { select: { id: true, name: true, email: true } },
        invoiceAllocations: {
          include: {
            invoice: { select: { id: true, amount: true, paidAmount: true, invoiceNumber: true } },
          },
        },
      },
    });

    if (!cheque) {
      return NextResponse.json({ error: "Cheque not found" }, { status: 404 });
    }

    if (cheque.status !== "PENDING" && cheque.status !== "NEEDS_CORRECTION") {
      return NextResponse.json(
        { error: "Only pending or needs-correction cheques can be approved" },
        { status: 400 }
      );
    }

    if (!cheque.invoiceAllocations.length) {
      return NextResponse.json(
        { error: "Link at least one invoice before approving" },
        { status: 400 }
      );
    }

    const paymentRefs: string[] = [];
    const warnings: string[] = [];

    // Check for overpayment per invoice
    for (const alloc of cheque.invoiceAllocations) {
      const invoiceBalance = Number(alloc.invoice.amount) - Number(alloc.invoice.paidAmount);
      const allocated = Number(alloc.allocatedAmount);
      if (allocated > invoiceBalance + 0.01) {
        warnings.push(
          `Cheque allocation ($${allocated.toFixed(2)}) exceeds remaining balance on ${alloc.invoice.invoiceNumber} ($${invoiceBalance.toFixed(2)})`
        );
      }
    }

    await prisma.$transaction(async (tx) => {
      // Upsert the "Cheque" payment method once
      const chequeMethod = await tx.paymentMethodEntry.upsert({
        where: { name: "Cheque" },
        create: {
          name: "Cheque",
          icon: "check-square",
          color: "#059669",
          isSystem: true,
          isActive: true,
          sortOrder: 10,
        },
        update: {},
      });

      // Create one Payment per allocation
      for (const alloc of cheque.invoiceAllocations) {
        const payment = await tx.payment.create({
          data: {
            amount: alloc.allocatedAmount,
            methodId: chequeMethod.id,
            invoiceId: alloc.invoiceId,
            paymentDate: cheque.chequeDate,
            userId: admin.id,
            source: "cheque_vault",
            notes: `Cheque #${cheque.chequeNumber} approved by ${admin.name}`,
            isMatched: true,
          },
        });

        const ref = await stampPaymentCode(tx, payment.id);
        paymentRefs.push(ref);
      }

      // Mark cheque as approved
      await tx.chequeVault.update({
        where: { id: chequeId },
        data: {
          status: "APPROVED",
          approvedById: admin.id,
          approvedAt: new Date(),
        },
      });
    });

    // Update each invoice's paidAmount and status after the transaction
    for (const alloc of cheque.invoiceAllocations) {
      await updateInvoiceAfterPayment(alloc.invoiceId);
    }
    invalidateDashboard();

    // Fire-and-forget email
    if (cheque.uploadedBy.email) {
      sendChequeStatusNotification({
        recipientEmail: cheque.uploadedBy.email,
        recipientName: cheque.uploadedBy.name,
        chequeNumber: cheque.chequeNumber,
        amount: Number(cheque.amount),
        status: "APPROVED",
        paymentRef: paymentRefs.join(", "),
      }).catch((err) => console.error("[approve] email error:", err));
    }

    const response: any = {
      message: "Cheque approved and payments recorded",
      paymentRefs,
    };

    if (warnings.length) {
      response.warnings = warnings;
    }

    return NextResponse.json(response);
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error.message === "Forbidden") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }
    console.error("[cheque-vault/[id]/approve PUT]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
