import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireChequeVaultApprove } from "@/lib/auth";
import { roundMoney } from "@/lib/early-payment-discount-shared";
import { invalidateDashboard, invalidatePayments } from "@/lib/cache-helpers";
import {
  ChequeVaultCustomerResolutionError,
  getChequeVaultRemainingStoreCreditAmount,
  recordChequeVaultExcessAsStoreCredit,
  resolveChequeVaultCustomer,
} from "@/lib/cheque-vault-store-credit";
import {
  chequeVaultInvoiceAllocationInclude,
  chequeVaultStoreCreditMoveInclude,
  chequeVaultUserInclude,
  serializeChequeVaultRecord,
} from "@/lib/cheque-vault-include";

export async function POST(
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

    const body = await request.json();
    const notes =
      typeof body.notes === "string" ? body.notes.trim() : "";
    const requestedCustomerId =
      body.customerId != null ? Number(body.customerId) : null;
    const requestedAmount =
      body.amount != null ? Number(body.amount) : null;

    if (!notes) {
      return NextResponse.json(
        { error: "Notes are required when moving amount to store credit" },
        { status: 400 },
      );
    }

    const cheque = await prisma.chequeVault.findUnique({
      where: { id: chequeId },
      include: {
        invoiceAllocations: {
          include: {
            invoice: {
              select: {
                id: true,
                customerId: true,
                invoiceNumber: true,
                clientName: true,
              },
            },
          },
        },
        storeCreditMoves: {
          select: { amount: true },
        },
      },
    });

    if (!cheque || cheque.isDeleted) {
      return NextResponse.json({ error: "Cheque not found" }, { status: 404 });
    }

    if (cheque.status !== "APPROVED") {
      return NextResponse.json(
        {
          error:
            "Only approved cheques can move unallocated amount to store credit",
        },
        { status: 400 },
      );
    }

    const remaining = getChequeVaultRemainingStoreCreditAmount(
      Number(cheque.amount),
      cheque.invoiceAllocations,
      cheque.storeCreditMoves,
    );

    if (remaining <= 0.01) {
      return NextResponse.json(
        { error: "No unallocated amount remaining to move to store credit" },
        { status: 400 },
      );
    }

    const moveAmount =
      requestedAmount != null && Number.isFinite(requestedAmount)
        ? roundMoney(requestedAmount)
        : remaining;

    if (moveAmount <= 0.01) {
      return NextResponse.json(
        { error: "Amount must be greater than 0" },
        { status: 400 },
      );
    }

    if (moveAmount > remaining + 0.01) {
      return NextResponse.json(
        {
          error: `Amount ($${moveAmount.toFixed(2)}) exceeds remaining unallocated ($${remaining.toFixed(2)})`,
        },
        { status: 400 },
      );
    }

    const linkedCustomerIds = [
      ...new Set(
        cheque.invoiceAllocations
          .map((a) => a.invoice.customerId)
          .filter((cid): cid is number => cid != null),
      ),
    ];

    let customerId: number | null = null;

    if (
      requestedCustomerId != null &&
      Number.isFinite(requestedCustomerId)
    ) {
      if (
        linkedCustomerIds.length > 0 &&
        !linkedCustomerIds.includes(requestedCustomerId)
      ) {
        return NextResponse.json(
          {
            error:
              "Selected customer must match one of the customers on the linked invoices",
          },
          { status: 400 },
        );
      }

      const customer = await prisma.customer.findFirst({
        where: { id: requestedCustomerId, isDeleted: false },
        select: { id: true },
      });
      if (!customer) {
        return NextResponse.json(
          { error: "Customer not found" },
          { status: 404 },
        );
      }
      customerId = customer.id;
    } else {
      try {
        customerId = await resolveChequeVaultCustomer(
          prisma,
          cheque.invoiceAllocations.map((a) => a.invoice),
          cheque.customerEmail,
        );
      } catch (error) {
        if (error instanceof ChequeVaultCustomerResolutionError) {
          return NextResponse.json({ error: error.message }, { status: 400 });
        }
        throw error;
      }
    }

    if (!customerId) {
      return NextResponse.json(
        {
          error:
            "No customer linked to the invoices. Select a customer before moving to store credit.",
        },
        { status: 400 },
      );
    }

    const result = await prisma.$transaction(async (tx) => {
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

      return recordChequeVaultExcessAsStoreCredit(tx, {
        chequeId,
        chequeNumber: cheque.chequeNumber,
        chequeDate: cheque.chequeDate,
        excessAmount: moveAmount,
        customerId: customerId!,
        methodId: chequeMethod.id,
        userId: admin.id,
        movedByName: admin.name,
        notes,
      });
    });

    invalidateDashboard();
    invalidatePayments();

    const updated = await prisma.chequeVault.findUnique({
      where: { id: chequeId },
      include: {
        ...chequeVaultUserInclude,
        invoiceAllocations: {
          include: chequeVaultInvoiceAllocationInclude,
        },
        storeCreditMoves: {
          include: chequeVaultStoreCreditMoveInclude,
          orderBy: { movedAt: "desc" },
        },
      },
    });

    return NextResponse.json({
      message: `$${moveAmount.toFixed(2)} moved to store credit`,
      paymentRef: result.paymentRef,
      paymentId: result.paymentId,
      storeCreditAdded: moveAmount,
      cheque: updated ? serializeChequeVaultRecord(updated) : null,
    });
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
    console.error("[cheque-vault/[id]/move-to-store-credit POST]", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 },
    );
  }
}
