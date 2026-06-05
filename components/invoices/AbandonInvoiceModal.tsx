"use client";

import { useEffect, useState } from "react";
import Modal from "./Modal";

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
  isLayaway?: boolean;
  items?: Array<{
    depositFee?: number | string | null;
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
    feeAction: "restocking" | "deposit" | "both" | "none";
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
  const [paymentAction, setPaymentAction] = useState<
    "credit" | "transfer" | "refund" | "none"
  >("credit");
  const [feeAction, setFeeAction] = useState<
    "restocking" | "deposit" | "both" | "none"
  >("none");
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
  const [loadingFeeSetting, setLoadingFeeSetting] = useState(false);

  const paidAmount = invoice?.paidAmount || 0;
  const hasPayments = paidAmount > 0;
  const isLayaway = !!invoice?.isLayaway;
  const depositFeeTotal = (invoice?.items || []).reduce((sum, item) => {
    const fee = Number(item.depositFee || 0);
    return sum + (Number.isFinite(fee) ? fee : 0);
  }, 0);
  const restockingFeeAmount = restockingFeeSetting
    ? restockingFeeSetting.isPercentage
      ? ((invoice?.amount || 0) * restockingFeeSetting.amount) / 100
      : restockingFeeSetting.amount
    : 0;
  const effectiveRestockingFee = hasPayments
    ? Math.min(restockingFeeAmount, paidAmount)
    : restockingFeeAmount;
  const effectiveDepositFee = hasPayments
    ? Math.min(depositFeeTotal, paidAmount)
    : depositFeeTotal;
  const canApplyRestocking =
    isLayaway &&
    !!restockingFeeSetting?.isActive &&
    effectiveRestockingFee > 0;
  const canApplyDeposit = effectiveDepositFee > 0;
  const canApplyBoth = canApplyRestocking && canApplyDeposit;
  const showFeeHandling = canApplyRestocking || canApplyDeposit;
  const bothFeeAmounts = (() => {
    if (!hasPayments) {
      return {
        restocking: restockingFeeAmount,
        deposit: depositFeeTotal,
        total: restockingFeeAmount + depositFeeTotal,
      };
    }

    const restockingPart = Math.min(restockingFeeAmount, paidAmount);
    const depositPart = Math.min(
      depositFeeTotal,
      Math.max(paidAmount - restockingPart, 0),
    );

    return {
      restocking: restockingPart,
      deposit: depositPart,
      total: restockingPart + depositPart,
    };
  })();
  const selectedFeeAmount =
    feeAction === "restocking"
      ? effectiveRestockingFee
      : feeAction === "deposit"
        ? effectiveDepositFee
        : feeAction === "both"
          ? bothFeeAmounts.total
          : 0;
  const refundableBalance = hasPayments
    ? Math.max(paidAmount - selectedFeeAmount, 0)
    : 0;
  const canRefund = refundableBalance > 0.009;

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
  }, [
    isOpen,
    showFeeHandling,
    canApplyRestocking,
    canApplyDeposit,
  ]);

  useEffect(() => {
    if (!canRefund && paymentAction === "refund") {
      setPaymentAction(hasPayments ? "credit" : "none");
    }
  }, [canRefund, paymentAction, hasPayments]);

  useEffect(() => {
    if (!isOpen) return;
    setReason("");
    setError("");
    setTargetInvoiceId(null);
    setCustomerInvoices([]);
    setRefundProof(null);
    setFeeMethodId(null);

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
      setError("Reason is required.");
      return;
    }

    if (hasPayments) {
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

    if (feeAction !== "none" && selectedFeeAmount > 0 && !feeMethodId) {
      setError("Please select a payment method for the fee payment.");
      return;
    }

    setError("");
    onConfirm({
      editReason: reason.trim(),
      paymentAction: hasPayments ? paymentAction : "none",
      feeAction,
      ...(targetInvoiceId ? { targetInvoiceId } : {}),
      ...(feeMethodId ? { feeMethodId } : {}),
      ...(refundProof ? { refundProof } : {}),
    });
  };

  if (!invoice) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Mark Invoice ${invoice.invoiceNumber} as Abandoned`}
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
            {isSubmitting ? "Processing..." : "Mark Abandoned"}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-gray-700">
          This action will set the invoice status to <strong>Abandoned</strong>{" "}
          and set the invoice total to <strong>$0.00</strong>.
        </p>

        {hasPayments && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            This invoice has recorded payments (${invoice.paidAmount.toFixed(2)}
            ). Choose how to handle those payments.
          </div>
        )}

        {!hasPayments && !showFeeHandling && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
            This invoice has no linked payments and no applicable fees. It will be
            marked abandoned with a $0 total.
          </div>
        )}

        {!hasPayments && showFeeHandling && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
            This invoice has no linked payments. Choose whether to create and
            retain a fee payment before marking it abandoned.
          </div>
        )}

        {showFeeHandling && (
          <div className="space-y-3 rounded-lg border border-gray-200 p-3">
            <label className="block text-sm font-medium text-gray-700">
              Fee Handling
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
                    ? `${restockingFeeSetting.amount}% of invoice total (~$${effectiveRestockingFee.toFixed(2)}${hasPayments ? `, up to $${paidAmount.toFixed(2)} paid` : ""})`
                    : `$${effectiveRestockingFee.toFixed(2)} fixed`}
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
                Apply deposit fees from invoice items
                <span className="text-xs text-gray-500">
                  (${effectiveDepositFee.toFixed(2)}
                  {hasPayments && depositFeeTotal > paidAmount
                    ? ` of $${depositFeeTotal.toFixed(2)}, capped by paid amount`
                    : ""}
                  )
                </span>
              </label>
            )}

            {canApplyBoth && (
              <label className="flex items-start gap-2 text-sm text-gray-700">
                <input
                  type="radio"
                  checked={feeAction === "both"}
                  onChange={() => setFeeAction("both")}
                  className="mt-0.5"
                />
                Apply both restocking and deposit fees
                <span className="text-xs text-gray-500">
                  (restocking ${bothFeeAmounts.restocking.toFixed(2)} + deposit $
                  {bothFeeAmounts.deposit.toFixed(2)} = $
                  {bothFeeAmounts.total.toFixed(2)}
                  {hasPayments ? `, capped by $${paidAmount.toFixed(2)} paid` : ""}
                  )
                </span>
              </label>
            )}

            <label className="flex items-start gap-2 text-sm text-gray-700">
              <input
                type="radio"
                checked={feeAction === "none"}
                onChange={() => setFeeAction("none")}
                className="mt-0.5"
              />
              Abandon without fee
            </label>

            {feeAction !== "none" && selectedFeeAmount > 0 && (
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
                      Restocking fee (${bothFeeAmounts.restocking.toFixed(2)})
                      and deposit fee (${bothFeeAmounts.deposit.toFixed(2)})
                      payments totaling ${selectedFeeAmount.toFixed(2)} will be
                      linked to this abandoned invoice.
                    </>
                  ) : (
                    <>
                      A {feeAction === "restocking" ? "restocking" : "deposit"}{" "}
                      fee payment of ${selectedFeeAmount.toFixed(2)} will be
                      linked to this abandoned invoice.
                    </>
                  )}
                </p>
              </div>
            )}
          </div>
        )}

        {hasPayments && (
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
              Add all invoice payments to customer Store Credit
            </label>

            <label className="flex items-start gap-2 text-sm text-gray-700">
              <input
                type="radio"
                checked={paymentAction === "transfer"}
                onChange={() => setPaymentAction("transfer")}
                disabled={!invoice.customerId}
                className="mt-0.5"
              />
              Move all invoice payments to another invoice of the same customer
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
            Reason <span className="text-red-500">*</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 text-gray-900 rounded-lg"
            placeholder="Why are you abandoning this invoice?"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </Modal>
  );
}
