import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { requirePermission } from '@/lib/auth';
import { uploadToR2 } from '@/lib/r2-client';
import {
  MAX_FILE_SIZE,
  MAX_TOTAL_STORAGE,
  isValidFileType,
  isValidFileSize,
  generateUniqueFileName,
  formatFileSize,
} from '@/lib/file-utils';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    // Check if user has upload permission
    const user = await requirePermission('documents.upload');

    // Parse the form data
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: 'No files provided' },
        { status: 400 }
      );
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

      try {
        // Convert file to buffer
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Generate unique filename
        const uniqueFileName = generateUniqueFileName(file.name);

        // Upload to R2
        const fileUrl = await uploadToR2(buffer, uniqueFileName, file.type);

        // Save metadata to database
        const document = await prisma.document.create({
          data: {
            userId: user.id,
            fileName: uniqueFileName,
            originalName: file.name,
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
          fileName: document.originalName,
          fileSize: Number(document.fileSize),
          fileType: document.fileType,
          uploadedBy: document.user.name,
          uploadedAt: document.uploadedAt,
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
