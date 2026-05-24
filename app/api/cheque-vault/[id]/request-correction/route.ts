import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { sendChequeStatusNotification } from "@/lib/email";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;
    const chequeId = parseInt(id);

    if (isNaN(chequeId)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const body = await request.json();
    const { correctionNote } = body;

    if (!correctionNote || !correctionNote.trim()) {
      return NextResponse.json(
        { error: "Correction note is required" },
        { status: 400 }
      );
    }

    const cheque = await prisma.chequeVault.findUnique({
      where: { id: chequeId },
      include: {
        uploadedBy: { select: { id: true, name: true, email: true } },
      },
    });

    if (!cheque) {
      return NextResponse.json({ error: "Cheque not found" }, { status: 404 });
    }

    if (cheque.status === "APPROVED" || cheque.status === "REJECTED") {
      return NextResponse.json(
        { error: "Cannot request correction on an approved or rejected cheque" },
        { status: 400 }
      );
    }

    await prisma.chequeVault.update({
      where: { id: chequeId },
      data: {
        status: "NEEDS_CORRECTION",
        correctionNote: correctionNote.trim(),
      },
    });

    if (cheque.uploadedBy.email) {
      sendChequeStatusNotification({
        recipientEmail: cheque.uploadedBy.email,
        recipientName: cheque.uploadedBy.name,
        chequeNumber: cheque.chequeNumber,
        amount: Number(cheque.amount),
        status: "NEEDS_CORRECTION",
        reason: correctionNote.trim(),
      }).catch((err) => console.error("[request-correction] email error:", err));
    }

    return NextResponse.json({ message: "Correction requested" });
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error.message === "Forbidden") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }
    console.error("[cheque-vault/[id]/request-correction PUT]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
