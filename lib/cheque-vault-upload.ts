import type { ChequeOcrResult } from "./cheque-ocr";

export const CHEQUE_VAULT_ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "application/pdf",
] as const;

export const CHEQUE_VAULT_MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

export function isAllowedChequeVaultMimeType(mimeType: string): boolean {
  return (CHEQUE_VAULT_ALLOWED_MIME_TYPES as readonly string[]).includes(
    mimeType,
  );
}

export function isChequeVaultPdfMimeType(mimeType: string): boolean {
  return mimeType === "application/pdf";
}

export function getChequeVaultFileExtension(mimeType: string): string {
  if (mimeType === "application/pdf") return "pdf";
  return mimeType.split("/")[1]?.replace("jpeg", "jpg") || "bin";
}

export function isChequeVaultPdfFile(fileNameOrUrl?: string | null): boolean {
  if (!fileNameOrUrl) return false;
  return fileNameOrUrl.toLowerCase().endsWith(".pdf");
}

export function emptyChequeOcrResult(): ChequeOcrResult {
  return {
    chequeNumber: null,
    payorName: null,
    amount: null,
    chequeDate: null,
    bankName: null,
    rawText: "",
    confidence: "low",
  };
}

export const CHEQUE_VAULT_ACCEPT_ATTRIBUTE =
  "image/jpeg,image/jpg,image/png,image/webp,application/pdf";

export const CHEQUE_VAULT_FILE_TYPE_HINT =
  "One file only — JPEG, PNG, WebP, or PDF (max 10MB)";

export type ChequeVaultDocumentType = "CHEQUE" | "MEMO";

export function getChequeVaultDocumentTypeLabel(
  documentType?: ChequeVaultDocumentType | string | null,
): string {
  return documentType === "MEMO" ? "Cheque With Memo" : "Cheque Without Memo";
}

export function getChequeVaultDocumentTypeLabelPlural(
  documentType?: ChequeVaultDocumentType | string | null,
): string {
  return documentType === "MEMO"
    ? "Cheques With Memo"
    : "Cheques Without Memo";
}

export function getChequeVaultDocumentTypeLabelLower(
  documentType?: ChequeVaultDocumentType | string | null,
): string {
  return documentType === "MEMO"
    ? "cheque with memo"
    : "cheque without memo";
}

export function getChequeVaultDocumentTypeFilterOptions(): Array<{
  value: ChequeVaultDocumentType;
  label: string;
}> {
  return [
    { value: "CHEQUE", label: "Cheques Without Memo" },
    { value: "MEMO", label: "Cheques With Memo" },
  ];
}

export function getChequeVaultStoragePrefix(
  documentType: ChequeVaultDocumentType,
): string {
  return documentType === "MEMO" ? "memos" : "cheques";
}

export function parseChequeVaultDocumentType(
  value: FormDataEntryValue | null,
): ChequeVaultDocumentType {
  const normalized = String(value ?? "")
    .trim()
    .toUpperCase();
  return normalized === "MEMO" ? "MEMO" : "CHEQUE";
}
