import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { DocumentType } from '@prisma/client';

interface BreadcrumbItem {
  id: number;
  name: string;
  type: 'folder';
}

// GET - Get breadcrumb path for a folder (SHARED STORAGE)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // No permission check - everyone can view (shared storage)
    const { id } = await params;
    const folderId = parseInt(id);
    
    if (isNaN(folderId)) {
      return NextResponse.json(
        { error: 'Invalid folder ID' },
        { status: 400 }
      );
    }
    
    // Get the folder
    const folder = await prisma.document.findUnique({
      where: {
        id: folderId
        // NO userId filter - shared storage!
      },
      select: {
        id: true,
        name: true,
        type: true,
        parentId: true
      }
    });
    
    if (!folder) {
      return NextResponse.json(
        { error: 'Folder not found' },
        { status: 404 }
      );
    }
    
    // Build breadcrumb path by traversing up
    const breadcrumb: BreadcrumbItem[] = [];
    let currentId: number | null = folder.parentId;
    
    // Add current folder
    if (folder.type === DocumentType.folder) {
      breadcrumb.unshift({
        id: folder.id,
        name: folder.name,
        type: 'folder'
      });
    }
    
    // Traverse up to root (max 10 iterations to prevent infinite loops)
    let iterations = 0;
    while (currentId && iterations < 10) {
      const parent = await prisma.document.findUnique({
        where: {
          id: currentId
          // NO userId filter - shared storage!
        },
        select: {
          id: true,
          name: true,
          type: true,
          parentId: true
        }
      });
      
      if (!parent || parent.type !== DocumentType.folder) break;
      
      breadcrumb.unshift({
        id: parent.id,
        name: parent.name,
        type: 'folder'
      });
      
      currentId = parent.parentId;
      iterations++;
    }
    
    // Add root
    const rootItem = {
      id: 0,
      name: 'All Documents',
      type: 'folder' as const
    };
    
    return NextResponse.json({
      breadcrumb: [rootItem, ...breadcrumb],
      depth: breadcrumb.length
    });
  } catch (error: any) {
    console.error('Get breadcrumb error:', error);
    return NextResponse.json(
      { error: 'Failed to get breadcrumb', details: error.message },
      { status: 500 }
    );
  }
}
