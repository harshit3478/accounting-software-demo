import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { requireAuth, requireAdmin } from '@/lib/auth';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    // Check if user is authenticated
    await requireAuth();

    // Get the default folder
    const folder = await prisma.systemFolder.findFirst({
      where: { isDefault: true },
    });

    if (!folder) {
      return NextResponse.json(
        { error: 'Default folder not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: folder.id,
      name: folder.name,
      isDefault: folder.isDefault,
    });
  } catch (error: any) {
    console.error('Error fetching folder:', error);

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

export async function PATCH(request: NextRequest) {
  try {
    // Check if user is admin
    await requireAdmin();

    const body = await request.json();
    const { newName } = body;

    if (!newName || typeof newName !== 'string' || newName.trim().length === 0) {
      return NextResponse.json(
        { error: 'Invalid folder name' },
        { status: 400 }
      );
    }

    if (newName.trim().length > 100) {
      return NextResponse.json(
        { error: 'Folder name too long (max 100 characters)' },
        { status: 400 }
      );
    }

    // Update the default folder name
    const folder = await prisma.systemFolder.updateMany({
      where: { isDefault: true },
      data: { name: newName.trim() },
    });

    if (folder.count === 0) {
      return NextResponse.json(
        { error: 'Default folder not found' },
        { status: 404 }
      );
    }

    // Fetch the updated folder
    const updatedFolder = await prisma.systemFolder.findFirst({
      where: { isDefault: true },
    });

    return NextResponse.json({
      success: true,
      message: 'Folder renamed successfully',
      folder: {
        id: updatedFolder!.id,
        name: updatedFolder!.name,
        isDefault: updatedFolder!.isDefault,
      },
    });
  } catch (error: any) {
    console.error('Error renaming folder:', error);

    if (error.message === 'Forbidden') {
      return NextResponse.json(
        { error: 'Only admins can rename the folder' },
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
