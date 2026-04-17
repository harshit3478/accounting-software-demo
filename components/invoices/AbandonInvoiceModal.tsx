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

interface InvoiceLike {
  id: number;
  invoiceNumber: string;
  clientName: string;
  customerId?: number | null;
  paidAmount: number;
}

interface AbandonInvoiceModalProps {
  isOpen: boolean;
  invoice: InvoiceLike | null;
  isSubmitting?: boolean;
  onClose: () => void;
  onConfirm: (payload: {
    editReason: string;
    paymentAction: "credit" | "transfer" | "none";
    targetInvoiceId?: number;
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
    "credit" | "transfer" | "none"
  >("credit");
  const [targetInvoiceId, setTargetInvoiceId] = useState<number | null>(null);
  const [customerInvoices, setCustomerInvoices] = useState<InvoiceOption[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [error, setError] = useState("");

  const hasPayments = (invoice?.paidAmount || 0) > 0;

  useEffect(() => {
    if (!isOpen) return;
    setReason("");
    setError("");
    setTargetInvoiceId(null);
    setCustomerInvoices([]);

    if (!invoice || !hasPayments) {
      setPaymentAction("none");
      return;
    }

    setPaymentAction("credit");

    if (!invoice.customerId) return;

    setLoadingInvoices(true);
    fetch(
      `/api/invoices?customerId=${invoice.customerId}&status=all&limit=100&sortBy=date&sortDirection=desc`,
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
    }

    setError("");
    onConfirm({
      editReason: reason.trim(),
      paymentAction: hasPayments ? paymentAction : "none",
      ...(targetInvoiceId ? { targetInvoiceId } : {}),
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
          This action will set the invoice status to <strong>Abandoned</strong>.
        </p>

        {hasPayments && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            This invoice has recorded payments (${invoice.paidAmount.toFixed(2)}
            ). Choose how to handle those payments.
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
