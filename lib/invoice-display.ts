import { formatBusinessDate } from "./business-date";

export interface InvoiceDisplayLike {
  isLayaway?: boolean;
  layawayFee?: number | null;
  lateFee?: number | null;
  subtotal?: number | null;
  tax?: number | null;
  discount?: number | null;
  earlyPaymentDiscount?: number | null;
  unitDiscountAmount?: number | null;
  unitDiscountOffer?: unknown;
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

export function getVisibleLateFee(invoice: {
  lateFee?: number | null;
  payments?: Array<{ source?: string; amount?: number | string | null }> | null;
}): number {
  const storedLateFee = Number(invoice.lateFee ?? 0);
  if (storedLateFee > 0) {
    return Number(storedLateFee.toFixed(2));
  }

  const legacyTotal = (invoice.payments || [])
    .filter((payment) => payment.source === "late_fee")
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);

  return legacyTotal > 0 ? Number(legacyTotal.toFixed(2)) : 0;
}

export function getVisibleProcessingFee(invoice: {
  processingFee?: number | null;
  payments?: Array<{ source?: string; amount?: number | string | null }> | null;
}): number {
  const storedProcessingFee = Number(invoice.processingFee ?? 0);
  if (storedProcessingFee > 0) {
    return Number(storedProcessingFee.toFixed(2));
  }

  const legacyTotal = (invoice.payments || [])
    .filter((payment) => payment.source === "processing_fee")
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);

  return legacyTotal > 0 ? Number(legacyTotal.toFixed(2)) : 0;
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
  changes?: InvoiceEditHistoryChanges | null;
}

export type InvoiceEditHistoryChanges = {
  recalculationFee?: { amount?: number } | null;
  removedItemDepositFee?: {
    action?: "apply" | "skip";
    amount?: number;
    availableAmount?: number;
    reason?: string;
  } | null;
};

/** Minimal edit-history shape for amount calculations (changes only). */
export type InvoiceEditHistoryChangesLike = {
  changes?: unknown;
};

function readEditHistoryChanges(
  changes: unknown,
): InvoiceEditHistoryChanges | null {
  if (!changes || typeof changes !== "object" || Array.isArray(changes)) {
    return null;
  }
  return changes as InvoiceEditHistoryChanges;
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
      const changes = readEditHistoryChanges(entry.changes);
      const explicitAmount = Number(
        changes?.recalculationFee?.amount || 0,
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

export function getCurrentItemDepositFeeTotal(
  items?: Array<{ depositFee?: number | null }> | null,
): number {
  return Number(
    (items || [])
      .reduce((sum, item) => sum + Number(item.depositFee || 0), 0)
      .toFixed(2),
  );
}

export function getAppliedRemovedItemDepositFeeTotal(
  editHistory?: InvoiceEditHistoryChangesLike[] | null,
): number {
  if (!Array.isArray(editHistory)) return 0;

  return Number(
    editHistory
      .reduce((sum, entry) => {
        const removedFee =
          readEditHistoryChanges(entry.changes)?.removedItemDepositFee;
        if (removedFee?.action === "apply") {
          return sum + Number(removedFee.amount || 0);
        }
        return sum;
      }, 0)
      .toFixed(2),
  );
}

export function getRecalculationFeeTotal(
  editHistory?: InvoiceEditHistoryChangesLike[] | null,
): number {
  if (!Array.isArray(editHistory)) return 0;

  return Number(
    editHistory
      .reduce((sum, entry) => {
        const amount = Number(
          readEditHistoryChanges(entry.changes)?.recalculationFee?.amount || 0,
        );
        return amount > 0 ? sum + amount : sum;
      }, 0)
      .toFixed(2),
  );
}

export function resolveAppliedRemovedItemDepositFeeAmount(options: {
  isMigratedInvoiceEdit: boolean;
  removedItemDepositFeeAmount: number;
  removedItemDepositFeeAction: "apply" | "skip" | "none";
  existingEditHistory?: InvoiceEditHistoryChangesLike[] | null;
}): number {
  if (options.isMigratedInvoiceEdit) {
    return 0;
  }

  const historicalApplied = getAppliedRemovedItemDepositFeeTotal(
    options.existingEditHistory,
  );
  const newlyApplied =
    options.removedItemDepositFeeAmount > 0 &&
    options.removedItemDepositFeeAction === "apply"
      ? options.removedItemDepositFeeAmount
      : 0;

  return Number((historicalApplied + newlyApplied).toFixed(2));
}

export function computeInvoiceAmountFromComponents(invoice: {
  subtotal?: number | null;
  tax?: number | null;
  discount?: number | null;
  shippingFee?: number | null;
  insuranceAmount?: number | null;
  layawayFee?: number | null;
  editHistory?: InvoiceEditHistoryChangesLike[] | null;
}): number {
  const appliedRemovedDepositFee = getAppliedRemovedItemDepositFeeTotal(
    invoice.editHistory,
  );
  const recalculationFee = getRecalculationFeeTotal(invoice.editHistory);

  return Number(
    (
      Number(invoice.subtotal || 0) +
      Number(invoice.tax || 0) -
      Number(invoice.discount || 0) +
      Number(invoice.shippingFee || 0) +
      Number(invoice.insuranceAmount || 0) +
      Number(invoice.layawayFee || 0) +
      appliedRemovedDepositFee +
      recalculationFee
    ).toFixed(2),
  );
}

export function isAbandonedInvoice(invoice: { status?: string }): boolean {
  return invoice.status === "abandoned";
}

export function isCancelledCashInvoice(invoice: {
  status?: string;
  isLayaway?: boolean;
}): boolean {
  return invoice.status === "abandoned" && !invoice.isLayaway;
}

export function isAbandonedLayawayInvoice(invoice: {
  status?: string;
  isLayaway?: boolean;
}): boolean {
  return invoice.status === "abandoned" && !!invoice.isLayaway;
}

export function getInvoiceStatusLabel(invoice: {
  status?: string;
  isLayaway?: boolean;
}): string {
  const status = invoice.status || "";
  if (isCancelledCashInvoice(invoice)) return "Canceled";
  if (status === "abandoned") return "Abandoned";
  if (!status) return "";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function getInvoiceAbandonActionLabel(invoice: {
  isLayaway?: boolean;
}): string {
  return invoice.isLayaway ? "Mark Abandoned" : "Cancel Invoice";
}

export function getInvoiceAbandonModalTitle(
  invoiceNumber: string,
  isLayaway?: boolean,
): string {
  return isLayaway
    ? `Mark Invoice ${invoiceNumber} as Abandoned`
    : `Cancel Invoice ${invoiceNumber}`;
}

export function getInvoiceAbandonConfirmLabel(isLayaway?: boolean): string {
  return isLayaway ? "Mark Abandoned" : "Cancel Invoice";
}

export function getInvoiceAbandonStatusNoun(isLayaway?: boolean): string {
  return isLayaway ? "Abandoned" : "Canceled";
}

export function getInvoiceAbandonWithoutFeeLabel(isLayaway?: boolean): string {
  return isLayaway ? "Abandon without fee" : "Cancel without fee";
}

export function getInvoiceAbandonMarkedPhrase(isLayaway?: boolean): string {
  return isLayaway ? "marked abandoned" : "marked canceled";
}

export function getInvoiceAbandonBeforePhrase(isLayaway?: boolean): string {
  return isLayaway ? "marking it abandoned" : "canceling it";
}

export function getInvoiceAbandonInvoiceReference(isLayaway?: boolean): string {
  return isLayaway ? "abandoned invoice" : "canceled invoice";
}

export function getInvoiceAbandonReasonPlaceholder(isLayaway?: boolean): string {
  return isLayaway
    ? "Why are you abandoning this invoice?"
    : "Why are you canceling this invoice?";
}

export function getInvoicePaidAmountForDisplay(invoice: {
  paidAmount?: number | null;
  processingFee?: number | null;
  payments?: Array<{ source?: string; amount?: number | string | null }> | null;
}): number {
  return Number(Math.max(Number(invoice.paidAmount || 0), 0).toFixed(2));
}

export function getInvoiceAmountDue(invoice: {
  status?: string;
  amount?: number | null;
  paidAmount?: number | null;
  lateFee?: number | null;
  payments?: Array<{ source?: string; amount?: number | string | null }> | null;
  subtotal?: number | null;
  tax?: number | null;
  discount?: number | null;
  earlyPaymentDiscount?: number | null;
  unitDiscountAmount?: number | null;
  shippingFee?: number | null;
  insuranceAmount?: number | null;
  layawayFee?: number | null;
  processingFee?: number | null;
  isLayaway?: boolean;
}): number {
  if (isAbandonedInvoice(invoice)) {
    return 0;
  }
  return Math.max(
    getInvoiceTotalForDisplay(invoice) - getInvoicePaidAmountForDisplay(invoice),
    0,
  );
}

/** Sum of standard invoice line items, including late fees and processing fees. */
export function computeInvoiceLineItemTotal(
  invoice: InvoiceDisplayLike & {
    lateFee?: number | null;
    processingFee?: number | null;
    payments?: Array<{ source?: string; amount?: number | string | null }> | null;
  },
): number {
  const total =
    Number(invoice.subtotal || 0) +
    Number(invoice.tax || 0) -
    Number(invoice.discount || 0) -
    Number(invoice.earlyPaymentDiscount || 0) -
    Number(invoice.unitDiscountAmount || 0) +
    Number(invoice.shippingFee || 0) +
    Number(invoice.insuranceAmount || 0) +
    getVisibleLayawayFee(invoice) +
    getVisibleLateFee(invoice) +
    getVisibleProcessingFee(invoice);

  return Number(Math.max(total, 0).toFixed(2));
}

export function getInvoiceTotalForDisplay(
  invoice: {
    status?: string;
    amount?: number | null;
    lateFee?: number | null;
    payments?: Array<{ source?: string; amount?: number | string | null }> | null;
    subtotal?: number | null;
    tax?: number | null;
    discount?: number | null;
    earlyPaymentDiscount?: number | null;
    unitDiscountAmount?: number | null;
    shippingFee?: number | null;
    insuranceAmount?: number | null;
    layawayFee?: number | null;
    processingFee?: number | null;
    isLayaway?: boolean;
  },
): number {
  if (isAbandonedInvoice(invoice)) {
    return 0;
  }

  const storedAmount = Number(invoice.amount || 0);
  const lineItemTotal = computeInvoiceLineItemTotal(invoice);

  // Late/processing fees are part of the invoice total. If amount was
  // recalculated without them (e.g. during an invoice edit), include them.
  if (lineItemTotal > storedAmount + 0.009) {
    return lineItemTotal;
  }

  return storedAmount;
}

function getPaymentSourceTotal(
  payments: Array<{ source?: string; amount?: number }> | null | undefined,
  source: string,
): number {
  return (payments || []).reduce(
    (sum, payment) =>
      payment.source === source ? sum + Number(payment.amount || 0) : sum,
    0,
  );
}

export function getAbandonedRetainedFeeDisplay(invoice: {
  status?: string;
  isLayaway?: boolean;
  payments?: Array<{ source?: string; amount?: number }> | null;
  editHistory?: InvoiceEditHistoryLike[] | null;
}): { label: string; amount: number } | null {
  if (!isAbandonedInvoice(invoice)) {
    return null;
  }

  const restockingFromPayments = getPaymentSourceTotal(
    invoice.payments,
    "restocking_fee",
  );
  const depositFromPayments = getPaymentSourceTotal(
    invoice.payments,
    "deposit_fee",
  );
  const retainedFromPayments = getPaymentSourceTotal(
    invoice.payments,
    "retained_fee",
  );

  const abandonEntry = (invoice.editHistory || []).find(
    (entry) =>
      (entry.changes as { status?: { to?: string } })?.status?.to ===
      "abandoned",
  );
  const changes = abandonEntry?.changes as
    | {
        feeType?: { to?: string | null };
        feeAmount?: { to?: number | null };
      }
    | undefined;
  const feeType = changes?.feeType?.to;
  const feeAmountFromHistory = Number(changes?.feeAmount?.to || 0);

  if (invoice.isLayaway) {
    const combinedFromPayments = restockingFromPayments + depositFromPayments;
    if (combinedFromPayments > 0) {
      if (restockingFromPayments > 0 && depositFromPayments > 0) {
        return {
          label: "Retained Fees:",
          amount: Number(combinedFromPayments.toFixed(2)),
        };
      }

      return restockingFromPayments > 0
        ? {
            label: "Restocking Fee:",
            amount: Number(restockingFromPayments.toFixed(2)),
          }
        : {
            label: "Deposit Fee:",
            amount: Number(depositFromPayments.toFixed(2)),
          };
    }

    const amount =
      feeType === "both"
        ? feeAmountFromHistory
        : feeType === "restocking"
          ? feeAmountFromHistory
          : feeType === "deposit"
            ? feeAmountFromHistory
            : 0;
    if (amount <= 0) return null;

    return {
      label:
        feeType === "both"
          ? "Retained Fees:"
          : feeType === "restocking"
            ? "Restocking Fee:"
            : "Deposit Fee:",
      amount: Number(amount.toFixed(2)),
    };
  }

  const amount =
    retainedFromPayments > 0
      ? retainedFromPayments
      : depositFromPayments > 0
        ? depositFromPayments
        : feeType === "other"
          ? feeAmountFromHistory
          : feeType === "deposit"
            ? feeAmountFromHistory
            : 0;
  if (amount <= 0) return null;

  return {
    label:
      retainedFromPayments > 0 || feeType === "other"
        ? "Non-Refundable Amount:"
        : "Deposit Fee:",
    amount: Number(amount.toFixed(2)),
  };
}

export function formatInvoiceSummaryRowValue(value: number): string {
  const amount = Math.abs(Number(value || 0));
  const formatted = amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return value < 0 ? `-$${formatted}` : `$${formatted}`;
}

export function buildInvoicePdfSummaryRows(
  invoice: InvoiceDisplayLike & {
    status?: string;
    processingFee?: number | null;
    payments?: Array<{ source?: string; amount?: number }> | null;
    editHistory?: InvoiceEditHistoryLike[] | null;
    items?: Array<{ depositFee?: number | null }> | null;
  },
  options?: { includeSubtotal?: boolean },
): InvoicePdfSummaryRow[] {
  if (isAbandonedInvoice(invoice)) {
    const restockingFee = getPaymentSourceTotal(
      invoice.payments,
      "restocking_fee",
    );
    const depositFee = getPaymentSourceTotal(invoice.payments, "deposit_fee");
    const retainedFee = getPaymentSourceTotal(invoice.payments, "retained_fee");
    const rows: Array<{ label: string; value: number }> = [];

    if (restockingFee > 0) {
      rows.push({
        label: "Restocking Fee:",
        value: Number(restockingFee.toFixed(2)),
      });
    }
    if (depositFee > 0) {
      rows.push({
        label: "Deposit Fee:",
        value: Number(depositFee.toFixed(2)),
      });
    }
    if (retainedFee > 0) {
      rows.push({
        label: "Non-Refundable Amount:",
        value: Number(retainedFee.toFixed(2)),
      });
    }
    if (rows.length > 0) {
      return rows;
    }

    const retainedFeeDisplay = getAbandonedRetainedFeeDisplay(invoice);
    return retainedFeeDisplay
      ? [{ label: retainedFeeDisplay.label, value: retainedFeeDisplay.amount }]
      : [];
  }

  const layawayFee = getVisibleLayawayFee(invoice);

  const rows = [
    ...(options?.includeSubtotal
      ? [{ label: "Subtotal:", value: Number(invoice.subtotal || 0) }]
      : []),
    ...(Number(invoice.tax || 0) > 0
      ? [{ label: "Tax:", value: Number(invoice.tax || 0) }]
      : []),
    ...(Number(invoice.discount || 0) > 0
      ? [
          {
            label: "Discount:",
            value: -Number(invoice.discount || 0),
          },
        ]
      : []),
    ...(Number(invoice.earlyPaymentDiscount || 0) > 0
      ? [
          {
            label: "Early Payment Discount:",
            value: -Number(invoice.earlyPaymentDiscount || 0),
          },
        ]
      : []),
    ...(Number(invoice.unitDiscountAmount || 0) > 0
      ? [
          {
            label: "Unit Discount:",
            value: -Number(invoice.unitDiscountAmount || 0),
          },
        ]
      : []),
    { label: "Shipping Fee:", value: Number(invoice.shippingFee || 0) },
    { label: "Insurance:", value: Number(invoice.insuranceAmount || 0) },
    { label: "Layaway Fee:", value: layawayFee },
    {
      label: "Late Fee:",
      value: getVisibleLateFee(invoice),
    },
    {
      label: "Credit Card Processing Fee:",
      value: getVisibleProcessingFee(invoice),
    },
    {
      label: "Deposit Fee:",
      value: getPaymentSourceTotal(invoice.payments, "deposit_fee"),
    },
    {
      label: "Restocking Fee:",
      value: getPaymentSourceTotal(invoice.payments, "restocking_fee"),
    },
  ];

  return rows.filter((row) => row.value !== 0);
}

export function isRefundPayment(payment: {
  isRefund?: boolean;
  isAbandoned?: boolean;
  refundProofUrl?: string | null;
}): boolean {
  return (
    !!payment.isRefund || !!(payment.isAbandoned && payment.refundProofUrl)
  );
}

export type InvoicePdfPayment = {
  id?: number;
  amount?: number;
  source?: string;
  paymentDate?: string;
  date?: string;
  createdAt?: string;
  isRefund?: boolean;
  isAbandoned?: boolean;
  refundProofUrl?: string | null;
  method?: { name?: string } | string | null;
};

export function getInvoicePaymentsForPdf(invoice: {
  status?: string;
  payments?: InvoicePdfPayment[] | null;
  abandonmentRefunds?: InvoicePdfPayment[] | null;
}): InvoicePdfPayment[] {
  const payments = invoice.payments || [];
  if (!isAbandonedInvoice(invoice)) {
    return payments;
  }

  const feePayments = payments.filter(
    (payment) =>
      payment.source === "deposit_fee" ||
      payment.source === "restocking_fee" ||
      payment.source === "retained_fee",
  );

  const refunds =
    (invoice.abandonmentRefunds?.length
      ? invoice.abandonmentRefunds
      : payments.filter(isRefundPayment)) || [];

  const seenIds = new Set<number>();
  const merged = [...feePayments];
  for (const refund of refunds) {
    if (refund.id != null) {
      if (seenIds.has(refund.id)) continue;
      seenIds.add(refund.id);
    }
    merged.push(refund);
  }
  return merged;
}

export function getInvoicePdfPaymentLabel(payment: {
  source?: string;
  paymentDate?: string;
  date?: string;
  isRefund?: boolean;
  isAbandoned?: boolean;
  refundProofUrl?: string | null;
  method?: { name?: string } | string | null;
}): string {
  if (payment.source === "deposit_fee") {
    return "Deposit fee retained:";
  }
  if (payment.source === "retained_fee") {
    return "Non-refundable amount retained:";
  }
  if (payment.source === "restocking_fee") {
    return "Restocking fee retained:";
  }
  if (payment.source === "processing_fee") {
    const dateStr = formatBusinessDate(
      payment.paymentDate || payment.date || "",
      {
        month: "long",
        day: "numeric",
        year: "numeric",
      },
    );
    return dateStr
      ? `Credit card processing fee on ${dateStr}:`
      : "Credit card processing fee:";
  }
  if (isRefundPayment(payment)) {
    const dateStr = formatBusinessDate(
      payment.paymentDate || payment.date || "",
      {
        month: "long",
        day: "numeric",
        year: "numeric",
      },
    );
    return `Refund on ${dateStr}:`;
  }

  const dateStr = formatBusinessDate(payment.paymentDate || payment.date || "", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const methodName =
    typeof payment.method === "object"
      ? payment.method?.name || "payment"
      : String(payment.method || "payment");
  return `Payment on ${dateStr} using ${methodName.toLowerCase()}:`;
}

export type InvoicePdfSummaryRow = {
  label: string;
  value: number;
};

export function getItemDepositReferenceRow(
  items?: Array<{ depositFee?: number | null }> | null,
): InvoicePdfSummaryRow | null {
  const total = getCurrentItemDepositFeeTotal(items);
  if (total <= 0) {
    return null;
  }

  return {
    label: "Item deposit (not included in total):",
    value: total,
  };
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
            : "Removed item deposit fee (in total)",
      };
    })
    .filter(
      (entry): entry is RemovedItemDepositFeeDisplayEntry => entry !== null,
    );
}

export function getAppliedRemovedItemDepositFeeEntries(
  editHistory?: InvoiceEditHistoryLike[] | null,
): RemovedItemDepositFeeDisplayEntry[] {
  return getRemovedItemDepositFeeDisplayEntries(editHistory).filter(
    (entry) => entry.action === "apply" && entry.amount > 0,
  );
}
