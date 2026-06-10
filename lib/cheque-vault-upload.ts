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
