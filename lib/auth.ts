import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import prisma from './prisma';
import { hasPermission, type PermissionString, type SettingsPermission } from './permissions';

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

export async function requirePermission(permission: PermissionString) {
  const user = await requireAuth();
  if (!hasPermission(user, permission)) throw new Error('Forbidden');
  return user;
}

export async function requireSettingPermission(setting: SettingsPermission) {
  return requirePermission(`settings.${setting}` as PermissionString);
}

export async function requireChequeVaultUpload() {
  const user = await requireAuth();
  if (isSuperAdmin(user)) {
    throw new Error('Super admin cannot upload cheques');
  }
  if (!hasPermission(user, 'chequeVault.upload')) {
    throw new Error('Forbidden');
  }
  return user;
}

export async function requireChequeVaultApprove() {
  const user = await requireAuth();
  if (!hasPermission(user, 'chequeVault.approve')) {
    throw new Error('Forbidden');
  }
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

export { hasPermission } from './permissions';
