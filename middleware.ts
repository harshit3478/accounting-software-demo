import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Tell Next.js to use Node.js runtime for middleware
export const config = {
  matcher: ['/', '/admin/:path*', '/invoices/:path*', '/payments/:path*', '/statements/:path*', '/login', '/forgot-password', '/reset-password'],
  runtime: 'nodejs',
};

export function middleware(request: NextRequest) {
  const token = request.cookies.get('token')?.value;
  const path = request.nextUrl.pathname;

  // Allow access to login, forgot-password, and reset-password pages
  if (path === '/login' || path === '/forgot-password' || path.startsWith('/reset-password')) {
    // If already logged in, redirect to home
    if (token) {
      try {
        // Simple check - just verify token exists, detailed verification happens in API routes
        const parts = token.split('.');
        if (parts.length === 3) {
          return NextResponse.redirect(new URL('/', request.url));
        }
      } catch {
        // Invalid token, allow access to login pages
      }
    }
    return NextResponse.next();
  }

  // Protected routes
  if (path.startsWith('/admin') || path === '/' || path.startsWith('/invoices') || path.startsWith('/payments') || path.startsWith('/statements')) {
    if (!token) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    try {
      // Simple validation - just check it looks like a JWT
      const parts = token.split('.');
      if (parts.length !== 3) {
        throw new Error('Invalid token format');
      }
      
      // Decode payload without verification (just for role check)
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
      
      // Check admin access for admin routes
      if (path.startsWith('/admin') && payload.role !== 'admin') {
        return NextResponse.redirect(new URL('/', request.url));
      }
    } catch (error) {
      console.error('Token validation failed:', error);
      const response = NextResponse.redirect(new URL('/login', request.url));
      response.cookies.delete('token');
      return response;
    }
  }

  return NextResponse.next();
}