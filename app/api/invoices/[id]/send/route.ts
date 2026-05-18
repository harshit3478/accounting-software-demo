import { NextRequest, NextResponse } from "next/server";
import prisma from "../../../../../lib/prisma";
import { requireAuth } from "../../../../../lib/auth";
import { sendInvoiceEmail } from "../../../../../lib/email";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const invoiceId = parseInt(id);

    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    if (!invoice.customer?.email) {
      return NextResponse.json(
        { error: "Customer email is required to send this invoice" },
        { status: 400 },
      );
    }

    const emailResult = await sendInvoiceEmail({
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      clientName: invoice.clientName,
      amount: Number(invoice.amount),
      paidAmount: Number(invoice.paidAmount),
      dueDate: invoice.dueDate,
      isLayaway: invoice.isLayaway,
      termsSnapshot: (invoice as any).termsSnapshot || null,
      customer: invoice.customer,
    });

    if (!emailResult.success) {
      return NextResponse.json(
        { error: "Failed to send invoice email" },
        { status: 500 },
      );
    }

    const sentAt = new Date();
    await prisma.$transaction(async (tx) => {
      await (tx as any).invoiceEditHistory.create({
        data: {
          invoiceId,
          editedById: user.id,
          reason: "Invoice sent to customer",
          changes: {
            sentAt: {
              from: null,
              to: sentAt.toISOString(),
            },
          },
        },
      });
    });

    return NextResponse.json({ success: true, sentAt: sentAt.toISOString() });
  } catch (error: any) {
    console.error("Send invoice error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to send invoice" },
      { status: 500 },
    );
  }
}
