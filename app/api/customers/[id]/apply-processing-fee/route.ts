import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireSettingPermission } from "../../../../../lib/auth";
import { applyStoreCreditAsProcessingFeeAndSync } from "../../../../../lib/processing-fee";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth();
    await requireSettingPermission("customers");

    const { id: idParam } = await params;
    const customerId = parseInt(idParam, 10);
    if (isNaN(customerId)) {
      return NextResponse.json({ error: "Invalid customer ID" }, { status: 400 });
    }

    const body = await request.json();
    const { invoiceId, amount, creditTransactionId } = body;

    if (!invoiceId || !amount) {
      return NextResponse.json(
        { error: "Missing required fields: invoiceId, amount" },
        { status: 400 },
      );
    }

    const parsedInvoiceId = parseInt(String(invoiceId), 10);
    const parsedAmount = Number(amount);
    const parsedCreditTransactionId =
      creditTransactionId !== undefined && creditTransactionId !== null
        ? parseInt(String(creditTransactionId), 10)
        : undefined;

    if (isNaN(parsedInvoiceId)) {
      return NextResponse.json({ error: "Invalid invoice ID" }, { status: 400 });
    }

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return NextResponse.json(
        { error: "Amount must be greater than 0" },
        { status: 400 },
      );
    }

    const result = await applyStoreCreditAsProcessingFeeAndSync({
      customerId,
      invoiceId: parsedInvoiceId,
      amount: parsedAmount,
      userId: user.id,
      creditTransactionId: parsedCreditTransactionId,
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.error("Error applying processing fee:", error);
    return NextResponse.json(
      { error: error.message || "Failed to apply processing fee" },
      { status: 500 },
    );
  }
}
