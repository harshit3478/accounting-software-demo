import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireChequeVaultApprove } from "@/lib/auth";
import {
  ChequeVaultCustomerResolutionError,
  getChequeVaultUnallocatedAmount,
  recordChequeVaultExcessAsStoreCredit,
  resolveChequeVaultCustomer,
} from "@/lib/cheque-vault-store-credit";
import { stampPaymentCode } from "@/lib/payment-code";
import { updateInvoiceAfterPayment } from "@/lib/invoice-utils";
import { invalidateDashboard, invalidatePayments } from "@/lib/cache-helpers";
import { sendChequeStatusNotification } from "@/lib/email";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await requireChequeVaultApprove();
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
            invoice: {
              select: {
                id: true,
                amount: true,
                paidAmount: true,
                invoiceNumber: true,
                customerId: true,
              },
            },
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
        { status: 400 },
      );
    }

    if (!cheque.invoiceAllocations.length) {
      return NextResponse.json(
        { error: "Link at least one invoice before approving" },
        { status: 400 },
      );
    }

    const paymentRefs: string[] = [];
    const paymentIds: number[] = [];
    const warnings: string[] = [];
    const chequeAmount = Number(cheque.amount);
    const excessAmount = getChequeVaultUnallocatedAmount(
      chequeAmount,
      cheque.invoiceAllocations,
    );

    let storeCreditCustomerId: number | null = null;
    if (excessAmount > 0.01) {
      try {
        storeCreditCustomerId = await resolveChequeVaultCustomer(
          prisma,
          cheque.invoiceAllocations.map((allocation) => allocation.invoice),
          cheque.customerEmail,
        );
      } catch (error) {
        if (error instanceof ChequeVaultCustomerResolutionError) {
          return NextResponse.json({ error: error.message }, { status: 400 });
        }
        throw error;
      }

      if (!storeCreditCustomerId) {
        return NextResponse.json(
          {
            error: `Cannot approve: $${excessAmount.toFixed(2)} is unallocated but no customer is linked to the invoices. Link a customer to the invoices before approving.`,
          },
          { status: 400 },
        );
      }
    }

    // Check for overpayment per invoice
    for (const alloc of cheque.invoiceAllocations) {
      const invoiceBalance =
        Number(alloc.invoice.amount) - Number(alloc.invoice.paidAmount);
      const allocated = Number(alloc.allocatedAmount);
      if (allocated > invoiceBalance + 0.01) {
        warnings.push(
          `Cheque allocation ($${allocated.toFixed(2)}) exceeds remaining balance on ${alloc.invoice.invoiceNumber} ($${invoiceBalance.toFixed(2)})`,
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

      // One payment per linked invoice — each appears on the Payments tab
      for (const alloc of cheque.invoiceAllocations) {
        const payment = await tx.payment.create({
          data: {
            amount: alloc.allocatedAmount,
            methodId: chequeMethod.id,
            invoiceId: alloc.invoiceId,
            paymentDate: cheque.chequeDate,
            userId: admin.id,
            source: "cheque_vault",
            notes: `Cheque vault #${chequeId} · Cheque #${cheque.chequeNumber} · ${alloc.invoice.invoiceNumber} · Approved by ${admin.name}`,
            isMatched: true,
          },
        });

        const ref = await stampPaymentCode(tx, payment.id);
        paymentRefs.push(ref);
        paymentIds.push(payment.id);
      }

      if (excessAmount > 0.01 && storeCreditCustomerId) {
        const storeCredit = await recordChequeVaultExcessAsStoreCredit(tx, {
          chequeId,
          chequeNumber: cheque.chequeNumber,
          chequeDate: cheque.chequeDate,
          excessAmount,
          customerId: storeCreditCustomerId,
          methodId: chequeMethod.id,
          userId: admin.id,
          approvedByName: admin.name,
        });
        paymentRefs.push(storeCredit.paymentRef);
        paymentIds.push(storeCredit.paymentId);
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
    invalidatePayments();

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
      message:
        excessAmount > 0.01
          ? `Cheque approved. $${excessAmount.toFixed(2)} saved as store credit.`
          : "Cheque approved and payments recorded",
      paymentRefs,
      paymentIds,
      paymentsCreated: paymentIds.length,
      storeCreditAdded: excessAmount > 0.01 ? excessAmount : 0,
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
      return NextResponse.json(
        { error: "Cheque approval permission required" },
        { status: 403 },
      );
    }
    console.error("[cheque-vault/[id]/approve PUT]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
