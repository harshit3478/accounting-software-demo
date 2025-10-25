import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import prisma from './prisma';

export async function getUserFromToken() {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;

  if (!token) return null;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    return user;
  } catch {
    return null;
  }
}

export async function requireAuth() {
  const user = await getUserFromToken();
  if (!user) throw new Error('Unauthorized');
  return user;
}

export async function requireAdmin() {
  const user = await requireAuth();
  if (user.role !== 'admin') throw new Error('Forbidden');
  return user;
}

export async function requirePermission(permission: string) {
  const user = await requireAuth();
  if (user.role === 'admin') return user; // Admins have all permissions

  const privileges = user.privileges as any;
  
  // Parse permission string (e.g., 'documents.delete' -> ['documents', 'delete'])
  const parts = permission.split('.');
  if (parts.length !== 2) throw new Error('Invalid permission format');
  
  const [category, action] = parts;
  
  // Check if user has this specific permission
  if (!privileges?.[category]?.[action]) throw new Error('Forbidden');
  
  return user;
}

export async function requireSuperAdmin() {
  const user = await requireAuth();
  
  // Check both email and ID for backwards compatibility
  const isSuperAdminUser = 
    user.email === process.env.SUPERADMIN_EMAIL || 
    user.id === parseInt(process.env.SUPERADMIN_ID || '1');
  
  if (!isSuperAdminUser) {
    throw new Error('Super admin access required');
  }
  
  return user;
}

export function isSuperAdmin(user: any): boolean {
  return (
    user.email === process.env.SUPERADMIN_EMAIL || 
    user.id === parseInt(process.env.SUPERADMIN_ID || '1')
  );
}