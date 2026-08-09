import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/auth";
import { DocumentType } from "@prisma/client";
import { invalidateDocuments } from "@/lib/cache-helpers";

// POST - Recover soft-deleted document or folder (flip isDeleted flags)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireSuperAdmin();
    const { id } = await params;
    const deletedDocId = parseInt(id);

    if (isNaN(deletedDocId)) {
      return NextResponse.json(
        { error: "Invalid document ID" },
        { status: 400 },
      );
    }

    const deletedDoc = await prisma.deletedDocument.findUnique({
      where: { id: deletedDocId },
      include: {
        originalUploader: {
          select: { name: true },
        },
      },
    });

    if (!deletedDoc) {
      return NextResponse.json(
        { error: "Deleted document not found" },
        { status: 404 },
      );
    }

    const folderContents = deletedDoc.folderContents as {
      descendants?: Array<{ id: number }>;
    } | null;
    const descendantIds = (folderContents?.descendants || [])
      .map((d) => d.id)
      .filter((id): id is number => typeof id === "number");
    const idsToRestore = [deletedDoc.originalDocId, ...descendantIds];

    const existing = await prisma.document.findMany({
      where: { id: { in: idsToRestore }, isDeleted: true },
      select: { id: true, type: true, name: true },
    });

    if (existing.length === 0) {
      // Legacy trash rows from before soft-delete — cannot restore in place
      return NextResponse.json(
        {
          error:
            "This trash entry cannot be restored because the original documents are no longer available. Permanent deletion was used before soft-delete was enabled.",
        },
        { status: 409 },
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.document.updateMany({
        where: { id: { in: idsToRestore }, isDeleted: true },
        data: {
          isDeleted: false,
          deletedAt: null,
          deletedBy: null,
        },
      });

      await tx.deletedDocument.delete({
        where: { id: deletedDocId },
      });
    });

    invalidateDocuments();

    const typeLabel =
      deletedDoc.type === DocumentType.folder ? "Folder" : "File";

    return NextResponse.json({
      success: true,
      message: `${typeLabel} "${deletedDoc.name}" recovered successfully. Originally uploaded by ${deletedDoc.originalUploader.name}.`,
      type: deletedDoc.type === DocumentType.folder ? "folder" : "file",
      restoredCount: existing.length,
    });
  } catch (error: any) {
    console.error("Error recovering document:", error);

    if (error.message === "Super admin access required") {
      return NextResponse.json(
        { error: "Only superadmin can recover documents" },
        { status: 403 },
      );
    }

    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// DELETE - Permanent deletion disabled (soft-delete policy)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireSuperAdmin();
    const { id } = await params;
    const deletedDocId = parseInt(id);

    if (isNaN(deletedDocId)) {
      return NextResponse.json(
        { error: "Invalid document ID" },
        { status: 400 },
      );
    }

    const deletedDoc = await prisma.deletedDocument.findUnique({
      where: { id: deletedDocId },
      select: { id: true, name: true },
    });

    if (!deletedDoc) {
      return NextResponse.json(
        { error: "Deleted document not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(
      {
        error:
          "Permanent deletion is disabled. Recover the item from trash instead.",
        name: deletedDoc.name,
      },
      { status: 403 },
    );
  } catch (error: any) {
    console.error("Error permanently deleting document:", error);

    if (error.message === "Super admin access required") {
      return NextResponse.json(
        { error: "Only superadmin can permanently delete documents" },
        { status: 403 },
      );
    }

    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
