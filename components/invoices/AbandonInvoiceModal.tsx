"use client";

import { useEffect, useState } from "react";
import Modal from "./Modal";
import { calculateRestockingFeeAmount } from "../../lib/restocking-fee";
import {
  calculateDepositFeeForItem,
  type DepositFeeRuleLike,
} from "../../lib/deposit-fees";
import {
  getInvoiceAbandonBeforePhrase,
  getInvoiceAbandonConfirmLabel,
  getInvoiceAbandonInvoiceReference,
  getInvoiceAbandonMarkedPhrase,
  getInvoiceAbandonModalTitle,
  getInvoiceAbandonReasonPlaceholder,
  getInvoiceAbandonStatusNoun,
  getInvoiceAbandonWithoutFeeLabel,
} from "../../lib/invoice-display";

interface InvoiceOption {
  id: number;
  invoiceNumber: string;
  amount: number;
  paidAmount: number;
  dueDate: string;
  status: string;
}

interface PaymentMethodOption {
  id: number;
  name: string;
}

interface InvoiceLike {
  id: number;
  invoiceNumber: string;
  clientName: string;
  customerId?: number | null;
  amount: number;
  paidAmount: number;
  lateFee?: number | string | null;
  layawayFee?: number | string | null;
  isLayaway?: boolean;
  items?: Array<{
    name?: string | null;
    depositFee?: number | string | null;
    quantity?: number | string | null;
    price?: number | string | null;
    pricePerItem?: number | string | null;
    unit?: string | null;
  }>;
}

interface RefundProof {
  dataUrl: string;
  fileName: string;
  mimeType: string;
}

interface AbandonInvoiceModalProps {
  isOpen: boolean;
  invoice: InvoiceLike | null;
  isSubmitting?: boolean;
  onClose: () => void;
  onConfirm: (payload: {
    editReason: string;
    paymentAction: "credit" | "transfer" | "refund" | "none";
    feeAction:
      | "restocking"
      | "deposit"
      | "both"
      | "late"
      | "other"
      | "all"
      | "none";
    customFeeAmount?: number;
    lateFeeAmount?: number;
    nonRefundableReason?: string;
    targetInvoiceId?: number;
    feeMethodId?: number;
    refundProof?: RefundProof;
  }) => void;
}

export default function AbandonInvoiceModal({
  isOpen,
  invoice,
  isSubmitting = false,
  onClose,
  onConfirm,
}: AbandonInvoiceModalProps) {
  const [reason, setReason] = useState("");
  const [nonRefundableReason, setNonRefundableReason] = useState("");
  const [paymentAction, setPaymentAction] = useState<
    "credit" | "transfer" | "refund" | "none"
  >("credit");
  const [feeAction, setFeeAction] = useState<
    | "restocking"
    | "deposit"
    | "both"
    | "late"
    | "other"
    | "all"
    | "none"
  >("none");
  const [customFeeAmount, setCustomFeeAmount] = useState("");
  const [lateFeeAmount, setLateFeeAmount] = useState("");
  const [targetInvoiceId, setTargetInvoiceId] = useState<number | null>(null);
  const [customerInvoices, setCustomerInvoices] = useState<InvoiceOption[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodOption[]>(
    [],
  );
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [loadingPaymentMethods, setLoadingPaymentMethods] = useState(false);
  const [error, setError] = useState("");
  const [refundProof, setRefundProof] = useState<RefundProof | null>(null);
  const [feeMethodId, setFeeMethodId] = useState<number | null>(null);
  const [restockingFeeSetting, setRestockingFeeSetting] = useState<{
    amount: number;
    isPercentage: boolean;
    isActive: boolean;
  } | null>(null);
  const [depositFeeRules, setDepositFeeRules] = useState<DepositFeeRuleLike[]>(
    [],
  );
  const [loadingFeeSetting, setLoadingFeeSetting] = useState(false);

  const paidAmount = invoice?.paidAmount || 0;
  const hasPayments = paidAmount > 0;
  const isLayaway = !!invoice?.isLayaway;
  const parsedLateFee = Number.parseFloat(lateFeeAmount);
  const requestedLateFee =
    Number.isFinite(parsedLateFee) && parsedLateFee > 0 ? parsedLateFee : 0;
  const storedDepositFeeTotal = (invoice?.items || []).reduce((sum, item) => {
    const fee = Number(item.depositFee || 0);
    return sum + (Number.isFinite(fee) ? fee : 0);
  }, 0);
  const depositFeeTotal =
    depositFeeRules.length > 0
      ? Number(
          (invoice?.items || [])
            .reduce(
              (sum, item) =>
                sum + calculateDepositFeeForItem(item, depositFeeRules),
              0,
            )
            .toFixed(2),
        )
      : storedDepositFeeTotal;
  const restockingFeeAmount = calculateRestockingFeeAmount(
    invoice?.items || [],
    restockingFeeSetting || {
      amount: 0,
      isPercentage: false,
      isActive: false,
    },
    invoice?.layawayFee,
  );
  const effectiveRestockingFee = hasPayments
    ? Math.min(restockingFeeAmount, paidAmount)
    : restockingFeeAmount;
  const effectiveDepositFee = hasPayments
    ? Math.min(depositFeeTotal, paidAmount)
    : depositFeeTotal;
  const canApplyRestocking =
    isLayaway && !!restockingFeeSetting?.isActive && effectiveRestockingFee > 0;
  const canApplyDeposit = effectiveDepositFee > 0;
  const canApplyBoth = canApplyRestocking && canApplyDeposit;
  const canApplyOther = !isLayaway && hasPayments;
  const canApplyAllPayments = hasPayments;
  const showFeeHandling =
    isLayaway || hasPayments || canApplyDeposit;
  const parsedCustomFee = Number.parseFloat(customFeeAmount);
  const effectiveOtherFee =
    Number.isFinite(parsedCustomFee) && parsedCustomFee > 0
      ? hasPayments
        ? Math.min(parsedCustomFee, paidAmount)
        : parsedCustomFee
      : 0;
  const bothFeeAmounts = (() => {
    const late = hasPayments
      ? Math.min(requestedLateFee, paidAmount)
      : requestedLateFee;
    const afterLateFee = hasPayments
      ? Math.max(Number((paidAmount - late).toFixed(2)), 0)
      : restockingFeeAmount + depositFeeTotal;
    const restockingPart = hasPayments
      ? Math.min(restockingFeeAmount, afterLateFee)
      : restockingFeeAmount;
    const depositPart = hasPayments
      ? Math.min(
          depositFeeTotal,
          Math.max(Number((afterLateFee - restockingPart).toFixed(2)), 0),
        )
      : depositFeeTotal;

    return {
      restocking: restockingPart,
      deposit: depositPart,
      late,
      total: Number((restockingPart + depositPart + late).toFixed(2)),
    };
  })();
  const retainedLateFee =
    feeAction === "both"
      ? bothFeeAmounts.late
      : feeAction === "late"
        ? hasPayments
          ? Math.min(requestedLateFee, paidAmount)
          : requestedLateFee
        : 0;
  const selectedFeeAmount =
    feeAction === "restocking"
      ? effectiveRestockingFee
      : feeAction === "deposit"
        ? effectiveDepositFee
        : feeAction === "both"
          ? Number(
              (bothFeeAmounts.restocking + bothFeeAmounts.deposit).toFixed(2),
            )
          : feeAction === "late"
            ? 0
          : feeAction === "other"
            ? effectiveOtherFee
            : feeAction === "all"
              ? paidAmount
              : 0;
  const retainedTotal =
    feeAction === "all"
      ? paidAmount
      : feeAction === "both"
        ? bothFeeAmounts.total
        : Number((selectedFeeAmount + retainedLateFee).toFixed(2));
  const refundableBalance = hasPayments
    ? Math.max(paidAmount - retainedTotal, 0)
    : 0;
  const canRefund = refundableBalance > 0.009;
  const requiresNonRefundableReason = feeAction === "other";
  const showPaymentHandling =
    hasPayments && feeAction !== "all" && refundableBalance > 0.009;
  const usesSingleAbandonReason = feeAction === "all";

  useEffect(() => {
    if (!isOpen) return;

    if (!showFeeHandling) {
      setFeeAction("none");
      return;
    }

    if (canApplyRestocking) {
      setFeeAction("restocking");
    } else if (canApplyDeposit) {
      setFeeAction("deposit");
    } else {
      setFeeAction("none");
    }
  }, [isOpen, showFeeHandling, canApplyRestocking, canApplyDeposit]);

  useEffect(() => {
    if (!canRefund && paymentAction === "refund") {
      setPaymentAction(hasPayments ? "credit" : "none");
    }
  }, [canRefund, paymentAction, hasPayments]);

  useEffect(() => {
    if (feeAction === "all" && hasPayments) {
      setPaymentAction("none");
    } else if (
      feeAction !== "all" &&
      hasPayments &&
      paymentAction === "none"
    ) {
      setPaymentAction("credit");
    }
  }, [feeAction, hasPayments, paymentAction]);

  useEffect(() => {
    if (!isOpen) return;
    setReason("");
    setNonRefundableReason("");
    setError("");
    setTargetInvoiceId(null);
    setCustomerInvoices([]);
    setRefundProof(null);
    setFeeMethodId(null);
    setCustomFeeAmount("");
    setLateFeeAmount("");

    if (!invoice || !hasPayments) {
      setPaymentAction("none");
      return;
    } else {
      setPaymentAction("credit");
    }

    if (!invoice.customerId) return;

    setLoadingInvoices(true);
    fetch(
      `/api/invoices?customerId=${invoice.customerId}&status=all&limit=100&sortBy=invoiceNumber&sortDirection=desc`,
    )
      .then((res) => (res.ok ? res.json() : { invoices: [] }))
      .then((data) => {
        const rows: InvoiceOption[] = (data?.invoices || [])
          .filter((inv: any) => inv.id !== invoice.id)
          .map((inv: any) => ({
            id: inv.id,
            invoiceNumber: inv.invoiceNumber,
            amount: Number(inv.amount),
            paidAmount: Number(inv.paidAmount),
            dueDate: inv.dueDate,
            status: inv.status,
          }));
        setCustomerInvoices(rows);
      })
      .catch(() => {
        setCustomerInvoices([]);
      })
      .finally(() => setLoadingInvoices(false));
  }, [isOpen, invoice, hasPayments]);

  useEffect(() => {
    if (!isOpen) return;

    setLoadingPaymentMethods(true);
    fetch("/api/payment-methods")
      .then((res) => (res.ok ? res.json() : []))
      .then((data: PaymentMethodOption[]) => {
        setPaymentMethods(data);
        setFeeMethodId((prev) => prev || data[0]?.id || null);
      })
      .catch(() => {
        setPaymentMethods([]);
        setFeeMethodId(null);
      })
      .finally(() => setLoadingPaymentMethods(false));
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    setLoadingFeeSetting(true);
    fetch("/api/restocking-fee")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) {
          setRestockingFeeSetting(null);
          return;
        }

        setRestockingFeeSetting({
          amount: Number(data.amount || 0),
          isPercentage: !!data.isPercentage,
          isActive: !!data.isActive,
        });
      })
      .catch(() => setRestockingFeeSetting(null))
      .finally(() => setLoadingFeeSetting(false));

    fetch("/api/deposit-fee-rules?active=true")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        setDepositFeeRules(
          Array.isArray(data)
            ? data.map((rule: DepositFeeRuleLike) => ({
                unitName: rule.unitName,
                ruleType: rule.ruleType === "flat" ? "flat" : "range",
                minUnit: rule.minUnit == null ? null : Number(rule.minUnit),
                maxUnit: rule.maxUnit == null ? null : Number(rule.maxUnit),
                fee: Number(rule.fee || 0),
                isPercentage: !!rule.isPercentage,
                isActive: rule.isActive !== false,
                sortOrder: Number(rule.sortOrder || 0),
              }))
            : [],
        );
      })
      .catch(() => setDepositFeeRules([]));
  }, [isOpen]);

  const handleRefundProofChange = (file: File | null) => {
    if (!file) {
      setRefundProof(null);
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        setRefundProof(null);
        return;
      }

      setRefundProof({
        dataUrl: result,
        fileName: file.name,
        mimeType: file.type || "image/jpeg",
      });
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = () => {
    if (!reason.trim()) {
      setError(
        usesSingleAbandonReason
          ? "Please enter the reason for abandoning with all payments non-refundable."
          : "Reason is required.",
      );
      return;
    }

    if (requiresNonRefundableReason && !nonRefundableReason.trim()) {
      setError("Please enter the reason for making the amount non-refundable.");
      return;
    }

    if (showPaymentHandling) {
      if (paymentAction === "transfer" && !targetInvoiceId) {
        setError("Please select target invoice.");
        return;
      }
      if (
        !invoice?.customerId &&
        (paymentAction === "credit" || paymentAction === "transfer")
      ) {
        setError(
          "This invoice has no linked customer. Payment handling options are unavailable.",
        );
        return;
      }

      if (paymentAction === "refund" && !canRefund) {
        setError(
          "Refund is only available when paid amount exceeds the selected fee.",
        );
        return;
      }

      if (paymentAction === "refund" && !refundProof) {
        setError("Please upload refund proof image.");
        return;
      }
    }

    if (feeAction === "other" && effectiveOtherFee <= 0) {
      setError("Please enter a valid non-refundable amount.");
      return;
    }

    if (feeAction === "all" && paidAmount <= 0.009) {
      setError("There are no payments to retain as non-refundable.");
      return;
    }

    if (feeAction === "late" || feeAction === "both") {
      if (requestedLateFee <= 0.009) {
        setError("Enter the late fee amount to retain.");
        return;
      }
      if (retainedLateFee <= 0.009) {
        setError("The paid amount is already retained by the other fees.");
        return;
      }
    }

    if (
      !hasPayments &&
      feeAction !== "none" &&
      feeAction !== "all" &&
      (selectedFeeAmount > 0 || retainedLateFee > 0.009) &&
      !feeMethodId
    ) {
      setError("Please select a payment method for the fee payment.");
      return;
    }

    const trimmedReason = reason.trim();
    setError("");
    onConfirm({
      editReason: trimmedReason,
      paymentAction: showPaymentHandling ? paymentAction : "none",
      feeAction,
      ...(feeAction === "other" ? { customFeeAmount: effectiveOtherFee } : {}),
      ...((feeAction === "late" || feeAction === "both") &&
      retainedLateFee > 0
        ? { lateFeeAmount: retainedLateFee }
        : {}),
      ...(usesSingleAbandonReason
        ? { nonRefundableReason: trimmedReason }
        : requiresNonRefundableReason
          ? { nonRefundableReason: nonRefundableReason.trim() }
          : {}),
      ...(targetInvoiceId ? { targetInvoiceId } : {}),
      ...(feeMethodId ? { feeMethodId } : {}),
      ...(refundProof ? { refundProof } : {}),
    });
  };

  if (!invoice) return null;

  const statusNoun = getInvoiceAbandonStatusNoun(invoice.isLayaway);
  const markedPhrase = getInvoiceAbandonMarkedPhrase(invoice.isLayaway);
  const beforePhrase = getInvoiceAbandonBeforePhrase(invoice.isLayaway);
  const invoiceReference = getInvoiceAbandonInvoiceReference(invoice.isLayaway);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={getInvoiceAbandonModalTitle(invoice.invoiceNumber, invoice.isLayaway)}
      maxWidth="lg"
      headerColor="red"
      footer={
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
          >
            {isSubmitting ? "Processing..." : getInvoiceAbandonConfirmLabel(invoice.isLayaway)}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-gray-700">
          This action will set the invoice status to <strong>{statusNoun}</strong>{" "}
          and set the invoice total to <strong>$0.00</strong>.
        </p>

        {hasPayments && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            This invoice has recorded payments (${invoice.paidAmount.toFixed(2)}
            ). Choose how to handle those payments
            {showFeeHandling ? " and any non-refundable amounts" : ""}.
          </div>
        )}

        {!hasPayments && !showFeeHandling && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
            This invoice has no linked payments and no applicable fees. It will
            be {markedPhrase} with a $0 total.
          </div>
        )}

        {!hasPayments && showFeeHandling && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
            This invoice has no linked payments. Choose whether to create and
            retain a fee payment before {beforePhrase}.
          </div>
        )}

        {showFeeHandling && (
          <div className="space-y-3 rounded-lg border border-gray-200 p-3">
            <label className="block text-sm font-medium text-gray-700">
              {isLayaway ? "Fee Handling" : "Non-Refundable Amount"}
            </label>

            {canApplyRestocking && (
              <label className="flex items-start gap-2 text-sm text-gray-700">
                <input
                  type="radio"
                  checked={feeAction === "restocking"}
                  onChange={() => setFeeAction("restocking")}
                  className="mt-0.5"
                  disabled={loadingFeeSetting}
                />
                Apply restocking fee
                <span className="text-xs text-gray-500">
                  {restockingFeeSetting?.isPercentage
                    ? `${restockingFeeSetting.amount}% of item amount and layaway fee ($${restockingFeeAmount.toFixed(2)}${
                        hasPayments &&
                        restockingFeeAmount - effectiveRestockingFee > 0.009
                          ? `, kept at $${effectiveRestockingFee.toFixed(2)} of the paid amount`
                          : ""
                      })`
                    : `$${Number(restockingFeeSetting?.amount || 0).toFixed(2)} per unit ($${restockingFeeAmount.toFixed(2)})`}
                </span>
              </label>
            )}

            {canApplyDeposit && (
              <label className="flex items-start gap-2 text-sm text-gray-700">
                <input
                  type="radio"
                  checked={feeAction === "deposit"}
                  onChange={() => setFeeAction("deposit")}
                  className="mt-0.5"
                />
                {isLayaway
                  ? "Apply deposit fees from invoice items"
                  : "Deduct deposit fees from invoice items"}
                <span className="text-xs text-gray-500">
                  (${effectiveDepositFee.toFixed(2)}
                  {hasPayments && depositFeeTotal > paidAmount
                    ? ` of $${depositFeeTotal.toFixed(2)}, capped by the paid amount`
                    : ""}
                  )
                </span>
              </label>
            )}

            {canApplyOther && (
              <label className="flex items-start gap-2 text-sm text-gray-700">
                <input
                  type="radio"
                  checked={feeAction === "other"}
                  onChange={() => setFeeAction("other")}
                  className="mt-0.5"
                />
                Deduct other non-refundable amount
                <span className="text-xs text-gray-500">
                  (up to ${paidAmount.toFixed(2)} paid)
                </span>
              </label>
            )}

            {canApplyOther && feeAction === "other" && (
              <div className="ml-6">
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Non-refundable amount
                </label>
                <div className="relative max-w-xs">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                    $
                  </span>
                  <input
                    type="number"
                    min="0.01"
                    max={hasPayments ? paidAmount : undefined}
                    step="0.01"
                    value={customFeeAmount}
                    onChange={(e) => setCustomFeeAmount(e.target.value)}
                    className="w-full pl-7 pr-3 py-2 border border-gray-300 text-gray-900 rounded-lg"
                    placeholder="0.00"
                  />
                </div>
                {effectiveOtherFee > 0 && (
                  <p className="mt-1 text-xs text-gray-500">
                    ${effectiveOtherFee.toFixed(2)} will be retained; $
                    {refundableBalance.toFixed(2)} remains refundable.
                  </p>
                )}
              </div>
            )}

            <label className="flex items-start gap-2 text-sm text-gray-700">
              <input
                type="radio"
                checked={feeAction === "late"}
                onChange={() => setFeeAction("late")}
                className="mt-0.5"
              />
              Apply late fee
              {feeAction === "late" && retainedLateFee > 0.009 && (
                <span className="text-xs text-gray-500">
                  (${retainedLateFee.toFixed(2)} retained
                  {refundableBalance > 0.009
                    ? ` — $${refundableBalance.toFixed(2)} remains for credit, transfer, or refund`
                    : ""}
                  )
                </span>
              )}
            </label>

            {feeAction === "late" && (
              <div className="ml-6">
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Late fee to retain <span className="text-red-500">*</span>
                </label>
                <div className="relative max-w-xs">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                    $
                  </span>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={lateFeeAmount}
                    onChange={(e) => setLateFeeAmount(e.target.value)}
                    className="w-full pl-7 pr-3 py-2 border border-gray-300 text-gray-900 rounded-lg"
                    placeholder="0.00"
                  />
                </div>
              </div>
            )}

            {canApplyAllPayments && (
              <label className="flex items-start gap-2 text-sm text-gray-700">
                <input
                  type="radio"
                  checked={feeAction === "all"}
                  onChange={() => setFeeAction("all")}
                  className="mt-0.5"
                />
                Make all payments non-refundable
                <span className="text-xs text-gray-500">
                  (${paidAmount.toFixed(2)} paid — nothing left to refund or
                  credit)
                </span>
              </label>
            )}

            {canApplyAllPayments && feeAction === "all" && (
              <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
                The full paid amount (${paidAmount.toFixed(2)}) will be retained
                as non-refundable. No store credit, transfer, or refund will be
                issued.
              </div>
            )}

            {canApplyBoth && (
              <label className="flex items-start gap-2 text-sm text-gray-700">
                <input
                  type="radio"
                  checked={feeAction === "both"}
                  onChange={() => setFeeAction("both")}
                  className="mt-0.5"
                />
                Apply restocking, deposit, and late fees
                <span className="text-xs text-gray-500">
                  (restocking ${bothFeeAmounts.restocking.toFixed(2)}
                  {restockingFeeAmount - bothFeeAmounts.restocking > 0.009
                    ? ` of $${restockingFeeAmount.toFixed(2)}`
                    : ""}{" "}
                  + deposit ${bothFeeAmounts.deposit.toFixed(2)} + late fee $
                  {bothFeeAmounts.late.toFixed(2)} = $
                  {bothFeeAmounts.total.toFixed(2)}
                  {hasPayments ? `, capped by $${paidAmount.toFixed(2)} paid` : ""}
                  )
                </span>
              </label>
            )}

            {feeAction === "both" && (
              <div className="ml-6">
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Late fee to retain <span className="text-red-500">*</span>
                </label>
                <div className="relative max-w-xs">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                    $
                  </span>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={lateFeeAmount}
                    onChange={(e) => setLateFeeAmount(e.target.value)}
                    className="w-full pl-7 pr-3 py-2 border border-gray-300 text-gray-900 rounded-lg"
                    placeholder="0.00"
                  />
                </div>
                {feeAction === "both" && requestedLateFee > 0.009 && (
                  <p className="mt-1 text-xs text-gray-500">
                    Restocking ${bothFeeAmounts.restocking.toFixed(2)} + deposit
                    ${bothFeeAmounts.deposit.toFixed(2)} + late fee $
                    {bothFeeAmounts.late.toFixed(2)} = $
                    {bothFeeAmounts.total.toFixed(2)} retained.
                  </p>
                )}
              </div>
            )}

            <label className="flex items-start gap-2 text-sm text-gray-700">
              <input
                type="radio"
                checked={feeAction === "none"}
                onChange={() => setFeeAction("none")}
                className="mt-0.5"
              />
              {getInvoiceAbandonWithoutFeeLabel(invoice.isLayaway)}
            </label>

            {requiresNonRefundableReason && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Reason for non-refundable{" "}
                  <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={nonRefundableReason}
                  onChange={(e) => setNonRefundableReason(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 text-gray-900 rounded-lg"
                  placeholder="Why is this amount non-refundable?"
                />
              </div>
            )}

            {feeAction !== "none" &&
              feeAction !== "all" &&
              (selectedFeeAmount > 0 || retainedLateFee > 0.009) &&
              !hasPayments && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Fee Payment Method
                </label>
                <select
                  value={feeMethodId || ""}
                  onChange={(e) =>
                    setFeeMethodId(
                      e.target.value ? parseInt(e.target.value, 10) : null,
                    )
                  }
                  disabled={loadingPaymentMethods}
                  className="w-full px-3 py-2 border border-gray-300 text-gray-900 rounded-lg"
                >
                  <option value="">Select method</option>
                  {paymentMethods.map((method) => (
                    <option key={method.id} value={method.id}>
                      {method.name}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  {feeAction === "both" ? (
                    <>
                      Restocking fee (${bothFeeAmounts.restocking.toFixed(2)}),
                      deposit fee (${bothFeeAmounts.deposit.toFixed(2)}), and
                      late fee (${bothFeeAmounts.late.toFixed(2)}) totaling $
                      {bothFeeAmounts.total.toFixed(2)} will be recorded on this{" "}
                      {invoiceReference}.
                    </>
                  ) : feeAction === "late" ? (
                    <>
                      A late fee of ${retainedLateFee.toFixed(2)} will be
                      recorded on this {invoiceReference}.
                    </>
                  ) : feeAction === "other" ? (
                    <>
                      A non-refundable amount of ${selectedFeeAmount.toFixed(2)}{" "}
                      will be recorded on this {invoiceReference}.
                    </>
                  ) : (
                    <>
                      A {feeAction === "restocking" ? "restocking" : "deposit"}{" "}
                      fee payment of ${selectedFeeAmount.toFixed(2)} will be
                      recorded on this {invoiceReference}.
                    </>
                  )}
                </p>
              </div>
            )}

            {hasPayments &&
              feeAction !== "none" &&
              feeAction !== "all" &&
              (selectedFeeAmount > 0.009 || retainedLateFee > 0.009) && (
              <p className="text-xs text-gray-500">
                {feeAction === "both" ? (
                  <>
                    Restocking fee (${bothFeeAmounts.restocking.toFixed(2)}),
                    deposit fee (${bothFeeAmounts.deposit.toFixed(2)}), and late
                    fee (${bothFeeAmounts.late.toFixed(2)}) totaling $
                    {bothFeeAmounts.total.toFixed(2)} stay on the payments
                    already recorded on this {invoiceReference}.
                  </>
                ) : feeAction === "late" ? (
                  <>
                    Late fee of ${retainedLateFee.toFixed(2)} stays on the
                    payments already recorded on this {invoiceReference}.
                    {refundableBalance > 0.009 && (
                      <>
                        {" "}
                        ${refundableBalance.toFixed(2)} remains for credit,
                        transfer, or refund.
                      </>
                    )}
                  </>
                ) : (
                  <>
                    {feeAction === "other"
                      ? `A non-refundable amount of $${selectedFeeAmount.toFixed(2)}`
                      : `A ${feeAction === "restocking" ? "restocking" : "deposit"} fee of $${selectedFeeAmount.toFixed(2)}`}{" "}
                    stays on the payments already recorded on this{" "}
                    {invoiceReference}.
                  </>
                )}
              </p>
            )}

            {feeAction === "all" && selectedFeeAmount > 0 && (
              <p className="text-xs text-gray-500">
                Existing invoice payments totaling $
                {selectedFeeAmount.toFixed(2)} will stay on this{" "}
                {invoiceReference} as non-refundable. No new fee payment is
                created.
              </p>
            )}
          </div>
        )}

        {showPaymentHandling && (
          <div className="space-y-3 rounded-lg border border-gray-200 p-3">
            <label className="block text-sm font-medium text-gray-700">
              Payment Handling
            </label>

            <label className="flex items-start gap-2 text-sm text-gray-700">
              <input
                type="radio"
                checked={paymentAction === "credit"}
                onChange={() => setPaymentAction("credit")}
                disabled={!invoice.customerId}
                className="mt-0.5"
              />
              {retainedTotal > 0
                ? "Add remaining payments to customer Store Credit"
                : "Add all invoice payments to customer Store Credit"}
              {retainedTotal > 0 && (
                <span className="text-xs text-gray-500">
                  (${refundableBalance.toFixed(2)} after fees)
                </span>
              )}
            </label>

            <label className="flex items-start gap-2 text-sm text-gray-700">
              <input
                type="radio"
                checked={paymentAction === "transfer"}
                onChange={() => setPaymentAction("transfer")}
                disabled={!invoice.customerId}
                className="mt-0.5"
              />
              {retainedTotal > 0
                ? "Move remaining payments to another invoice of the same customer"
                : "Move all invoice payments to another invoice of the same customer"}
              {retainedTotal > 0 && (
                <span className="text-xs text-gray-500">
                  (${refundableBalance.toFixed(2)} after fees)
                </span>
              )}
            </label>

            {canRefund && (
              <label className="flex items-start gap-2 text-sm text-gray-700">
                <input
                  type="radio"
                  checked={paymentAction === "refund"}
                  onChange={() => setPaymentAction("refund")}
                  className="mt-0.5"
                />
                Refund payments and upload proof image
                <span className="text-xs text-gray-500">
                  (up to ${refundableBalance.toFixed(2)} after fees)
                </span>
              </label>
            )}

            {paymentAction === "transfer" && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Target Invoice
                </label>
                <select
                  value={targetInvoiceId || ""}
                  onChange={(e) =>
                    setTargetInvoiceId(
                      e.target.value ? parseInt(e.target.value, 10) : null,
                    )
                  }
                  disabled={loadingInvoices || !invoice.customerId}
                  className="w-full px-3 py-2 border border-gray-300 text-gray-900 rounded-lg"
                >
                  <option value="">Select invoice</option>
                  {customerInvoices.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      {inv.invoiceNumber} - Remaining $
                      {(inv.amount - inv.paidAmount).toFixed(2)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {paymentAction === "refund" && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Refund Proof Image
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) =>
                    handleRefundProofChange(e.target.files?.[0] || null)
                  }
                  className="block w-full text-sm text-gray-700 file:mr-4 file:rounded-lg file:border-0 file:bg-gray-900 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-gray-800"
                />
                {refundProof && (
                  <p className="mt-2 text-xs text-gray-500">
                    Selected: {refundProof.fileName}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {usesSingleAbandonReason
              ? "Reason for abandon & non-refundable"
              : "Reason"}{" "}
            <span className="text-red-500">*</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 text-gray-900 rounded-lg"
            placeholder={
              usesSingleAbandonReason
                ? "Why are you abandoning this invoice and retaining all payments as non-refundable?"
                : getInvoiceAbandonReasonPlaceholder(invoice.isLayaway)
            }
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </Modal>
  );
}
