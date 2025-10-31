import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireSuperAdmin } from '@/lib/auth';
import { DocumentType } from '@prisma/client';

// Trash retention period in days
const TRASH_RETENTION_DAYS = 60;

export async function GET(request: NextRequest) {
  try {
    // Only superadmin can view deleted documents
    await requireSuperAdmin();

    const { searchParams } = new URL(request.url);
    const showAll = searchParams.get('showAll') === 'true'; // For showing expired ones too

    const where = showAll ? {} : {
      // Only show documents less than 60 days old by default
      deletedAt: {
        gte: new Date(Date.now() - TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000)
      }
    };

    const deletedDocs = await prisma.deletedDocument.findMany({
      where,
      include: {
        originalUploader: { 
          select: { 
            id: true, 
            name: true, 
            email: true 
          } 
        },
        deleter: { 
          select: { 
            id: true, 
            name: true, 
            email: true 
          } 
        }
      },
      orderBy: { deletedAt: 'desc' }
    });

    // Calculate days remaining and format each document/folder
    const deletedDocsWithDaysRemaining = deletedDocs.map(doc => {
      const deletedDate = new Date(doc.deletedAt);
      const expiryDate = new Date(deletedDate.getTime() + TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000);
      const now = new Date();
      const daysRemaining = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      
      const baseData = {
        id: doc.id,
        originalDocId: doc.originalDocId,
        userId: doc.userId,
        type: doc.type,
        name: doc.name,
        deletedBy: doc.deletedBy,
        deletedAt: doc.deletedAt,
        deleteReason: doc.deleteReason,
        uploadedAt: doc.uploadedAt,
        originalUploader: doc.originalUploader,
        deleter: doc.deleter,
        daysRemaining: Math.max(0, daysRemaining),
        expiryDate: expiryDate.toISOString(),
        isExpired: daysRemaining <= 0
      };

      if (doc.type === DocumentType.folder) {
        // Parse folder contents
        let folderInfo = {
          totalItems: 0,
          files: 0,
          folders: 0
        };
        
        if (doc.folderContents) {
          const contents = doc.folderContents as any;
          folderInfo = {
            totalItems: contents.totalItems || 0,
            files: contents.files || 0,
            folders: contents.folders || 0
          };
        }

        return {
          ...baseData,
          folderContents: folderInfo,
          originalParentId: doc.originalParentId,
          parentPath: doc.parentPath
        };
      } else {
        // File data
        return {
          ...baseData,
          fileName: doc.fileName,
          fileSize: doc.fileSize ? Number(doc.fileSize) : null,
          fileType: doc.fileType,
          fileUrl: doc.fileUrl
        };
      }
    });

    return NextResponse.json(deletedDocsWithDaysRemaining);
  } catch (error: any) {
    console.error('Error fetching deleted documents:', error);

    if (error.message === 'Super admin access required') {
      return NextResponse.json(
        { error: 'Only superadmin can view deleted documents' },
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
