import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireSuperAdmin } from '@/lib/auth';
import { deleteFromR2 } from '@/lib/r2-client';

// Trash retention period in days (must match trash/route.ts)
const TRASH_RETENTION_DAYS = 60;

// POST - Manual cleanup of documents older than 60 days
export async function POST(request: NextRequest) {
  try {
    await requireSuperAdmin();

    // Find all documents older than 60 days
    const retentionThreshold = new Date(Date.now() - TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000);

    const oldDocs = await prisma.deletedDocument.findMany({
      where: {
        deletedAt: {
          lt: retentionThreshold
        }
      }
    });

    if (oldDocs.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No documents to clean up',
        deletedCount: 0,
        failedCount: 0
      });
    }

    let deletedCount = 0;
    let failedCount = 0;
    const failedFiles: string[] = [];

    // Delete each one permanently
    for (const doc of oldDocs) {
      try {
        // Delete from R2 storage (only if it's a file with fileName)
        if (doc.type === 'file' && doc.fileName) {
          await deleteFromR2(doc.fileName);
        }
        
        // Delete from database
        await prisma.deletedDocument.delete({ 
          where: { id: doc.id } 
        });
        
        deletedCount++;
      } catch (error) {
        console.error(`Failed to delete ${doc.name}:`, error);
        failedCount++;
        failedFiles.push(doc.name || 'Unknown');
      }
    }

    return NextResponse.json({
      success: true,
      message: `Cleanup complete: ${deletedCount} permanently deleted, ${failedCount} failed`,
      deletedCount,
      failedCount,
      failedFiles: failedCount > 0 ? failedFiles : undefined
    });
  } catch (error: any) {
    console.error('Error during cleanup:', error);

    if (error.message === 'Super admin access required') {
      return NextResponse.json(
        { error: 'Only superadmin can perform cleanup' },
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
