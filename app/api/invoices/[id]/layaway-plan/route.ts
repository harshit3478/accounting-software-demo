import { NextRequest, NextResponse } from "next/server";
import prisma from "../../../../../lib/prisma";
import { requireAuth } from "../../../../../lib/auth";

// GET /api/invoices/[id]/layaway-plan
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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
      return NextResponse.json({ error: "No layaway plan found" }, { status: 404 });
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
    return NextResponse.json({ error: "Failed to fetch layaway plan" }, { status: 500 });
  }
}

// POST /api/invoices/[id]/layaway-plan — create plan + installments
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;
    const invoiceId = parseInt(id);

    const { months, paymentFrequency, downPayment, notes, installments } = await request.json();

    // Verify invoice exists and is layaway
    const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }
    if (!invoice.isLayaway) {
      return NextResponse.json({ error: "Invoice is not marked as layaway" }, { status: 400 });
    }

    // Check if plan already exists
    const existing = await prisma.layawayPlan.findUnique({ where: { invoiceId } });
    if (existing) {
      return NextResponse.json({ error: "Layaway plan already exists for this invoice" }, { status: 409 });
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
    return NextResponse.json({ error: "Failed to create layaway plan" }, { status: 500 });
  }
}

// PUT /api/invoices/[id]/layaway-plan — update plan (e.g. cancel, update notes)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;
    const invoiceId = parseInt(id);

    const body = await request.json();
    const { isCancelled, notes, installments } = body;

    const existing = await prisma.layawayPlan.findUnique({ where: { invoiceId } });
    if (!existing) {
      return NextResponse.json({ error: "No layaway plan found" }, { status: 404 });
    }

    const data: any = {};
    if (isCancelled !== undefined) data.isCancelled = isCancelled;
    if (notes !== undefined) data.notes = notes;

    const plan = await prisma.layawayPlan.update({
      where: { invoiceId },
      data,
      include: { installments: { orderBy: { dueDate: "asc" } } },
    });

    // Update individual installments if provided
    if (Array.isArray(installments)) {
      for (const inst of installments) {
        if (inst.id) {
          await prisma.layawayInstallment.update({
            where: { id: inst.id },
            data: {
              isPaid: inst.isPaid !== undefined ? inst.isPaid : undefined,
              paidDate: inst.paidDate ? new Date(inst.paidDate) : undefined,
              paidAmount: inst.paidAmount !== undefined ? parseFloat(inst.paidAmount) : undefined,
            },
          });
        }
      }
    }

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

    return NextResponse.json(serialized);
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Update layaway plan error:", error);
    return NextResponse.json({ error: "Failed to update layaway plan" }, { status: 500 });
  }
}
