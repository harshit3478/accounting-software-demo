"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import Modal from "../invoices/Modal";
import LucideIcon from "../LucideIcon";
import { AlertTriangle } from "lucide-react";
import type { Payment } from "../../hooks/usePayments";

interface AbandonPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  payment: Payment | null;
  onConfirm: (reason: string) => Promise<void>;
  isLoading?: boolean;
}

export default function AbandonPaymentModal({
  isOpen,
  onClose,
  payment,
  onConfirm,
  isLoading = false,
}: AbandonPaymentModalProps) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!payment || typeof document === "undefined") return null;

  const formatAmount = (value: unknown) => {
    const numericValue =
      typeof value === "number"
        ? value
        : typeof value === "string"
          ? Number(value)
          : value && typeof value === "object" && "toNumber" in value
            ? Number((value as { toNumber: () => number }).toNumber())
            : Number(value);

    return Number.isFinite(numericValue) ? numericValue.toFixed(2) : "0.00";
  };

  const handleSubmit = async () => {
    if (!reason.trim()) {
      setError("Please provide a reason for abandoning this payment");
      return;
    }

    try {
      setError(null);
      await onConfirm(reason.trim());
      setReason("");
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to abandon payment",
      );
    }
  };

  const handleCancel = () => {
    setReason("");
    setError(null);
    onClose();
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const methodColor = payment.method?.color || "#6B7280";

  return createPortal(
    <Modal
      isOpen={isOpen}
      onClose={handleCancel}
      title="Abandon Payment"
      headerColor="red"
      maxWidth="lg"
    >
      <div className="space-y-6">
        {/* Warning Banner */}
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-900">
              Warning: This action cannot be undone
            </p>
            <p className="text-sm text-red-700 mt-1">
              This payment will be removed from any linked invoices and any
              associated credit balances will be reversed.
            </p>
          </div>
        </div>

        {/* Payment Details Summary */}
        <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg p-5 border border-gray-200">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">
            Payment Details
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-600 mb-1">Payment ID</p>
              <p className="text-sm font-medium text-gray-900">
                {payment.paymentCode ||
                  `PAY-${String(payment.id).padStart(6, "0")}`}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-600 mb-1">Amount</p>
              <p className="text-sm font-semibold text-gray-900">
                ${formatAmount(payment.amount)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-600 mb-1">Date</p>
              <p className="text-sm font-medium text-gray-900">
                {formatDate(payment.paymentDate)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-600 mb-1">Method</p>
              <div
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                style={{
                  backgroundColor: `${methodColor}20`,
                  color: methodColor,
                }}
              >
                {payment.method?.icon && (
                  <LucideIcon
                    name={payment.method.icon}
                    size={12}
                    fallback={payment.method.name}
                  />
                )}
                {payment.method?.name || "Unknown"}
              </div>
            </div>
          </div>
          {payment.invoice && (
            <div className="mt-4 pt-4 border-t border-gray-300">
              <p className="text-xs text-gray-600 mb-2">Linked Invoice</p>
              <div className="space-y-1">
                <p className="text-sm font-medium text-gray-900">
                  {payment.invoice.invoiceNumber}
                </p>
                <p className="text-xs text-gray-600">
                  {payment.invoice.clientName}
                </p>
              </div>
            </div>
          )}
          {payment.paymentMatches && payment.paymentMatches.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-300">
              <p className="text-xs text-gray-600 mb-2">Matched Invoices</p>
              <div className="space-y-1">
                {payment.paymentMatches.map((match) => (
                  <div key={match.id} className="text-xs">
                    <p className="font-medium text-gray-900">
                      {match.invoice.invoiceNumber}
                    </p>
                    <p className="text-gray-600">
                      ${formatAmount(match.amount)} - {match.invoice.clientName}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Reason Input */}
        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-2">
            Reason for Abandonment <span className="text-red-600">*</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              if (error) setError(null);
            }}
            placeholder="Explain why you are abandoning this payment (required for audit/security purposes)..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
            rows={4}
            disabled={isLoading}
          />
          {error && (
            <p className="mt-2 text-sm text-red-600 font-medium">{error}</p>
          )}
          <p className="mt-1 text-xs text-gray-500">
            This information will be recorded for audit and compliance purposes.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
          <button
            type="button"
            onClick={handleCancel}
            disabled={isLoading}
            className="px-4 py-2.5 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isLoading || !reason.trim()}
            className="px-4 py-2.5 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Abandoning...
              </>
            ) : (
              <>
                <AlertTriangle className="w-4 h-4" />
                Abandon Payment
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>,
    document.body,
  );
}
