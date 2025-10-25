import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

export async function GET(request: NextRequest) {
  const token = request.cookies.get('token')?.value;

  if (!token) {
    return NextResponse.json({ authenticated: false, message: 'No token found' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    const privileges = decoded.privileges as any;

    // Calculate document permissions
    const canUploadDocuments = decoded.role === 'admin' || privileges?.documents?.upload === true;
    const canRenameDocuments = decoded.role === 'admin' || privileges?.documents?.rename === true;
    const canDeleteDocuments = decoded.role === 'admin' || privileges?.documents?.delete === true;

    return NextResponse.json({ 
      authenticated: true, 
      user: { 
        id: decoded.userId, 
        email: decoded.email, 
        role: decoded.role, 
        name: decoded.name,
        canUploadDocuments,
        canRenameDocuments,
        canDeleteDocuments
      }
    });
  } catch (error: any) {
    return NextResponse.json({ 
      authenticated: false, 
      error: error.message 
    }, { status: 401 });
  }
}