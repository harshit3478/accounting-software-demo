import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../lib/prisma';
import { requireAuth } from '../../../lib/auth';
import { DocumentType } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    // Check if user is authenticated
    await requireAuth();

    // Get folder filter from query params (SHARED STORAGE)
    const { searchParams } = new URL(request.url);
    const folderIdParam = searchParams.get('folderId');
    const folderId = folderIdParam ? parseInt(folderIdParam) : null;
    
    // If folderId is provided but invalid, return error
    if (folderIdParam !== null && isNaN(folderId as number)) {
      return NextResponse.json(
        { error: 'Invalid folder ID' },
        { status: 400 }
      );
    }
    
    // If specific folder requested, verify it exists (SHARED - no user filter!)
    if (folderId !== null && folderId !== 0) {
      const folder = await prisma.document.findFirst({
        where: {
          id: folderId,
          type: DocumentType.folder
          // NO userId filter - shared storage!
        }
      });
      
      if (!folder) {
        return NextResponse.json(
          { error: 'Folder not found' },
          { status: 404 }
        );
      }
    }
    
    // Get documents in specified folder (or root if folderId is null/0)
    // SHARED STORAGE - no user filtering!
    const documents = await prisma.document.findMany({
      where: {
        parentId: folderId === 0 ? null : folderId
        // NO userId filter - shared storage!
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
      orderBy: [
        { type: 'asc' },      // Folders first
        { name: 'asc' }       // Then alphabetically by name
      ],
    });

    // Convert BigInt to Number for JSON serialization
    const formattedDocuments = documents.map((doc) => ({
      id: doc.id,
      type: doc.type,
      name: doc.name,
      // File-specific fields (null for folders)
      fileName: doc.fileName || null,
      fileSize: doc.fileSize ? Number(doc.fileSize) : null,
      fileType: doc.fileType || null,
      fileUrl: doc.fileUrl || null,
      // Common fields
      uploadedBy: doc.user.name,
      uploadedByEmail: doc.user.email,
      uploadedAt: doc.uploadedAt,
      updatedAt: doc.updatedAt,
      userId: doc.userId,
      parentId: doc.parentId,
    }));

    return NextResponse.json({
      documents: formattedDocuments,
      folderId: folderId === 0 ? null : folderId,
      isRoot: folderId === null || folderId === 0
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
