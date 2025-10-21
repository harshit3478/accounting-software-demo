import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../lib/prisma';
import { requireAuth } from '../../../lib/auth';

export async function GET(request: NextRequest) {
  try {
    // Check if user is authenticated
    await requireAuth();

    // Get all documents, sorted by most recent
    const documents = await prisma.document.findMany({
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        uploadedAt: 'desc',
      },
    });

    // Convert BigInt to Number for JSON serialization
    const formattedDocuments = documents.map((doc) => ({
      id: doc.id,
      fileName: doc.originalName,
      fileSize: Number(doc.fileSize),
      fileType: doc.fileType,
      fileUrl: doc.fileUrl,
      uploadedBy: doc.user.name,
      uploadedByEmail: doc.user.email,
      uploadedAt: doc.uploadedAt,
      userId: doc.userId,
    }));

    return NextResponse.json({
      documents: formattedDocuments,
    });
  } catch (error: any) {
    console.error('Error fetching documents:', error);

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
