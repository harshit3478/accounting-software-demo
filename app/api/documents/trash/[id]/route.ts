import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireSuperAdmin } from '@/lib/auth';
import { deleteFromR2 } from '@/lib/r2-client';
import { DocumentType } from '@prisma/client';

// POST - Recover deleted document or folder
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

    if (deletedDoc.type === DocumentType.folder) {
      // Check if original parent folder still exists
      let targetParentId = deletedDoc.originalParentId;
      let restoredName = deletedDoc.name;
      
      if (targetParentId) {
        const parentExists = await prisma.document.findUnique({
          where: { id: targetParentId, type: DocumentType.folder }
        });
        
        if (!parentExists) {
          // Parent was deleted, fallback to root with [RECOVERED] prefix
          targetParentId = null;
          restoredName = `[RECOVERED] ${deletedDoc.name}`;
        }
      } else {
        // Was originally at root, add prefix
        restoredName = `[RECOVERED] ${deletedDoc.name}`;
      }
      
      // Check for duplicate names and auto-rename if needed
      const existingFolder = await prisma.document.findFirst({
        where: {
          parentId: targetParentId,
          name: restoredName,
          type: DocumentType.folder
        }
      });
      
      if (existingFolder) {
        // Auto-rename with timestamp
        const timestamp = Date.now();
        restoredName = `${restoredName} (${timestamp})`;
      }
      
      // Parse folder contents for recursive restoration
      const folderContents = deletedDoc.folderContents as any;
      const descendants = folderContents?.descendants || [];
      
      // Start transaction for atomic restoration
      await prisma.$transaction(async (tx) => {
        // 1. Restore the main folder
        const restoredFolder = await tx.document.create({
          data: {
            userId: user.id,
            type: DocumentType.folder,
            name: restoredName,
            parentId: targetParentId,
            uploadedAt: new Date(),
          }
        });
        
        // 2. Build ID mapping: old ID -> new ID (for parent relationships)
        const idMapping = new Map<number, number>();
        idMapping.set(deletedDoc.originalDocId, restoredFolder.id);
        
        // 3. Sort descendants by depth (parents before children)
        const sortedDescendants = [...descendants].sort((a, b) => {
          // Calculate depth based on parent chain
          const getDepth = (item: any): number => {
            let depth = 0;
            let currentParentId = item.parentId;
            while (currentParentId !== deletedDoc.originalDocId && currentParentId !== null) {
              depth++;
              const parent = descendants.find((d: any) => d.id === currentParentId);
              if (!parent) break;
              currentParentId = parent.parentId;
            }
            return depth;
          };
          return getDepth(a) - getDepth(b);
        });
        
        // 4. Restore all descendants recursively
        for (const desc of sortedDescendants) {
          // Map old parent ID to new parent ID
          let newParentId: number | null;
          if (desc.parentId === deletedDoc.originalDocId) {
            // Direct child of the main folder
            newParentId = restoredFolder.id;
          } else if (idMapping.has(desc.parentId)) {
            // Child of a restored subfolder
            newParentId = idMapping.get(desc.parentId)!;
          } else {
            // Parent not found, skip this item
            console.warn(`Skipping ${desc.name}: parent ${desc.parentId} not found`);
            continue;
          }
          
          if (desc.type === DocumentType.folder) {
            // Restore subfolder
            const restoredSubfolder = await tx.document.create({
              data: {
                userId: user.id,
                type: DocumentType.folder,
                name: desc.name,
                parentId: newParentId,
                uploadedAt: new Date(desc.uploadedAt || Date.now()),
              }
            });
            idMapping.set(desc.id, restoredSubfolder.id);
          } else {
            // Restore file
            await tx.document.create({
              data: {
                userId: user.id,
                type: DocumentType.file,
                name: desc.name,
                parentId: newParentId,
                fileName: desc.fileName,
                fileSize: desc.fileSize ? BigInt(desc.fileSize) : null,
                fileType: desc.fileType,
                fileUrl: desc.fileUrl,
                uploadedAt: new Date(desc.uploadedAt || Date.now()),
              }
            });
          }
        }
        
        // 5. Remove from trash
        await tx.deletedDocument.delete({
          where: { id: deletedDocId }
        });
      });
      
      const locationMsg = targetParentId 
        ? `to its original location${deletedDoc.parentPath ? ` (${deletedDoc.parentPath})` : ''}`
        : 'to root level';
      
      const restoredCount = descendants.length + 1; // +1 for the folder itself
      const fileCount = descendants.filter((d: any) => d.type === DocumentType.file).length;
      const folderCount = descendants.filter((d: any) => d.type === DocumentType.folder).length;

      return NextResponse.json({
        success: true,
        message: `Folder "${deletedDoc.name}" with all contents recovered ${locationMsg}. Originally created by ${deletedDoc.originalUploader.name}.`,
        restoredCount,
        details: {
          folders: folderCount + 1,
          files: fileCount
        },
        type: 'folder'
      });
    } else {
      // Check if original parent folder still exists
      let targetParentId = deletedDoc.originalParentId;
      let restoredName = deletedDoc.name;
      
      if (targetParentId) {
        const parentExists = await prisma.document.findUnique({
          where: { id: targetParentId, type: DocumentType.folder }
        });
        
        if (!parentExists) {
          // Parent was deleted, fallback to root with [RECOVERED] prefix
          targetParentId = null;
          restoredName = `[RECOVERED] ${deletedDoc.name}`;
        }
      } else {
        // Was originally at root, add prefix
        restoredName = `[RECOVERED] ${deletedDoc.name}`;
      }
      
      // Check for duplicate names and auto-rename if needed
      const existingFile = await prisma.document.findFirst({
        where: {
          parentId: targetParentId,
          name: restoredName,
          type: DocumentType.file
        }
      });
      
      if (existingFile) {
        // Auto-rename with timestamp
        const timestamp = Date.now();
        const nameParts = restoredName.split('.');
        if (nameParts.length > 1) {
          const ext = nameParts.pop();
          restoredName = `${nameParts.join('.')} (${timestamp}).${ext}`;
        } else {
          restoredName = `${restoredName} (${timestamp})`;
        }
      }
      
      // Restore file
      const restoredDoc = await prisma.document.create({
        data: {
          userId: user.id, // Mark as recovered by superadmin
          type: DocumentType.file,
          name: restoredName,
          parentId: targetParentId,
          fileName: deletedDoc.fileName,
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
      
      const locationMsg = targetParentId 
        ? `to its original location${deletedDoc.parentPath ? ` (${deletedDoc.parentPath})` : ''}`
        : 'to root level';

      return NextResponse.json({
        success: true,
        message: `File recovered successfully ${locationMsg}. Originally uploaded by ${deletedDoc.originalUploader.name}.`,
        document: {
          ...restoredDoc,
          fileSize: restoredDoc.fileSize ? Number(restoredDoc.fileSize) : null
        },
        type: 'file'
      });
    }
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

// DELETE - Permanently delete document or folder
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

    if (deletedDoc.type === DocumentType.folder) {
      // For folders, we must delete all contained files from R2
      let deletedCount = 0;
      
      if (deletedDoc.folderContents) {
        const contents = deletedDoc.folderContents as any;
        const descendants = contents.descendants || [];
        
        // Iterate through all descendants and delete files from R2
        for (const item of descendants) {
          // Check if it's a file (using string check or enum if available in JSON)
          // The JSON data might have 'file' or 'folder' strings or enum values
          if ((item.type === 'file' || item.type === DocumentType.file) && item.fileName) {
            try {
              await deleteFromR2(item.fileName);
              deletedCount++;
            } catch (r2Error) {
              console.error(`Failed to delete nested file ${item.fileName} from R2:`, r2Error);
              // Continue deleting others
            }
          }
        }
      }

      // Remove from trash table
      await prisma.deletedDocument.delete({
        where: { id: deletedDocId }
      });

      return NextResponse.json({
        success: true,
        message: `Folder "${deletedDoc.name}" and its contents (${deletedCount} files cleaned from storage) permanently deleted`,
        type: 'folder'
      });
    } else {
      // For files, delete from R2 storage if fileName exists
      if (deletedDoc.fileName) {
        try {
          await deleteFromR2(deletedDoc.fileName);
        } catch (r2Error) {
          console.error('Error deleting from R2:', r2Error);
          // Continue even if R2 deletion fails
        }
      }

      // Remove from trash table
      await prisma.deletedDocument.delete({
        where: { id: deletedDocId }
      });

      return NextResponse.json({
        success: true,
        message: 'File permanently deleted from storage',
        type: 'file'
      });
    }
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
