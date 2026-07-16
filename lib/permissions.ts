export const DOCUMENT_PERMISSIONS = ["upload", "delete", "rename"] as const;
export const CHEQUE_VAULT_PERMISSIONS = ["upload", "approve"] as const;

export const SETTINGS_PERMISSIONS = [
  "payment-methods",
  "users",
  "regularizations",
  "customers",
  "units",
  "live-types",
  "terms",
  "shipping-fee-rules",
  "insurance-rules",
  "due-date-reasons",
  "layaway",
  "late-fee",
  "early-payment-discount",
  "due-reminders",
  "deposit-fees",
  "restocking-fee",
  "recalculation-fee",
  "migrated-invoice-edit",
  "quickbooks",
] as const;

export type DocumentPermission = (typeof DOCUMENT_PERMISSIONS)[number];
export type ChequeVaultPermission = (typeof CHEQUE_VAULT_PERMISSIONS)[number];
export type SettingsPermission = (typeof SETTINGS_PERMISSIONS)[number];

export type UserPrivileges = {
  documents?: Partial<Record<DocumentPermission, boolean>>;
  settings?: Partial<Record<SettingsPermission, boolean>>;
  chequeVault?: Partial<Record<ChequeVaultPermission, boolean>>;
};

export type PermissionString =
  | `documents.${DocumentPermission}`
  | `settings.${SettingsPermission}`
  | `chequeVault.${ChequeVaultPermission}`;

type PrivilegeUser = {
  id?: number;
  email?: string;
  role?: string;
  privileges?: unknown;
};

function isSuperAdminUser(user: PrivilegeUser): boolean {
  return (
    user.email === process.env.SUPERADMIN_EMAIL ||
    user.id === parseInt(process.env.SUPERADMIN_ID || "1")
  );
}

function getPrivileges(user: PrivilegeUser): UserPrivileges {
  return (user.privileges as UserPrivileges) || {};
}

export function defaultPrivilegesForRole(role: string): UserPrivileges {
  const settingsDefaults = Object.fromEntries(
    SETTINGS_PERMISSIONS.map((key) => [key, true]),
  ) as Record<SettingsPermission, boolean>;

  if (role !== "admin") {
    settingsDefaults["migrated-invoice-edit"] = false;
  }

  if (role === "admin") {
    return {
      documents: { upload: true, delete: true, rename: true },
      settings: settingsDefaults,
      chequeVault: { upload: false, approve: false },
    };
  }

  return {
    documents: { upload: true, delete: true, rename: true },
    settings: settingsDefaults,
    chequeVault: { upload: false, approve: false },
  };
}

export function mergePrivileges(
  role: string,
  stored?: UserPrivileges | null,
): UserPrivileges {
  const defaults = defaultPrivilegesForRole(role);
  if (!stored) return defaults;

  const merged: UserPrivileges = {
    documents: { ...defaults.documents, ...stored.documents },
    settings: { ...defaults.settings, ...stored.settings },
    chequeVault:
      role === "admin"
        ? { ...defaults.chequeVault, ...stored.chequeVault }
        : { upload: false, approve: false },
  };

  return merged;
}

export function sanitizePrivilegesForRole(
  role: string,
  privileges?: UserPrivileges | null,
): UserPrivileges {
  return mergePrivileges(role, privileges);
}

export function hasPermission(
  user: PrivilegeUser,
  permission: PermissionString,
): boolean {
  if (isSuperAdminUser(user)) return true;

  const [category, action] = permission.split(".") as [string, string];
  const privileges = mergePrivileges(user.role || "", getPrivileges(user));

  if (category === "documents") {
    if (user.role === "admin") return true;
    return privileges.documents?.[action as DocumentPermission] === true;
  }

  if (category === "settings") {
    if (user.role === "admin") {
      return privileges.settings?.[action as SettingsPermission] !== false;
    }
    return privileges.settings?.[action as SettingsPermission] === true;
  }

  if (category === "chequeVault") {
    if (user.role !== "admin") return false;
    return privileges.chequeVault?.[action as ChequeVaultPermission] === true;
  }

  return false;
}

export function hasAnySettingsPermission(user: PrivilegeUser): boolean {
  if (isSuperAdminUser(user)) return true;
  if (user.role === "admin") return true;
  return SETTINGS_PERMISSIONS.some((key) =>
    hasPermission(user, `settings.${key}`),
  );
}

export function canAccessSettingsArea(user: PrivilegeUser): boolean {
  return (
    isSuperAdminUser(user) ||
    user.role === "admin" ||
    hasAnySettingsPermission(user)
  );
}

export function buildPermissionsPayload(user: PrivilegeUser) {
  const privileges = mergePrivileges(user.role || "", getPrivileges(user));

  const settings: Record<SettingsPermission, boolean> = {} as Record<
    SettingsPermission,
    boolean
  >;
  for (const key of SETTINGS_PERMISSIONS) {
    settings[key] = hasPermission(user, `settings.${key}`);
  }

  const chequeVault: Record<ChequeVaultPermission, boolean> = {
    upload: hasPermission(user, "chequeVault.upload"),
    approve: hasPermission(user, "chequeVault.approve"),
  };

  return {
    privileges,
    permissions: {
      documents: {
        upload: hasPermission(user, "documents.upload"),
        delete: hasPermission(user, "documents.delete"),
        rename: hasPermission(user, "documents.rename"),
      },
      settings,
      chequeVault,
    },
  };
}

export const SETTINGS_PERMISSION_LABELS: Record<SettingsPermission, string> = {
  "payment-methods": "Payment Methods",
  users: "User Management",
  regularizations: "Regularizations",
  customers: "Clients",
  units: "Units",
  "live-types": "Live Types",
  terms: "Terms & Conditions",
  "shipping-fee-rules": "Shipping Fee Rules",
  "insurance-rules": "Insurance Rules",
  "due-date-reasons": "Due Date Reasons",
  layaway: "Layaway",
  "late-fee": "Late Fee",
  "early-payment-discount": "Early Payment Discount",
  "due-reminders": "Due Reminder Emails",
  "deposit-fees": "Deposit Fees",
  "restocking-fee": "Restocking Fee",
  "recalculation-fee": "Recalculation Fee",
  "migrated-invoice-edit": "Migrated Invoice Edit",
  quickbooks: "QuickBooks",
};

export const CHEQUE_VAULT_PERMISSION_LABELS: Record<
  ChequeVaultPermission,
  string
> = {
  upload: "Upload Cheques Without Memo / With Memo",
  approve: "Approve Cheque Requests",
};
