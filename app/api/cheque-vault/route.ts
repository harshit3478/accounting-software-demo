import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  requireChequeVaultUpload,
  requireAuth,
  isSuperAdmin,
} from "@/lib/auth";
import { uploadToR2, deleteFromR2 } from "@/lib/r2-client";
import { extractChequeDataFromFile } from "@/lib/cheque-ocr";
import {
  CHEQUE_VAULT_MAX_FILE_SIZE_BYTES,
  emptyChequeOcrResult,
  getChequeVaultFileExtension,
  isAllowedChequeVaultMimeType,
} from "@/lib/cheque-vault-upload";
import { chequeVaultUserInclude } from "@/lib/cheque-vault-include";
import { endOfBusinessDay, startOfBusinessDay } from "@/lib/business-date";

function serializeCheque(cheque: any) {
  return {
    ...cheque,
    amount: Number(cheque.amount),
    invoiceAllocations: (cheque.invoiceAllocations || []).map((a: any) => ({
      ...a,
      allocatedAmount: Number(a.allocatedAmount),
      invoice: a.invoice
        ? {
            ...a.invoice,
            amount: Number(a.invoice.amount),
            paidAmount: Number(a.invoice.paidAmount),
          }
        : null,
    })),
  };
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(request.url);

    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(100, parseInt(searchParams.get("limit") || "20"));
    const skip = (page - 1) * limit;

    const status = searchParams.get("status");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const payorName =
      searchParams.get("payorName") || searchParams.get("payeeName");
    const uploadedBy = searchParams.get("uploadedBy");

    const where: any = {};

    // Admins can filter by uploader; all users can browse the full list (read-only for non-admins).
    if ((user.role === "admin" || isSuperAdmin(user)) && uploadedBy) {
      where.uploadedById = parseInt(uploadedBy);
    }

    if (status && status !== "all") {
      where.status = status;
    }

    if (payorName) {
      where.payorName = { contains: payorName };
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startOfBusinessDay(startDate);
      if (endDate) {
        where.createdAt.lte = endOfBusinessDay(endDate);
      }
    }

    const [cheques, total] = await Promise.all([
      prisma.chequeVault.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          ...chequeVaultUserInclude,
          invoiceAllocations: {
            include: {
              invoice: {
                select: { id: true, invoiceNumber: true, clientName: true },
              },
            },
          },
        },
      }),
      prisma.chequeVault.count({ where }),
    ]);

    return NextResponse.json({
      cheques: cheques.map(serializeCheque),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[cheque-vault GET]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  let imageFileName: string | null = null;
  let uploadedToR2 = false;

  try {
    const user = await requireChequeVaultUpload();

    const formData = await request.formData();
    const fileEntries = formData
      .getAll("file")
      .filter(
        (entry): entry is File => entry instanceof File && entry.size > 0,
      );

    if (fileEntries.length === 0) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (fileEntries.length > 1) {
      return NextResponse.json(
        { error: "Only one cheque file can be uploaded per request" },
        { status: 400 },
      );
    }

    const file = fileEntries[0];

    if (!isAllowedChequeVaultMimeType(file.type)) {
      return NextResponse.json(
        {
          error:
            "Invalid file type. Only JPEG, PNG, WebP images, or PDF are accepted.",
        },
        { status: 400 },
      );
    }

    if (file.size > CHEQUE_VAULT_MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: "File size exceeds 10MB limit." },
        { status: 400 },
      );
    }

    const ext = getChequeVaultFileExtension(file.type);
    const rand = Math.random().toString(36).substring(2, 10);
    imageFileName = `cheques/${Date.now()}-${rand}.${ext}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const imageUrl = await uploadToR2(buffer, imageFileName, file.type);
    uploadedToR2 = true;

    const ocrResult = await extractChequeDataFromFile(buffer, file.type).catch(
      (err) => {
        console.error("[cheque-vault POST] OCR error:", err);
        return emptyChequeOcrResult();
      },
    );

    const customerEmail =
      (formData.get("customerEmail") as string | null)?.trim() || null;

    const parsedChequeDate = ocrResult.chequeDate
      ? new Date(ocrResult.chequeDate)
      : null;
    const chequeDate =
      parsedChequeDate && !isNaN(parsedChequeDate.getTime())
        ? startOfBusinessDay(parsedChequeDate)
        : startOfBusinessDay(new Date());

    const cheque = await prisma.chequeVault.create({
      data: {
        chequeNumber: ocrResult.chequeNumber || "",
        payorName: ocrResult.payorName || "",
        customerEmail,
        amount: ocrResult.amount ?? 0,
        chequeDate,
        bankName: ocrResult.bankName || null,
        imageUrl,
        imageFileName,
        rawOcrText: ocrResult.rawText || null,
        status: "PENDING",
        uploadedById: user.id,
      },
      include: {
        uploadedBy: { select: { id: true, name: true, email: true } },
        invoiceAllocations: true,
      },
    });

    return NextResponse.json({
      cheque: serializeCheque(cheque),
      ocrResult,
    });
  } catch (error: any) {
    // Clean up orphaned R2 file on DB failure
    if (uploadedToR2 && imageFileName) {
      deleteFromR2(imageFileName).catch((e) =>
        console.error("[cheque-vault POST] R2 cleanup failed:", e),
      );
    }

    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[cheque-vault POST]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
