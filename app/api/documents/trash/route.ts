import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireSuperAdmin } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    // Only superadmin can view deleted documents
    await requireSuperAdmin();

    const { searchParams } = new URL(request.url);
    const showAll = searchParams.get('showAll') === 'true'; // For showing expired ones too

    const where = showAll ? {} : {
      // Only show documents less than 30 days old by default
      deletedAt: {
        gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
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

    // Calculate days remaining for each document
    const deletedDocsWithDaysRemaining = deletedDocs.map(doc => {
      const deletedDate = new Date(doc.deletedAt);
      const expiryDate = new Date(deletedDate.getTime() + 30 * 24 * 60 * 60 * 1000);
      const now = new Date();
      const daysRemaining = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      
      return {
        ...doc,
        fileSize: Number(doc.fileSize),
        daysRemaining: Math.max(0, daysRemaining),
        expiryDate: expiryDate.toISOString(),
        isExpired: daysRemaining <= 0
      };
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
