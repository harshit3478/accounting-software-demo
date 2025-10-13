import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

export async function GET(request: NextRequest) {
  const token = request.cookies.get('token')?.value;

  if (!token) {
    return NextResponse.json({ authenticated: false, message: 'No token found' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    return NextResponse.json({ 
      authenticated: true, 
      user: { id: decoded.userId, email: decoded.email, role: decoded.role }
    });
  } catch (error: any) {
    return NextResponse.json({ 
      authenticated: false, 
      error: error.message 
    }, { status: 401 });
  }
}