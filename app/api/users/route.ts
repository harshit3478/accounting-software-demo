import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import prisma from '../../../lib/prisma';
import { requireAuth, requireAdmin } from '../../../lib/auth';
import cache, { CACHE_KEYS, CACHE_TTL } from '../../../lib/cache';
import { invalidateUsers } from '../../../lib/cache-helpers';

export async function GET() {
  try {
    await requireAdmin();
    
    // Check cache first
    const cacheKey = CACHE_KEYS.ALL_USERS;
    const cached = cache.get(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }

    const users = await prisma.user.findMany({
      select: { id: true, email: true, name: true, role: true, privileges: true, createdAt: true },
    });

    // Cache for 5 minutes
    cache.set(cacheKey, users, CACHE_TTL.LONG);

    return NextResponse.json(users);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await requireAdmin();
    const { email, password, name, role, privileges } = await request.json();

    // Only superadmin can create admins
    if (role === 'admin' && currentUser.email !== process.env.SUPERADMIN_EMAIL) {
      return NextResponse.json({ error: 'Only superadmin can create admins' }, { status: 403 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const defaultPrivileges = role === 'admin' ? {
      documents: { upload: true, delete: true, rename: true }
    } : {
      documents: { upload: false, delete: false, rename: false }
    };

    const user = await prisma.user.create({
      data: { 
        email, 
        passwordHash: hashedPassword, 
        name, 
        role, 
        privileges: privileges || defaultPrivileges 
      },
    });

    // Invalidate user list cache
    invalidateUsers();

    return NextResponse.json(user);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const currentUser = await requireAdmin();
    const { id, email, name, role, privileges, password } = await request.json();

    // Only superadmin can edit admins or change roles to admin
    if ((role === 'admin' || currentUser.email === process.env.SUPERADMIN_EMAIL) && currentUser.email !== process.env.SUPERADMIN_EMAIL) {
      return NextResponse.json({ error: 'Only superadmin can edit admins' }, { status: 403 });
    }

    const updateData: any = { email, name, role };
    if (privileges) updateData.privileges = privileges;
    
    // Hash and update password if provided
    if (password && password.trim()) {
      updateData.passwordHash = await bcrypt.hash(password, 10);
    }

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
    });

    // Invalidate user list cache
    invalidateUsers();

    return NextResponse.json(user);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const currentUser = await requireAdmin();
    const { id } = await request.json();

    // Prevent deleting superadmin
    if (id === parseInt(process.env.SUPERADMIN_ID || '1')) {
      return NextResponse.json({ error: 'Cannot delete superadmin' }, { status: 403 });
    }

    await prisma.user.delete({ where: { id } });
    
    // Invalidate user list cache
    invalidateUsers();

    return NextResponse.json({ message: 'User deleted' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}