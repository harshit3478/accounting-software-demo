import { type NextRequest, NextResponse } from "next/server";
import { requireAuth, requireSettingPermission } from "../../../../../lib/auth";
import { invalidatePayments } from "../../../../../lib/cache-helpers";
import prisma from "../../../../../lib/prisma";
import { uploadToR2 } from "../../../../../lib/r2-client";
import {
  parseRefundProofDataUrl,
  refundAvailableStoreCredit,
} from "../../../../../lib/store-credit-refund";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth();
    await requireSettingPermission("customers");

    const { id: idParam } = await params;
    const customerId = parseInt(idParam, 10);
    if (Number.isNaN(customerId)) {
      return NextResponse.json(
        { error: "Invalid customer ID" },
        { status: 400 },
      );
    }

    const body = await request.json();
    const amount = Number(body?.amount);
    const reason = typeof body?.reason === "string" ? body.reason : "";
    const refundProofDataUrl =
      typeof body?.refundProofDataUrl === "string"
        ? body.refundProofDataUrl
        : "";
    const refundProofFileName =
      typeof body?.refundProofFileName === "string"
        ? body.refundProofFileName
        : "";
    const refundProofMimeType =
      typeof body?.refundProofMimeType === "string"
        ? body.refundProofMimeType
        : "";
    const creditTransactionId =
      body?.creditTransactionId !== undefined &&
      body?.creditTransactionId !== null &&
      body?.creditTransactionId !== ""
        ? parseInt(String(body.creditTransactionId), 10)
        : undefined;

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { error: "Amount must be greater than 0" },
        { status: 400 },
      );
    }

    if (!reason.trim()) {
      return NextResponse.json(
        { error: "Reason is required" },
        { status: 400 },
      );
    }

    if (!refundProofDataUrl) {
      return NextResponse.json(
        { error: "Refund proof image is required" },
        { status: 400 },
      );
    }

    if (
      creditTransactionId !== undefined &&
      (!Number.isFinite(creditTransactionId) || creditTransactionId <= 0)
    ) {
      return NextResponse.json(
        { error: "Invalid credit transaction" },
        { status: 400 },
      );
    }

    const proof = parseRefundProofDataUrl({
      dataUrl: refundProofDataUrl,
      fileName: refundProofFileName,
      mimeType: refundProofMimeType,
    });
    const proofKey = `refund-proofs/store-credit-${customerId}-${Date.now()}-${proof.safeFileName}`;
    const refundProofUrl = await uploadToR2(
      proof.buffer,
      proofKey,
      proof.mimeType,
    );

    const result = await prisma.$transaction(
      (tx) =>
        refundAvailableStoreCredit(tx, {
          customerId,
          amount,
          reason,
          userId: user.id,
          refundProofUrl,
          refundProofFileName: proof.safeFileName,
          creditTransactionId,
        }),
      {
        timeout: 20000,
        maxWait: 5000,
      },
    );

    invalidatePayments();

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    console.error("Error refunding store credit:", error);
    return NextResponse.json(
      { error: error.message || "Failed to refund store credit" },
      { status: 400 },
    );
  }
}
