export type CreditTransactionLike = {
  id: number;
  amount: number | { toNumber?: () => number };
  type: string;
  reason?: string | null;
  paymentId?: number | null;
  invoiceId?: number | null;
  createdAt?: string | Date;
  payment?: {
    id?: number;
    isAbandoned?: boolean;
    paymentCode?: string | null;
  } | null;
};

export type EnrichedCreditTransaction = {
  id: number;
  amount: number;
  type: string;
  reason: string | null;
  paymentId: number | null;
  invoiceId: number | null;
  createdAt: string;
  paymentIsAbandoned: boolean;
  appliedAmount: number;
  availableAmount: number;
  isVoid: boolean;
  isAbandonReversal: boolean;
};

function toNumber(value: number | { toNumber?: () => number }): number {
  if (typeof value === "number") {
    return value;
  }
  return Number(value?.toNumber?.() ?? value ?? 0);
}

/** Annotate customer credit rows for UI (hide void/abandoned credits from actions). */
export function enrichCreditTransactions(
  transactions: CreditTransactionLike[],
): EnrichedCreditTransaction[] {
  const normalized = transactions.map((tx) => ({
    ...tx,
    amount: toNumber(tx.amount),
    createdAt:
      typeof tx.createdAt === "string"
        ? tx.createdAt
        : tx.createdAt?.toISOString?.() || "",
  }));

  const debitsByPaymentId = new Map<number, number>();
  for (const tx of normalized) {
    if (tx.type !== "debit" || !tx.paymentId) {
      continue;
    }
    debitsByPaymentId.set(
      tx.paymentId,
      (debitsByPaymentId.get(tx.paymentId) || 0) + tx.amount,
    );
  }

  return normalized.map((tx) => {
    const paymentIsAbandoned = Boolean(tx.payment?.isAbandoned);
    const isAbandonReversal =
      tx.type === "debit" &&
      (tx.reason || "").toLowerCase().includes("payment abandoned");

    const appliedAmount =
      tx.type === "credit" && tx.paymentId
        ? debitsByPaymentId.get(tx.paymentId) || 0
        : 0;

    const availableAmount =
      tx.type === "credit" && !paymentIsAbandoned
        ? Math.max(tx.amount - appliedAmount, 0)
        : 0;

    const isVoid =
      paymentIsAbandoned ||
      isAbandonReversal ||
      (tx.type === "credit" && availableAmount <= 0.009);

    return {
      id: tx.id,
      amount: tx.amount,
      type: tx.type,
      reason: tx.reason ?? null,
      paymentId: tx.paymentId ?? null,
      invoiceId: tx.invoiceId ?? null,
      createdAt: tx.createdAt,
      paymentIsAbandoned,
      appliedAmount,
      availableAmount,
      isVoid,
      isAbandonReversal,
    };
  });
}
