import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requirePermission } from '@/lib/auth';
import { DocumentType } from '@prisma/client';
import { invalidateDocuments } from '@/lib/cache-helpers';

// Helper: Calculate folder depth (max 5 levels)
async function getFolderDepth(folderId: number): Promise<number> {
  let depth = 0;
  let currentId: number | null = folderId;
  
  while (currentId && depth < 10) { // Safety limit to prevent infinite loops
    const folder: { parentId: number | null } | null = await prisma.document.findUnique({
      where: { id: currentId },
      select: { parentId: true }
    });
    
    if (!folder) break;
    currentId = folder.parentId;
    depth++;
  }
  
  return depth;
}

// POST - Create folder (SHARED STORAGE)
export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission('documents.upload');
    const { name, parentId } = await request.json();
    
    // Validation
    if (!name?.trim()) {
      return NextResponse.json(
        { error: 'Folder name is required' },
        { status: 400 }
      );
    }

    // Validate name (no slashes, no special characters that cause issues)
    if (name.includes('/') || name.includes('\\') || name.includes('\0')) {
      return NextResponse.json(
        { error: 'Folder name cannot contain slashes or null characters' },
        { status: 400 }
      );
    }
    
    // Check parent exists if specified (SHARED - no user filter!)
    if (parentId) {
      const parent = await prisma.document.findFirst({
        where: {
          id: parentId,
          type: DocumentType.folder
          // NO userId filter - shared storage!
        }
      });
      
      if (!parent) {
        return NextResponse.json(
          { error: 'Parent folder not found' },
          { status: 404 }
        );
      }
      
      // Check depth limit (max 5 levels)
      const depth = await getFolderDepth(parentId);
      if (depth >= 5) {
        return NextResponse.json(
          { error: 'Maximum folder depth (5 levels) reached' },
          { status: 400 }
        );
      }
    }
    
    // Check for duplicate name in same parent (SHARED storage - no user filter)
    const existing = await prisma.document.findFirst({
      where: {
        name: name.trim(),
        parentId: parentId || null,
        type: DocumentType.folder
        // NO userId filter - shared storage!
      }
    });
    
    if (existing) {
      return NextResponse.json(
        { error: 'A folder with this name already exists here' },
        { status: 409 }
      );
    }
    
    // Create folder (userId for audit trail only)
    const folder = await prisma.document.create({
      data: {
        userId: user.id,  // Who created it (audit trail)
        type: DocumentType.folder,
        name: name.trim(),
        parentId: parentId || null,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });
    
    console.log(`✅ Folder created: "${folder.name}" by ${user.name} (id: ${folder.id})`);
    
    // Invalidate document tree cache
    invalidateDocuments();

    return NextResponse.json({ folder }, { status: 201 });
  } catch (error: any) {
    console.error('Create folder error:', error);
    
    if (error.message === 'Unauthorized' || error.message?.includes('permission')) {
      return NextResponse.json(
        { error: 'You do not have permission to create folders' },
        { status: 403 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to create folder', details: error.message },
      { status: 500 }
    );
  }
}

// GET - Get folder details
export async function GET(request: NextRequest) {
  try {
    // No permission check - everyone can view (shared storage)
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json(
        { error: 'Folder ID is required' },
        { status: 400 }
      );
    }
    
    const folder = await prisma.document.findUnique({
      where: {
        id: parseInt(id),
        // NO userId filter - shared storage!
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        parent: {
          select: {
            id: true,
            name: true
          }
        },
        _count: {
          select: {
            children: true
          }
        }
      }
    });
    
    if (!folder || folder.type !== DocumentType.folder) {
      return NextResponse.json(
        { error: 'Folder not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ folder });
  } catch (error: any) {
    console.error('Get folder error:', error);
    return NextResponse.json(
      { error: 'Failed to get folder', details: error.message },
      { status: 500 }
    );
  }
}
