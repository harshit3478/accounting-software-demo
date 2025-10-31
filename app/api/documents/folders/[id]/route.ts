import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requirePermission } from '@/lib/auth';
import { DocumentType } from '@prisma/client';

// GET - Get folder details with children
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // No permission check - everyone can view (shared storage)
    const folderId = parseInt(params.id);
    
    if (isNaN(folderId)) {
      return NextResponse.json(
        { error: 'Invalid folder ID' },
        { status: 400 }
      );
    }
    
    const folder = await prisma.document.findUnique({
      where: {
        id: folderId
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
            name: true,
            type: true
          }
        },
        children: {
          orderBy: [
            { type: 'asc' }, // Folders first
            { name: 'asc' }  // Then alphabetically
          ],
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
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
    
    // Add metadata
    const response = {
      folder,
      metadata: {
        totalChildren: folder.children.length,
        folderCount: folder.children.filter(c => c.type === DocumentType.folder).length,
        fileCount: folder.children.filter(c => c.type === DocumentType.file).length
      }
    };
    
    return NextResponse.json(response);
  } catch (error: any) {
    console.error('Get folder error:', error);
    return NextResponse.json(
      { error: 'Failed to get folder', details: error.message },
      { status: 500 }
    );
  }
}

// PATCH - Rename folder
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requirePermission('documents.rename');
    const folderId = parseInt(params.id);
    const { name } = await request.json();
    
    if (isNaN(folderId)) {
      return NextResponse.json(
        { error: 'Invalid folder ID' },
        { status: 400 }
      );
    }
    
    if (!name?.trim()) {
      return NextResponse.json(
        { error: 'Folder name is required' },
        { status: 400 }
      );
    }

    // Validate name
    if (name.includes('/') || name.includes('\\') || name.includes('\0')) {
      return NextResponse.json(
        { error: 'Folder name cannot contain slashes or null characters' },
        { status: 400 }
      );
    }
    
    // Check folder exists (SHARED - no user filter!)
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
    
    if (!folder || folder.type !== DocumentType.folder) {
      return NextResponse.json(
        { error: 'Folder not found' },
        { status: 404 }
      );
    }
    
    // Check for duplicate name in same parent (SHARED storage)
    const existing = await prisma.document.findFirst({
      where: {
        name: name.trim(),
        parentId: folder.parentId,
        type: DocumentType.folder,
        id: { not: folderId }
        // NO userId filter - shared storage!
      }
    });
    
    if (existing) {
      return NextResponse.json(
        { error: 'A folder with this name already exists here' },
        { status: 409 }
      );
    }
    
    // Rename folder
    const updated = await prisma.document.update({
      where: { id: folderId },
      data: {
        name: name.trim(),
        updatedAt: new Date()
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
    
    console.log(`✅ Folder renamed: "${folder.name}" → "${updated.name}" by ${user.name}`);
    
    return NextResponse.json({ folder: updated });
  } catch (error: any) {
    console.error('Rename folder error:', error);
    
    if (error.message === 'Unauthorized' || error.message?.includes('permission')) {
      return NextResponse.json(
        { error: 'You do not have permission to rename folders' },
        { status: 403 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to rename folder', details: error.message },
      { status: 500 }
    );
  }
}

// DELETE - Delete folder (move to trash with contents)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requirePermission('documents.delete');
    const folderId = parseInt(params.id);
    
    if (isNaN(folderId)) {
      return NextResponse.json(
        { error: 'Invalid folder ID' },
        { status: 400 }
      );
    }
    
    // Get folder with all descendants (recursive query needed)
    const folder = await prisma.document.findUnique({
      where: {
        id: folderId
        // NO userId filter - shared storage!
      },
      include: {
        children: true
      }
    });
    
    if (!folder || folder.type !== DocumentType.folder) {
      return NextResponse.json(
        { error: 'Folder not found' },
        { status: 404 }
      );
    }
    
    // Get all descendants (files and folders)
    const getAllDescendants = async (parentId: number): Promise<any[]> => {
      const children = await prisma.document.findMany({
        where: { parentId },
        include: { children: true }
      });
      
      let all = [...children];
      for (const child of children) {
        if (child.type === DocumentType.folder) {
          const descendants = await getAllDescendants(child.id);
          all = [...all, ...descendants];
        }
      }
      return all;
    };
    
    const allDescendants = await getAllDescendants(folderId);
    const fileCount = allDescendants.filter(d => d.type === DocumentType.file).length;
    const folderCount = allDescendants.filter(d => d.type === DocumentType.folder).length;
    
    // Build folder contents snapshot for trash with FULL metadata
    const folderContents = {
      totalItems: allDescendants.length,
      files: fileCount,
      folders: folderCount,
      descendants: allDescendants.map(d => ({
        id: d.id,
        name: d.name,
        type: d.type,
        parentId: d.parentId,
        // File-specific metadata (needed for restoration)
        fileName: d.fileName || null,
        fileSize: d.fileSize ? d.fileSize.toString() : null,
        fileType: d.fileType || null,
        fileUrl: d.fileUrl || null,
        uploadedAt: d.uploadedAt.toISOString()
      }))
    };
    
    // Move to trash
    await prisma.$transaction([
      // Create deleted document record
      prisma.deletedDocument.create({
        data: {
          userId: user.id,
          originalDocId: folder.id,
          type: DocumentType.folder,
          name: folder.name,
          originalParentId: folder.parentId,
          folderContents: folderContents as any,
          deletedBy: user.id,
          uploadedAt: folder.uploadedAt,
          // File fields null for folders
          fileName: null,
          fileSize: null,
          fileType: null,
          fileUrl: null
        }
      }),
      // Delete folder (CASCADE will delete all descendants)
      prisma.document.delete({
        where: { id: folderId }
      })
    ]);
    
    console.log(`✅ Folder deleted: "${folder.name}" (${fileCount} files, ${folderCount} folders) by ${user.name}`);
    
    return NextResponse.json({
      message: 'Folder moved to trash',
      deletedCount: allDescendants.length + 1, // +1 for the folder itself
      details: {
        folderName: folder.name,
        files: fileCount,
        folders: folderCount
      }
    });
  } catch (error: any) {
    console.error('Delete folder error:', error);
    
    if (error.message === 'Unauthorized' || error.message?.includes('permission')) {
      return NextResponse.json(
        { error: 'You do not have permission to delete folders' },
        { status: 403 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to delete folder', details: error.message },
      { status: 500 }
    );
  }
}
