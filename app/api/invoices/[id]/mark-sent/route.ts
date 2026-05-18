import { NextRequest, NextResponse } from "next/server";
import prisma from "../../../../../lib/prisma";
import { requireAuth } from "../../../../../lib/auth";

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
      select: { id: true },
    });

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    const sentAt = new Date();
    await prisma.$transaction(async (tx) => {
      await (tx as any).invoiceEditHistory.create({
        data: {
          invoiceId,
          editedById: user.id,
          reason: "Marked invoice as sent",
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
    console.error("Mark invoice sent error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to mark invoice as sent" },
      { status: 500 },
    );
  }
}
