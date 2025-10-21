import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { MAX_TOTAL_STORAGE, formatFileSize, calculateStoragePercentage } from '@/lib/file-utils';

export async function GET(request: NextRequest) {
  try {
    // Check if user is authenticated
    await requireAuth();

    // Calculate total storage used
    const result = await prisma.document.aggregate({
      _sum: {
        fileSize: true,
      },
      _count: true,
    });

    const totalUsed = Number(result._sum.fileSize || 0);
    const fileCount = result._count;
    const percentage = calculateStoragePercentage(totalUsed, MAX_TOTAL_STORAGE);

    return NextResponse.json({
      used: totalUsed,
      total: MAX_TOTAL_STORAGE,
      percentage,
      usedFormatted: formatFileSize(totalUsed),
      totalFormatted: formatFileSize(MAX_TOTAL_STORAGE),
      fileCount,
      available: MAX_TOTAL_STORAGE - totalUsed,
      availableFormatted: formatFileSize(MAX_TOTAL_STORAGE - totalUsed),
    });
  } catch (error: any) {
    console.error('Error fetching storage stats:', error);

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
