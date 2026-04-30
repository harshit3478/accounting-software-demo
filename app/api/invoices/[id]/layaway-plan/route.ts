import { NextRequest, NextResponse } from "next/server";
import prisma from "../../../../../lib/prisma";
import { requireAuth } from "../../../../../lib/auth";
import { updateInvoiceAfterPayment } from "../../../../../lib/invoice-utils";

// GET /api/invoices/[id]/layaway-plan
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAuth();
    const { id } = await params;
    const invoiceId = parseInt(id);

    const plan = await prisma.layawayPlan.findUnique({
      where: { invoiceId },
      include: { installments: { orderBy: { dueDate: "asc" } } },
    });

    if (!plan) {
      return NextResponse.json(
        { error: "No layaway plan found" },
        { status: 404 },
      );
    }

    // Serialize decimals
    const serialized = {
      ...plan,
      downPayment: Number(plan.downPayment),
      installments: plan.installments.map((i) => ({
        ...i,
        amount: Number(i.amount),
        paidAmount: i.paidAmount ? Number(i.paidAmount) : null,
      })),
    };

    return NextResponse.json(serialized);
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Failed to fetch layaway plan" },
      { status: 500 },
    );
  }
}

// POST /api/invoices/[id]/layaway-plan — create plan + installments
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAuth();
    const { id } = await params;
    const invoiceId = parseInt(id);

    const { months, paymentFrequency, downPayment, notes, installments } =
      await request.json();

    // Verify invoice exists and is layaway
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
    });
    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }
    if (!invoice.isLayaway) {
      return NextResponse.json(
        { error: "Invoice is not marked as layaway" },
        { status: 400 },
      );
    }

    // Check if plan already exists
    const existing = await prisma.layawayPlan.findUnique({
      where: { invoiceId },
    });
    if (existing) {
      return NextResponse.json(
        { error: "Layaway plan already exists for this invoice" },
        { status: 409 },
      );
    }

    const plan = await prisma.layawayPlan.create({
      data: {
        invoiceId,
        months,
        paymentFrequency,
        downPayment: parseFloat(downPayment),
        notes: notes || null,
        installments: {
          create: (installments || []).map((inst: any) => ({
            dueDate: new Date(inst.dueDate),
            amount: parseFloat(inst.amount),
            label: inst.label,
            isPaid: inst.isPaid || false,
            paidDate: inst.paidDate ? new Date(inst.paidDate) : null,
            paidAmount: inst.paidAmount ? parseFloat(inst.paidAmount) : null,
            paymentId: inst.paymentId ?? null,
          })),
        },
      },
      include: { installments: { orderBy: { dueDate: "asc" } } },
    });

    const serialized = {
      ...plan,
      downPayment: Number(plan.downPayment),
      installments: plan.installments.map((i) => ({
        ...i,
        amount: Number(i.amount),
        paidAmount: i.paidAmount ? Number(i.paidAmount) : null,
      })),
    };

    return NextResponse.json(serialized, { status: 201 });
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Create layaway plan error:", error);
    return NextResponse.json(
      { error: "Failed to create layaway plan" },
      { status: 500 },
    );
  }
}

// PUT /api/invoices/[id]/layaway-plan — update plan (e.g. cancel, update notes)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAuth();
    const { id } = await params;
    const invoiceId = parseInt(id);

    const body = await request.json();
    const { isCancelled, notes, installments } = body;

    const existing = await prisma.layawayPlan.findUnique({
      where: { invoiceId },
      include: {
        invoice: {
          select: {
            id: true,
            customerId: true,
            invoiceNumber: true,
          },
        },
        installments: true,
      },
    });
    if (!existing) {
      return NextResponse.json(
        { error: "No layaway plan found" },
        { status: 404 },
      );
    }

    const data: any = {};
    if (isCancelled !== undefined) data.isCancelled = isCancelled;
    if (notes !== undefined) data.notes = notes;

    const plan = await prisma.$transaction(async (tx) => {
      const updatedPlan = await tx.layawayPlan.update({
        where: { invoiceId },
        data,
        include: { installments: { orderBy: { dueDate: "asc" } } },
      });

      if (Array.isArray(installments)) {
        for (const inst of installments) {
          if (!inst.id) continue;

          const existingInstallment = await tx.layawayInstallment.findUnique({
            where: { id: inst.id },
          });

          if (!existingInstallment) continue;

          const wantsUnlink = inst.unlinkPayment === true;
          const shouldClearPayment = wantsUnlink || inst.isPaid === false;

          if (shouldClearPayment && existingInstallment.paymentId) {
            const linkedPayment = await tx.payment.findUnique({
              where: { id: existingInstallment.paymentId },
              include: {
                paymentMatches: true,
              },
            });

            if (linkedPayment) {
              const creditAmount =
                existingInstallment.paidAmount ?? existingInstallment.amount;

              if (linkedPayment.invoiceId === invoiceId) {
                await tx.payment.update({
                  where: { id: linkedPayment.id },
                  data: {
                    invoiceId: null,
                    notes:"",
                    isMatched: false,
                    source: "store_credit_excess",
                  },
                });
              } else {
                const match = await tx.paymentInvoiceMatch.findFirst({
                  where: {
                    paymentId: linkedPayment.id,
                    invoiceId,
                  },
                });

                if (match) {
                  await tx.paymentInvoiceMatch.delete({
                    where: { id: match.id },
                  });
                }

                const remainingMatchCount = await tx.paymentInvoiceMatch.count({
                  where: { paymentId: linkedPayment.id },
                });

                if (remainingMatchCount === 0 && !linkedPayment.invoiceId) {
                  await tx.payment.update({
                    where: { id: linkedPayment.id },
                    data: { isMatched: false },
                  });
                }
              }

              if (existing.invoice.customerId) {
                await tx.customer.update({
                  where: { id: existing.invoice.customerId },
                  data: {
                    storeCredit: {
                      increment: creditAmount,
                    },
                  },
                });

                await tx.customerCreditTransaction.create({
                  data: {
                    customerId: existing.invoice.customerId,
                    amount: creditAmount,
                    type: "credit",
                    reason: `Unlinked layaway installment ${existingInstallment.label} from invoice ${existing.invoice.invoiceNumber}`,
                    paymentId: linkedPayment.id,
                    invoiceId,
                  },
                });
              }
            }
          }

          await tx.layawayInstallment.update({
            where: { id: inst.id },
            data: {
              isPaid: inst.isPaid !== undefined ? inst.isPaid : undefined,
              paidDate:
                inst.paidDate !== undefined && inst.paidDate !== null
                  ? new Date(inst.paidDate)
                  : inst.paidDate === null
                    ? null
                    : undefined,
              paidAmount:
                inst.paidAmount !== undefined
                  ? parseFloat(inst.paidAmount)
                  : undefined,
              paymentId:
                inst.paymentId !== undefined ? inst.paymentId : undefined,
            },
          });
        }
      }

      return updatedPlan;
    });

    // Re-fetch with updated installments
    const updated = await prisma.layawayPlan.findUnique({
      where: { invoiceId },
      include: { installments: { orderBy: { dueDate: "asc" } } },
    });

    const serialized = {
      ...updated!,
      downPayment: Number(updated!.downPayment),
      installments: updated!.installments.map((i) => ({
        ...i,
        amount: Number(i.amount),
        paidAmount: i.paidAmount ? Number(i.paidAmount) : null,
      })),
    };

    await updateInvoiceAfterPayment(invoiceId);

    return NextResponse.json(serialized);
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Update layaway plan error:", error);
    return NextResponse.json(
      { error: "Failed to update layaway plan" },
      { status: 500 },
    );
  }
}
