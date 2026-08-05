export function formatPaymentCode(paymentId: number): string {
  return `PAY-${String(paymentId).padStart(6, "0")}`;
}

/** Parse a payment database id from search text (e.g. "92716", "PAY-092716"). */
export function parsePaymentIdFromSearch(search: string): number | null {
  const trimmed = search.trim();
  if (!trimmed) {
    return null;
  }

  const payCodeMatch = trimmed.match(/^pay[-\s]?(\d+)$/i);
  if (payCodeMatch) {
    const id = parseInt(payCodeMatch[1], 10);
    return Number.isFinite(id) && id > 0 ? id : null;
  }

  if (/^\d+$/.test(trimmed)) {
    const id = parseInt(trimmed, 10);
    return Number.isFinite(id) && id > 0 ? id : null;
  }

  return null;
}

/** Prisma OR conditions for the payments list/export search box. */
export function buildPaymentSearchConditions(search: string) {
  const trimmed = search.trim();
  if (!trimmed) {
    return null;
  }

  const conditions: Record<string, unknown>[] = [
    { notes: { contains: trimmed } },
    { paymentCode: { contains: trimmed } },
    {
      invoice: {
        OR: [
          { invoiceNumber: { contains: trimmed } },
          { clientName: { contains: trimmed } },
        ],
      },
    },
  ];

  const paymentId = parsePaymentIdFromSearch(trimmed);
  if (paymentId !== null) {
    conditions.push({ id: paymentId });
  }

  return conditions;
}

export async function stampPaymentCode(tx: any, paymentId: number) {
  const paymentCode = formatPaymentCode(paymentId);
  await tx.payment.update({
    where: { id: paymentId },
    data: { paymentCode },
  });
  return paymentCode;
}
