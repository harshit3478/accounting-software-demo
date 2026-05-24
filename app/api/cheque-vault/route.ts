import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { uploadToR2, deleteFromR2 } from "@/lib/r2-client";
import { extractChequeData } from "@/lib/cheque-ocr";

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

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
    const payeeName = searchParams.get("payeeName");
    const uploadedBy = searchParams.get("uploadedBy");

    const where: any = {};

    // Non-admin users can only see their own uploads
    if (user.role !== "admin") {
      where.uploadedById = user.id;
    } else if (uploadedBy) {
      where.uploadedById = parseInt(uploadedBy);
    }

    if (status && status !== "all") {
      where.status = status;
    }

    if (payeeName) {
      where.payeeName = { contains: payeeName };
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    const [cheques, total] = await Promise.all([
      prisma.chequeVault.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          uploadedBy: { select: { id: true, name: true, email: true } },
          approvedBy: { select: { id: true, name: true } },
          invoiceAllocations: {
            include: {
              invoice: { select: { id: true, invoiceNumber: true, clientName: true } },
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
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  let imageFileName: string | null = null;
  let uploadedToR2 = false;

  try {
    const user = await requireAuth();
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Only JPEG, PNG, and WebP images are accepted." },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File size exceeds 10MB limit." },
        { status: 400 }
      );
    }

    const ext = file.type.split("/")[1].replace("jpeg", "jpg");
    const rand = Math.random().toString(36).substring(2, 10);
    imageFileName = `cheques/${Date.now()}-${rand}.${ext}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const imageUrl = await uploadToR2(buffer, imageFileName, file.type);
    uploadedToR2 = true;

    // Run OCR — failure is non-blocking
    const ocrResult = await extractChequeData(buffer, file.type).catch((err) => {
      console.error("[cheque-vault POST] OCR error:", err);
      return {
        chequeNumber: null,
        payeeName: null,
        amount: null,
        chequeDate: null,
        bankName: null,
        rawText: "",
        confidence: "low" as const,
      };
    });

    const customerEmail = (formData.get("customerEmail") as string | null)?.trim() || null;

    const cheque = await prisma.chequeVault.create({
      data: {
        chequeNumber: ocrResult.chequeNumber || "",
        payeeName: ocrResult.payeeName || "",
        customerEmail,
        amount: ocrResult.amount ?? 0,
        chequeDate: ocrResult.chequeDate ? new Date(ocrResult.chequeDate) : new Date(),
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
        console.error("[cheque-vault POST] R2 cleanup failed:", e)
      );
    }

    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[cheque-vault POST]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
