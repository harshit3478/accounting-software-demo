import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdmin, requirePermission } from '@/lib/auth';
import { deleteFromR2, extractFileNameFromUrl } from '@/lib/r2-client';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check if user has delete permission
    await requirePermission('documents.delete');

    // Get current user for tracking who deleted it
    const { getUserFromToken } = await import('@/lib/auth');
    const currentUser = await getUserFromToken();

    const { id } = await params;
    const documentId = parseInt(id);

    if (isNaN(documentId)) {
      return NextResponse.json(
        { error: 'Invalid document ID' },
        { status: 400 }
      );
    }

    // Find the document
    const document = await prisma.document.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    // Move to DeletedDocument table (soft delete - file stays in R2)
    await prisma.deletedDocument.create({
      data: {
        originalDocId: document.id,
        userId: document.userId,
        fileName: document.fileName,
        originalName: document.originalName,
        fileSize: document.fileSize,
        fileType: document.fileType,
        fileUrl: document.fileUrl,
        uploadedAt: document.uploadedAt,
        deletedBy: currentUser!.id,
        deletedAt: new Date(),
        deleteReason: null,
      }
    });

    // Delete from Document table (but file stays in R2 storage!)
    await prisma.document.delete({
      where: { id: documentId },
    });

    // Do NOT call deleteFromR2() anymore - file stays in storage for recovery

    return NextResponse.json({
      success: true,
      message: 'Document moved to trash. It will be permanently deleted after 30 days.',
    });
  } catch (error: any) {
    console.error('Error deleting document:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check if user has rename permission
    await requirePermission('documents.rename');

    const { id } = await params;
    const documentId = parseInt(id);

    if (isNaN(documentId)) {
      return NextResponse.json(
        { error: 'Invalid document ID' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { newName } = body;

    if (!newName || typeof newName !== 'string' || newName.trim().length === 0) {
      return NextResponse.json(
        { error: 'Invalid file name' },
        { status: 400 }
      );
    }

    // Find the document
    const document = await prisma.document.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    // Update the original name in database
    const updatedDocument = await prisma.document.update({
      where: { id: documentId },
      data: {
        originalName: newName.trim(),
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
      message: 'Document renamed successfully',
      document: {
        id: updatedDocument.id,
        fileName: updatedDocument.originalName,
        fileSize: Number(updatedDocument.fileSize),
        fileType: updatedDocument.fileType,
        fileUrl: updatedDocument.fileUrl,
        uploadedBy: updatedDocument.user.name,
        uploadedAt: updatedDocument.uploadedAt,
      },
    });
  } catch (error: any) {
    console.error('Error renaming document:', error);

    if (error.message === 'Forbidden') {
      return NextResponse.json(
        { error: 'You do not have permission to rename files' },
        { status: 403 }
      );
    }

    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check if user has rename permission
    await requirePermission('documents.rename');

    const { id } = await params;
    const documentId = parseInt(id);

    if (isNaN(documentId)) {
      return NextResponse.json(
        { error: 'Invalid document ID' },
        { status: 400 }
      );
    }

    const { originalName } = await request.json();

    if (!originalName) {
      return NextResponse.json(
        { error: 'New name is required' },
        { status: 400 }
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
    console.error('Error renaming document:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
