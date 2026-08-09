/**
 * Extract our system invoice numbers from a QuickBooks invoice memo.
 * Supports INV-YYYY-NNNN (and optional longer numeric suffix).
 */
export function extractInvoiceNumbersFromMemo(
  memo: string | null | undefined,
): string[] {
  if (!memo || typeof memo !== "string") return [];

  const matches = memo.toUpperCase().match(/INV-\d{4}-\d{4,}/g);
  if (!matches?.length) return [];

  return Array.from(new Set(matches));
}

export function invoiceMatchesMemoSuggestion(
  invoiceNumber: string,
  suggestedNumbers: string[],
): boolean {
  if (!invoiceNumber || suggestedNumbers.length === 0) return false;
  const normalized = invoiceNumber.trim().toUpperCase();
  return suggestedNumbers.some(
    (suggested) =>
      normalized === suggested ||
      normalized.includes(suggested) ||
      suggested.includes(normalized),
  );
}
