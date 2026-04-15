import { NextRequest, NextResponse } from "next/server";
import prisma from "../../../../../lib/prisma";
import { requireAuth } from "../../../../../lib/auth";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const user = await requireAuth();
    const resolvedParams = await params;
    const id = parseInt(resolvedParams.id, 10);

    if (isNaN(id)) {
      return NextResponse.json(
        { error: "Invalid payment ID" },
        { status: 400 },
      );
    }

    const body = await request.json();
    const { notes, editReason } = body;

    const reason = typeof editReason === "string" ? editReason.trim() : "";
    if (!reason) {
      return NextResponse.json(
        { error: "Edit reason is required" },
        { status: 400 },
      );
    }

    const existingPayment = await prisma.payment.findUnique({ where: { id } });
    if (!existingPayment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    const payment = await prisma.$transaction(async (tx) => {
      const updated = await tx.payment.update({
        where: { id },
        data: {
          notes: notes || null,
          updatedAt: new Date(),
        },
      });

      await (tx as any).paymentEditHistory.create({
        data: {
          paymentId: id,
          editedById: user.id,
          reason,
          changes: {
            notes: {
              from: existingPayment.notes || null,
              to: notes || null,
            },
          },
        },
      });

      return updated;
    });

    return NextResponse.json({
      success: true,
      payment: {
        ...payment,
        amount: payment.amount.toNumber(),
      },
    });
  } catch (error: any) {
    console.error("Update payment notes error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
