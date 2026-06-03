import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken, isSuperAdmin } from '@/lib/auth';
import { formatUserDisplayName } from '@/lib/user-display';

export async function GET(request: NextRequest) {
  const token = request.cookies.get('token')?.value;

  if (!token) {
    return NextResponse.json({ authenticated: false, message: 'No token found' });
  }

  try {
    const dbUser = await getUserFromToken();
    if (!dbUser) {
      return NextResponse.json(
        { authenticated: false, message: 'Invalid token' },
        { status: 401 },
      );
    }

    const privileges = dbUser.privileges as any;

    // Calculate document permissions
    const canUploadDocuments = dbUser.role === 'admin' || privileges?.documents?.upload === true;
    const canRenameDocuments = dbUser.role === 'admin' || privileges?.documents?.rename === true;
    const canDeleteDocuments = dbUser.role === 'admin' || privileges?.documents?.delete === true;

    const user = {
      id: dbUser.id,
      email: dbUser.email,
      role: dbUser.role,
      name: dbUser.name,
      avatarUrl: dbUser.avatarUrl,
      displayName: formatUserDisplayName(dbUser),
      canUploadDocuments,
      canRenameDocuments,
      canDeleteDocuments,
      isSuperAdmin: isSuperAdmin(dbUser),
    };

    return NextResponse.json({
      authenticated: true,
      user,
    });
  } catch (error: any) {
    return NextResponse.json({ 
      authenticated: false, 
      error: error.message 
    }, { status: 401 });
  }
}