import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { DocumentType } from '@prisma/client';

// Recursive function to build folder tree
interface TreeNode {
  id: number;
  name: string;
  type: 'folder';
  parentId: number | null;
  children: TreeNode[];
  itemCount?: number;
}

async function buildFolderTree(parentId: number | null = null): Promise<TreeNode[]> {
  const folders = await prisma.document.findMany({
    where: {
      type: DocumentType.folder,
      parentId: parentId
      // NO userId filter - shared storage!
    },
    orderBy: { name: 'asc' },
    include: {
      _count: {
        select: {
          children: true
        }
      }
    }
  });

  const tree: TreeNode[] = [];
  
  for (const folder of folders) {
    const children = await buildFolderTree(folder.id);
    tree.push({
      id: folder.id,
      name: folder.name,
      type: 'folder',
      parentId: folder.parentId,
      children,
      itemCount: folder._count.children
    });
  }
  
  return tree;
}

// GET - Get complete folder tree (SHARED STORAGE)
export async function GET(request: NextRequest) {
  try {
    // No permission check - everyone can view (shared storage)
    const { searchParams } = new URL(request.url);
    const maxDepth = parseInt(searchParams.get('maxDepth') || '5');
    
    // Build the tree from root
    const tree = await buildFolderTree(null);
    
    // Get root-level stats
    const rootFiles = await prisma.document.count({
      where: {
        type: DocumentType.file,
        parentId: null
        // NO userId filter - shared storage!
      }
    });
    
    const totalFolders = await prisma.document.count({
      where: {
        type: DocumentType.folder
        // NO userId filter - shared storage!
      }
    });
    
    const totalFiles = await prisma.document.count({
      where: {
        type: DocumentType.file
        // NO userId filter - shared storage!
      }
    });
    
    return NextResponse.json({
      tree,
      metadata: {
        totalFolders,
        totalFiles,
        rootFiles,
        maxDepth
      }
    });
  } catch (error: any) {
    console.error('Get folder tree error:', error);
    return NextResponse.json(
      { error: 'Failed to get folder tree', details: error.message },
      { status: 500 }
    );
  }
}
