import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const chequeNumber = searchParams.get("chequeNumber");

    if (!chequeNumber || !chequeNumber.trim()) {
      return NextResponse.json({ isDuplicate: false, existingCheques: [] });
    }

    const existingCheques = await prisma.chequeVault.findMany({
      where: { chequeNumber: chequeNumber.trim() },
      select: {
        id: true,
        status: true,
        chequeDate: true,
        amount: true,
        createdAt: true,
        uploadedBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      isDuplicate: existingCheques.length > 0,
      existingCheques: existingCheques.map((c) => ({
        ...c,
        amount: Number(c.amount),
      })),
    });
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[check-duplicate GET]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
