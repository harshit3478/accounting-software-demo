export interface InvoiceDisplayLike {
  isLayaway?: boolean;
  layawayFee?: number | null;
  subtotal?: number | null;
  tax?: number | null;
  discount?: number | null;
  shippingFee?: number | null;
  insuranceAmount?: number | null;
  amount?: number | null;
  liveTypeId?: number | null;
  liveTypeSnapshot?: string | null;
  liveType?: {
    name?: string | null;
    country?: string | null;
  } | null;
}

export function resolveInvoiceDate(
  invoiceDate?: string | null,
  createdAt?: string | null,
): string {
  return invoiceDate || createdAt || "";
}

export function shouldShowLayawayFee(invoice: InvoiceDisplayLike): boolean {
  return Boolean(invoice.isLayaway && getVisibleLayawayFee(invoice) > 0);
}

export function getVisibleLayawayFee(invoice: InvoiceDisplayLike): number {
  const storedLayawayFee = Number(invoice.layawayFee || 0);
  if (storedLayawayFee > 0) {
    return Number(storedLayawayFee.toFixed(2));
  }

  if (!invoice.isLayaway) {
    return 0;
  }

  const amount = Number(invoice.amount || 0);
  const subtotal = Number(invoice.subtotal || 0);
  const tax = Number(invoice.tax || 0);
  const discount = Number(invoice.discount || 0);
  const shippingFee = Number(invoice.shippingFee || 0);
  const insuranceAmount = Number(invoice.insuranceAmount || 0);

  const calculated =
    amount - subtotal - tax + discount - shippingFee - insuranceAmount;
  return calculated > 0 ? Number(calculated.toFixed(2)) : 0;
}

export function resolveLiveTypeLabel(
  invoice: InvoiceDisplayLike,
): string | null {
  const liveTypeName = invoice.liveType?.name?.trim();
  const liveTypeCountry = invoice.liveType?.country?.trim();

  if (liveTypeName && liveTypeCountry) {
    return `${liveTypeName} (${liveTypeCountry})`;
  }

  if (liveTypeName) {
    return liveTypeName;
  }

  if (invoice.liveTypeSnapshot?.trim()) {
    return invoice.liveTypeSnapshot.trim();
  }

  return null;
}

export interface InvoiceEditHistoryLike {
  createdAt: string;
  reason: string;
  changes?: {
    recalculationFee?: { amount?: number } | null;
    removedItemDepositFee?: {
      action?: "apply" | "skip";
      amount?: number;
      availableAmount?: number;
      reason?: string;
    } | null;
  } | null;
}

export interface RecalculationFeeDisplayEntry {
  date: string;
  amount: number;
  label: string;
}

export function getRecalculationFeeDisplayEntries(
  editHistory?: InvoiceEditHistoryLike[] | null,
): RecalculationFeeDisplayEntry[] {
  if (!Array.isArray(editHistory) || editHistory.length === 0) {
    return [];
  }

  return editHistory
    .map((entry) => {
      const explicitAmount = Number(
        entry.changes?.recalculationFee?.amount || 0,
      );
      const amount = explicitAmount;

      if (amount <= 0) return null;

      const label = entry.reason?.trim()
        ? `Recalculation fee - ${entry.reason.trim()}`
        : "Recalculation fee";

      return {
        date: entry.createdAt,
        amount: Number(amount.toFixed(2)),
        label,
      };
    })
    .filter((entry): entry is RecalculationFeeDisplayEntry => entry !== null);
}

export interface RemovedItemDepositFeeDisplayEntry {
  date: string;
  amount: number;
  availableAmount: number;
  action: "apply" | "skip";
  reason: string;
  label: string;
}

export function getRemovedItemDepositFeeDisplayEntries(
  editHistory?: InvoiceEditHistoryLike[] | null,
): RemovedItemDepositFeeDisplayEntry[] {
  if (!Array.isArray(editHistory) || editHistory.length === 0) {
    return [];
  }

  return editHistory
    .map((entry) => {
      const removedFee = entry.changes?.removedItemDepositFee;
      const availableAmount = Number(removedFee?.availableAmount || 0);
      if (availableAmount <= 0) return null;

      const action = removedFee?.action === "skip" ? "skip" : "apply";
      const amount = action === "apply" ? Number(removedFee?.amount || 0) : 0;
      const reason =
        action === "skip"
          ? String(removedFee?.reason || entry.reason || "").trim()
          : String(entry.reason || "").trim();

      return {
        date: entry.createdAt,
        amount: Number(amount.toFixed(2)),
        availableAmount: Number(availableAmount.toFixed(2)),
        action,
        reason,
        label:
          action === "skip"
            ? "Removed item deposit fee skipped"
            : "Removed item deposit fee",
      };
    })
    .filter(
      (entry): entry is RemovedItemDepositFeeDisplayEntry => entry !== null,
    );
}
