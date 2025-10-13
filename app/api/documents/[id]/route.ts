import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { requireAdmin } from '@/lib/auth';
import { deleteFromR2, extractFileNameFromUrl } from '@/lib/r2-client';

const prisma = new PrismaClient();

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check if user is admin
    await requireAdmin();

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

    // Delete from R2
    const fileName = document.fileName;
    await deleteFromR2(fileName);

    // Delete from database
    await prisma.document.delete({
      where: { id: documentId },
    });

    return NextResponse.json({
      success: true,
      message: 'Document deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting document:', error);

    if (error.message === 'Forbidden') {
      return NextResponse.json(
        { error: 'Only admins can delete files' },
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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check if user is admin
    await requireAdmin();

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
        { error: 'Only admins can rename files' },
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
