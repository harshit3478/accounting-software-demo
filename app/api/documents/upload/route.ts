import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requirePermission } from '@/lib/auth';
import { uploadToR2 } from '@/lib/r2-client';
import { DocumentType } from '@prisma/client';
import {
  MAX_FILE_SIZE,
  MAX_TOTAL_STORAGE,
  isValidFileType,
  isValidFileSize,
  generateUniqueFileName,
  formatFileSize,
} from '@/lib/file-utils';

export async function POST(request: NextRequest) {
  try {
    // Check if user has upload permission
    const user = await requirePermission('documents.upload');

    // Parse the form data
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    const folderIdParam = formData.get('folderId') as string | null;
    const folderId = folderIdParam ? parseInt(folderIdParam) : null;

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: 'No files provided' },
        { status: 400 }
      );
    }
    
    // Validate folder if specified (SHARED STORAGE - no user filter!)
    if (folderId !== null && folderId !== 0) {
      if (isNaN(folderId)) {
        return NextResponse.json(
          { error: 'Invalid folder ID' },
          { status: 400 }
        );
      }
      
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

    // Check total current storage usage
    const currentUsage = await prisma.document.aggregate({
      _sum: {
        fileSize: true,
      },
    });

    const totalUsed = Number(currentUsage._sum.fileSize || 0);

    // Calculate total size of new files
    const newFilesSize = files.reduce((sum, file) => sum + file.size, 0);

    // Check if upload would exceed storage limit
    if (totalUsed + newFilesSize > MAX_TOTAL_STORAGE) {
      return NextResponse.json(
        {
          error: 'Storage limit exceeded',
          message: `Upload would exceed 100GB limit. Current usage: ${formatFileSize(totalUsed)}, Attempting to add: ${formatFileSize(newFilesSize)}`,
        },
        { status: 413 }
      );
    }

    // Validate each file
    const uploadResults = [];
    const errors = [];

    for (const file of files) {
      // Validate file size
      if (!isValidFileSize(file.size)) {
        errors.push({
          fileName: file.name,
          error: `File size exceeds ${formatFileSize(MAX_FILE_SIZE)} limit`,
        });
        continue;
      }

      // Validate file type
      if (!isValidFileType(file.type)) {
        errors.push({
          fileName: file.name,
          error: 'File type not supported',
        });
        continue;
      }
      
      // Check for duplicate name in target folder (SHARED storage)
      const existing = await prisma.document.findFirst({
        where: {
          name: file.name,
          parentId: folderId === 0 ? null : folderId,
          type: DocumentType.file
          // NO userId filter - shared storage!
        }
      });
      
      if (existing) {
        errors.push({
          fileName: file.name,
          error: 'A file with this name already exists in this folder',
        });
        continue;
      }

      try {
        // Convert file to buffer
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Generate unique filename for R2 storage
        const uniqueFileName = generateUniqueFileName(file.name);

        // Upload to R2
        const fileUrl = await uploadToR2(buffer, uniqueFileName, file.type);

        // Save metadata to database (userId for audit trail)
        const document = await prisma.document.create({
          data: {
            userId: user.id,      // Who uploaded (audit trail)
            type: DocumentType.file,
            name: file.name,      // Display name
            parentId: folderId === 0 ? null : folderId,
            fileName: uniqueFileName,  // R2 filename
            fileSize: BigInt(file.size),
            fileType: file.type,
            fileUrl: fileUrl,
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
        });

        uploadResults.push({
          id: document.id,
          name: document.name,
          fileName: document.fileName,
          fileSize: Number(document.fileSize),
          fileType: document.fileType,
          uploadedBy: document.user.name,
          uploadedAt: document.uploadedAt,
          parentId: document.parentId,
        });
      } catch (error) {
        console.error(`Error uploading file ${file.name}:`, error);
        errors.push({
          fileName: file.name,
          error: 'Failed to upload file',
        });
      }
    }

    // Return results
    return NextResponse.json({
      success: true,
      uploaded: uploadResults,
      errors: errors.length > 0 ? errors : undefined,
      message: `Successfully uploaded ${uploadResults.length} of ${files.length} files`,
    });
  } catch (error: any) {
    console.error('Upload error:', error);

    if (error.message === 'Forbidden') {
      return NextResponse.json(
        { error: 'Only admins can upload files' },
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
