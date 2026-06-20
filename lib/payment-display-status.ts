export type PaymentDisplayStatus =
  | "active"
  | "refund"
  | "deposit_fee"
  | "restocking_fee";

export type PaymentStatusFilter = "active" | "refund" | "deposit_fee" | "all";

export function getPaymentDisplayStatus(payment: {
  isAbandoned?: boolean;
  refundProofUrl?: string | null;
  source?: string | null;
}): PaymentDisplayStatus {
  if (payment.source === "deposit_fee") return "deposit_fee";
  if (payment.source === "restocking_fee") return "restocking_fee";
  if (payment.isAbandoned && payment.refundProofUrl) return "refund";
  return "active";
}

export function getPaymentDisplayStatusLabel(
  status: PaymentDisplayStatus,
): string {
  switch (status) {
    case "refund":
      return "Refund";
    case "deposit_fee":
      return "Deposit Fee";
    case "restocking_fee":
      return "Restocking Fee";
    default:
      return "Active";
  }
}

/** Prisma where clause for payments list/export status filter */
export function buildPaymentStatusWhere(
  status: string,
): Record<string, unknown> {
  if (status === "refund") {
    return {
      isAbandoned: true,
      refundProofUrl: { not: null },
    };
  }
  if (status === "deposit_fee") {
    return {
      isAbandoned: false,
      source: { in: ["deposit_fee", "restocking_fee"] },
    };
  }
  if (status === "all") {
    return {};
  }
  return {
    isAbandoned: false,
    OR: [
      { source: null },
      {
        source: {
          notIn: ["deposit_fee", "restocking_fee"],
        },
      },
    ],
  };
}
