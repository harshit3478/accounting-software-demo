import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { getFromR2 } from "@/lib/r2-client";
import { getChequeVaultContentType } from "@/lib/cheque-vault-upload";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAuth();

    const { id } = await params;
    const chequeId = parseInt(id);

    if (isNaN(chequeId)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const cheque = await prisma.chequeVault.findUnique({
      where: { id: chequeId },
      select: {
        imageFileName: true,
        isDeleted: true,
      },
    });

    if (!cheque || cheque.isDeleted) {
      return NextResponse.json({ error: "Cheque not found" }, { status: 404 });
    }

    const response = await getFromR2(cheque.imageFileName);

    if (!response.Body) {
      return NextResponse.json(
        { error: "File not found in storage" },
        { status: 404 },
      );
    }

    const bytes = await response.Body.transformToByteArray();
    const buffer = Buffer.from(bytes);
    const contentType =
      response.ContentType || getChequeVaultContentType(cheque.imageFileName);
    const downloadName =
      cheque.imageFileName.split("/").pop() || "cheque-document";

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${encodeURIComponent(downloadName)}"`,
        "Content-Length": buffer.length.toString(),
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[cheque-vault/[id]/file GET]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
