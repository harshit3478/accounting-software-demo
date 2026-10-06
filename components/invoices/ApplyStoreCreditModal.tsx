"use client";

import { useEffect, useState } from "react";
import Modal from "./Modal";
import { getInvoiceAmountDue } from "../../lib/invoice-display";

interface ApplyStoreCreditInvoice {
  id: number;
  invoiceNumber: string;
  clientName: string;
  amount?: number | null;
  paidAmount?: number | null;
  status?: string;
  subtotal?: number | null;
  tax?: number | null;
  discount?: number | null;
  earlyPaymentDiscount?: number | null;
  unitDiscountAmount?: number | null;
  shippingDiscountAmount?: number | null;
  shippingFee?: number | null;
  insuranceAmount?: number | null;
  layawayFee?: number | null;
  lateFee?: number | null;
  processingFee?: number | null;
  isLayaway?: boolean;
  customer?: {
    storeCredit?: number | null;
  } | null;
}

interface ApplyStoreCreditModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: ApplyStoreCreditInvoice | null;
  availableStoreCredit?: number;
  amountDue?: number;
  onSuccess: (message: string, result: ApplyStoreCreditResult) => void;
}

export interface ApplyStoreCreditResult {
  appliedAmount: number;
  payments: Array<{ id: number; paymentCode: string; amount: number }>;
  storeCredit: number;
  invoice: { paidAmount: number; status?: string; amount: number };
  editHistoryEntry?: {
    id: number;
    reason: string;
    createdAt: string;
    changes?: Record<string, unknown> | null;
    editedBy?: {
      id: number;
      name: string;
      email: string;
      displayName?: string;
    } | null;
  };
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export default function ApplyStoreCreditModal({
  isOpen,
  onClose,
  invoice,
  availableStoreCredit,
  amountDue,
  onSuccess,
}: ApplyStoreCreditModalProps) {
  const [amount, setAmount] = useState(0);
  const [isApplying, setIsApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const credit = roundMoney(
    Number(availableStoreCredit ?? invoice?.customer?.storeCredit ?? 0),
  );
  const due = roundMoney(
    amountDue ?? (invoice ? getInvoiceAmountDue(invoice) : 0),
  );
  const maxAmount = roundMoney(Math.min(credit, due));

  useEffect(() => {
    if (!isOpen) return;
    setAmount(maxAmount);
    setError(null);
    setIsApplying(false);
  }, [isOpen, invoice?.id, maxAmount]);

  const handleApply = async () => {
    if (!invoice) return;

    const nextAmount = roundMoney(amount);
    if (nextAmount <= 0) {
      setError("Enter an amount greater than 0");
      return;
    }
    if (nextAmount > credit + 0.001) {
      setError(`Amount cannot exceed store credit ($${credit.toFixed(2)})`);
      return;
    }
    if (nextAmount > due + 0.001) {
      setError(`Amount cannot exceed the invoice balance ($${due.toFixed(2)})`);
      return;
    }

    setIsApplying(true);
    setError(null);

    try {
      const res = await fetch(`/api/invoices/${invoice.id}/apply-store-credit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: nextAmount }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to apply store credit");
        return;
      }

      const result = data as ApplyStoreCreditResult;
      const codes = (result.payments || [])
        .map((payment) => payment.paymentCode)
        .filter(Boolean)
        .join(", ");
      const message = `Applied $${Number(result.appliedAmount).toFixed(2)}${
        codes ? ` as ${codes}` : ""
      }. $${Number(result.storeCredit).toFixed(2)} remains in store credit.`;

      onSuccess(message, result);
      onClose();
    } catch (applyError) {
      console.error("Failed to apply store credit:", applyError);
      setError("Failed to apply store credit");
    } finally {
      setIsApplying(false);
    }
  };

  if (!invoice) return null;

  const remainingCredit = roundMoney(Math.max(credit - (Number(amount) || 0), 0));

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Apply Store Credit to ${invoice.invoiceNumber}`}
      headerColor="green"
      footer={
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isApplying}
            className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={isApplying || maxAmount <= 0 || amount <= 0}
            className="px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {isApplying ? "Applying..." : "Apply Store Credit"}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          Apply part of {invoice.clientName}&apos;s store credit to this invoice.
          A payment is created and attached here. Whatever you do not apply stays
          in store credit.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">
              Store credit
            </p>
            <p className="mt-1 text-lg font-bold text-emerald-800">
              ${credit.toFixed(2)}
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
              Invoice balance
            </p>
            <p className="mt-1 text-lg font-bold text-gray-900">
              ${due.toFixed(2)}
            </p>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Amount to apply
            <span className="ml-2 text-xs font-normal text-emerald-700">
              Max ${maxAmount.toFixed(2)}
            </span>
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              $
            </span>
            <input
              type="number"
              min="0.01"
              step="0.01"
              max={maxAmount}
              value={Number.isFinite(amount) ? amount : ""}
              onChange={(event) => setAmount(Number(event.target.value) || 0)}
              className="w-full pl-7 pr-4 py-2 border border-gray-300 rounded-lg text-gray-900"
            />
          </div>
          <p className="mt-2 text-sm text-gray-500">
            ${remainingCredit.toFixed(2)} will remain in store credit.
          </p>
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
