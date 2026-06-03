export type ChequeVaultStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "NEEDS_CORRECTION";

const UPLOADER_EDITABLE_STATUSES: ChequeVaultStatus[] = [
  "PENDING",
  "NEEDS_CORRECTION",
];

export function isChequeRequestReadOnly(cheque: { status: string }): boolean {
  return cheque.status === "APPROVED" || cheque.status === "REJECTED";
}

export function canEditChequeRequest(
  cheque: { status: string; uploadedById: number },
  userId: number | null | undefined,
  options?: { isSuperAdmin?: boolean },
): boolean {
  if (options?.isSuperAdmin) return false;
  if (userId == null || cheque.uploadedById !== userId) return false;
  return UPLOADER_EDITABLE_STATUSES.includes(
    cheque.status as ChequeVaultStatus,
  );
}

export function canLinkInvoicesOnCheque(
  cheque: { status: string; uploadedById: number },
  userId: number | null | undefined,
  isSuperAdmin: boolean,
): boolean {
  if (isChequeRequestReadOnly(cheque)) return false;
  if (!UPLOADER_EDITABLE_STATUSES.includes(cheque.status as ChequeVaultStatus)) {
    return false;
  }
  if (isSuperAdmin) return true;
  return userId != null && cheque.uploadedById === userId;
}

export function canDeleteChequeRequest(
  cheque: { status: string; uploadedById: number },
  userId: number | null | undefined,
): boolean {
  return (
    cheque.status === "PENDING" &&
    userId != null &&
    cheque.uploadedById === userId
  );
}
