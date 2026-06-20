import prisma from "./prisma";
import { hasPermission } from "./permissions";

export interface MigratedInvoiceEditSettingSnapshot {
  isActive: boolean;
}

type MigratedInvoiceEditUser = {
  id?: number;
  email?: string;
  role?: string;
  privileges?: unknown;
};

export async function getMigratedInvoiceEditSettingSnapshot(): Promise<MigratedInvoiceEditSettingSnapshot> {
  const model = (prisma as any)?.migratedInvoiceEditSetting;
  if (!model) {
    return { isActive: false };
  }

  const row = await model.findFirst({ orderBy: { updatedAt: "desc" } });
  return { isActive: !!row?.isActive };
}

export function canUseMigratedInvoiceEdit(
  user: MigratedInvoiceEditUser,
  setting: MigratedInvoiceEditSettingSnapshot,
): boolean {
  return (
    setting.isActive && hasPermission(user, "settings.migrated-invoice-edit")
  );
}
