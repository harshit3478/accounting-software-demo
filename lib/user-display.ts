export type UserDisplayFields = {
  name?: string | null;
  email?: string | null;
};

/** Prefer display name; fall back to email for audit/history labels. */
export function formatUserDisplayName(
  user?: UserDisplayFields | null,
  fallback = "Unknown",
): string {
  const name = user?.name?.trim();
  if (name) return name;
  const email = user?.email?.trim();
  if (email) return email;
  return fallback;
}

export function serializeEditedByUser(
  user?: { id: number; name: string; email: string } | null,
) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    displayName: formatUserDisplayName(user),
  };
}

export function serializeInvoiceEditHistoryEntry(entry: {
  id: number;
  reason: string;
  changes?: unknown;
  createdAt: Date | string;
  editedBy?: { id: number; name: string; email: string } | null;
}) {
  return {
    id: entry.id,
    reason: entry.reason,
    changes: entry.changes || null,
    createdAt:
      entry.createdAt instanceof Date
        ? entry.createdAt.toISOString()
        : entry.createdAt,
    editedBy: serializeEditedByUser(entry.editedBy ?? null),
  };
}
