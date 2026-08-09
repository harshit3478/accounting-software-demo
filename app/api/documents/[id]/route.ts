import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requirePermission, getUserFromToken } from "@/lib/auth";
import { DocumentType } from "@prisma/client";

// Helper to recursively get all non-deleted descendants of a folder
async function getFolderDescendants(folderId: number) {
  const descendants = [];
  const queue = [folderId];

  while (queue.length > 0) {
    const currentId = queue.shift();
    const children = await prisma.document.findMany({
      where: { parentId: currentId, isDeleted: false },
    });

    for (const child of children) {
      descendants.push(child);
      if (child.type === DocumentType.folder) {
        queue.push(child.id);
      }
    }
  }
  return descendants;
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requirePermission("documents.delete");
    const currentUser = await getUserFromToken();

    const { id } = await params;
    const documentId = parseInt(id);

    if (isNaN(documentId)) {
      return NextResponse.json(
        { error: "Invalid document ID" },
        { status: 400 },
      );
    }

    const document = await prisma.document.findUnique({
      where: { id: documentId },
    });

    if (!document || document.isDeleted) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 },
      );
    }

    const now = new Date();
    const deletedBy = currentUser!.id;

    let folderContents = null;
    let descendantIds: number[] = [];
    if (document.type === DocumentType.folder) {
      const descendants = await getFolderDescendants(document.id);
      descendantIds = descendants.map((d) => d.id);
      folderContents = {
        totalItems: descendants.length,
        files: descendants.filter((d) => d.type === DocumentType.file).length,
        folders: descendants.filter((d) => d.type === DocumentType.folder)
          .length,
        descendants: descendants.map((d) => ({
          id: d.id,
          name: d.name,
          type: d.type,
          parentId: d.parentId,
          fileName: d.fileName || null,
          fileSize: d.fileSize ? d.fileSize.toString() : null,
          fileType: d.fileType || null,
          fileUrl: d.fileUrl || null,
          uploadedAt: d.uploadedAt.toISOString(),
        })),
      };
    }

    await prisma.$transaction(async (tx) => {
      await tx.deletedDocument.create({
        data: {
          originalDocId: document.id,
          userId: document.userId,
          type: document.type,
          name: document.name,
          folderContents: folderContents ? (folderContents as any) : undefined,
          originalParentId: document.parentId,
          fileName: document.fileName,
          fileSize: document.fileSize,
          fileType: document.fileType,
          fileUrl: document.fileUrl,
          uploadedAt: document.uploadedAt,
          deletedBy,
          deletedAt: now,
          deleteReason: null,
        },
      });

      const idsToSoftDelete = [document.id, ...descendantIds];
      await tx.document.updateMany({
        where: { id: { in: idsToSoftDelete } },
        data: {
          isDeleted: true,
          deletedAt: now,
          deletedBy,
        },
      });
    });

    return NextResponse.json({
      success: true,
      message: "Document moved to trash.",
      deactivated: true,
    });
  } catch (error: any) {
    console.error("Error deleting document:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requirePermission("documents.rename");

    const { id } = await params;
    const documentId = parseInt(id);

    if (isNaN(documentId)) {
      return NextResponse.json(
        { error: "Invalid document ID" },
        { status: 400 },
      );
    }

    const body = await request.json();
    const { name, newName } = body;
    const nameToUse = name || newName;

    if (
      !nameToUse ||
      typeof nameToUse !== "string" ||
      nameToUse.trim().length === 0
    ) {
      return NextResponse.json({ error: "Invalid file name" }, { status: 400 });
    }

    const document = await prisma.document.findUnique({
      where: { id: documentId },
    });

    if (!document || document.isDeleted) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 },
      );
    }

    const updatedDocument = await prisma.document.update({
      where: { id: documentId },
      data: {
        name: nameToUse.trim(),
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: "Document renamed successfully",
      document: {
        id: updatedDocument.id,
        name: updatedDocument.name,
        fileName: updatedDocument.fileName,
        fileSize: updatedDocument.fileSize
          ? Number(updatedDocument.fileSize)
          : null,
        fileType: updatedDocument.fileType,
        fileUrl: updatedDocument.fileUrl,
        uploadedBy: updatedDocument.user.name,
        uploadedAt: updatedDocument.uploadedAt,
      },
    });
  } catch (error: any) {
    console.error("Error renaming document:", error);

    if (error.message === "Forbidden") {
      return NextResponse.json(
        { error: "You do not have permission to rename files" },
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

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requirePermission("documents.rename");

    const { id } = await params;
    const documentId = parseInt(id);

    if (isNaN(documentId)) {
      return NextResponse.json(
        { error: "Invalid document ID" },
        { status: 400 },
      );
    }

    const { originalName } = await request.json();

    if (!originalName) {
      return NextResponse.json(
        { error: "New name is required" },
        { status: 400 },
      );
    }

    const existing = await prisma.document.findUnique({
      where: { id: documentId },
      select: { id: true, isDeleted: true },
    });
    if (!existing || existing.isDeleted) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 },
      );
    }

    const document = await prisma.document.update({
      where: { id: documentId },
      data: { originalName },
    });

    return NextResponse.json({
      success: true,
      document,
    });
  } catch (error: any) {
    console.error("Error renaming document:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
