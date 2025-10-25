import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireSuperAdmin } from '@/lib/auth';
import { deleteFromR2 } from '@/lib/r2-client';

// POST - Recover deleted document
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireSuperAdmin();
    const { id } = await params;
    const deletedDocId = parseInt(id);

    if (isNaN(deletedDocId)) {
      return NextResponse.json(
        { error: 'Invalid document ID' },
        { status: 400 }
      );
    }

    // Find deleted document
    const deletedDoc = await prisma.deletedDocument.findUnique({
      where: { id: deletedDocId },
      include: {
        originalUploader: {
          select: { name: true }
        }
      }
    });

    if (!deletedDoc) {
      return NextResponse.json(
        { error: 'Deleted document not found' },
        { status: 404 }
      );
    }

    // Restore to Document table (as recovered by superadmin with new upload date)
    const restoredDoc = await prisma.document.create({
      data: {
        userId: user.id, // Mark as recovered by superadmin
        fileName: deletedDoc.fileName,
        originalName: `[RECOVERED] ${deletedDoc.originalName}`,
        fileSize: deletedDoc.fileSize,
        fileType: deletedDoc.fileType,
        fileUrl: deletedDoc.fileUrl,
        uploadedAt: new Date(), // New upload date
      }
    });

    // Remove from trash
    await prisma.deletedDocument.delete({
      where: { id: deletedDocId }
    });

    return NextResponse.json({
      success: true,
      message: `Document recovered successfully. Originally uploaded by ${deletedDoc.originalUploader.name}.`,
      document: {
        ...restoredDoc,
        fileSize: Number(restoredDoc.fileSize)
      }
    });
  } catch (error: any) {
    console.error('Error recovering document:', error);

    if (error.message === 'Super admin access required') {
      return NextResponse.json(
        { error: 'Only superadmin can recover documents' },
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

// DELETE - Permanently delete document
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireSuperAdmin();
    const { id } = await params;
    const deletedDocId = parseInt(id);

    if (isNaN(deletedDocId)) {
      return NextResponse.json(
        { error: 'Invalid document ID' },
        { status: 400 }
      );
    }

    // Find deleted document
    const deletedDoc = await prisma.deletedDocument.findUnique({
      where: { id: deletedDocId }
    });

    if (!deletedDoc) {
      return NextResponse.json(
        { error: 'Deleted document not found' },
        { status: 404 }
      );
    }

    // NOW actually delete from R2 storage
    try {
      await deleteFromR2(deletedDoc.fileName);
    } catch (r2Error) {
      console.error('Error deleting from R2:', r2Error);
      // Continue even if R2 deletion fails
    }

    // Remove from trash table
    await prisma.deletedDocument.delete({
      where: { id: deletedDocId }
    });

    return NextResponse.json({
      success: true,
      message: 'Document permanently deleted from storage'
    });
  } catch (error: any) {
    console.error('Error permanently deleting document:', error);

    if (error.message === 'Super admin access required') {
      return NextResponse.json(
        { error: 'Only superadmin can permanently delete documents' },
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
