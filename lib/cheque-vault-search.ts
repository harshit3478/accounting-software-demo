/** Prisma OR conditions for payor name / cheque number text search. */
export function buildChequeVaultTextSearchConditions(search: string) {
  const trimmed = search.trim();
  if (!trimmed) {
    return null;
  }

  return [
    { payorName: { contains: trimmed } },
    { chequeNumber: { contains: trimmed } },
  ];
}

/** Normalize search text for amount substring matching (e.g. "$1,500.00" -> "1500.00"). */
export function normalizeAmountSearchTerm(search: string): string | null {
  const trimmed = search.trim();
  if (!trimmed) {
    return null;
  }

  const normalized = trimmed.replace(/[$,\s]/g, "");
  if (!normalized || !/\d/.test(normalized)) {
    return null;
  }

  return normalized;
}
