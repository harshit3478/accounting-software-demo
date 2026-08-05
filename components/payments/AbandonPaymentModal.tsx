"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Modal from "../invoices/Modal";
import LucideIcon from "../LucideIcon";
import { AlertTriangle, FileText, Link2, Wallet } from "lucide-react";
import type { Payment } from "../../hooks/usePayments";
import { formatBusinessDate } from "../../lib/business-date";
import type { AbandonPaymentPreview } from "../../lib/abandon-payment-preview";

interface AbandonPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  payment: Payment | null;
  onConfirm: (reason: string) => Promise<void>;
  isLoading?: boolean;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

function linkTypeLabel(linkType: AbandonPaymentPreview["linkedInvoices"][number]["linkType"]) {
  switch (linkType) {
    case "direct":
      return "Direct payment";
    case "matched":
      return "Matched payment";
    case "store_credit_applied":
      return "Store credit applied";
    default:
      return linkType;
  }
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
  const [preview, setPreview] = useState<AbandonPaymentPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !payment) {
      setPreview(null);
      setPreviewError(null);
      return;
    }

    let cancelled = false;
    setPreviewLoading(true);
    setPreviewError(null);

    fetch(`/api/payments/${payment.id}/abandon-preview`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error || "Failed to load abandon preview");
        }
        if (!cancelled) {
          setPreview(data);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setPreviewError(
            err instanceof Error ? err.message : "Failed to load abandon preview",
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setPreviewLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, payment?.id]);

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

  const formatDate = (dateString: string) => formatBusinessDate(dateString);
  const methodColor = payment.method?.color || "#6B7280";
  const paymentCode =
    payment.paymentCode || `PAY-${String(payment.id).padStart(6, "0")}`;

  return createPortal(
    <Modal
      isOpen={isOpen}
      onClose={handleCancel}
      title="Abandon Payment"
      headerColor="red"
      maxWidth="lg"
    >
      <div className="space-y-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-900">
              Review linked invoices and store credit before abandoning
            </p>
            <p className="text-sm text-red-700 mt-1">
              Abandoning will automatically remove this payment from every
              linked invoice below and reverse unused store credit. This cannot
              be undone.
            </p>
          </div>
        </div>

        <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg p-5 border border-gray-200">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">
            Payment Details
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-600 mb-1">Payment ID</p>
              <p className="text-sm font-medium text-gray-900">{paymentCode}</p>
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
        </div>

        {previewLoading && (
          <div className="rounded-lg border border-gray-200 bg-white px-4 py-6 text-sm text-gray-500 text-center">
            Loading linked invoices and store credit impact...
          </div>
        )}

        {previewError && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {previewError}
          </div>
        )}

        {preview && !previewLoading && (
          <>
            {preview.storeCredit && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Wallet className="w-4 h-4 text-amber-700" />
                  <h3 className="text-sm font-semibold text-amber-900">
                    Store Credit Impact
                  </h3>
                </div>
                {preview.customer && (
                  <p className="text-sm text-amber-900 mb-3">
                    Customer:{" "}
                    <span className="font-medium">{preview.customer.name}</span>
                  </p>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-amber-700">
                      Original credit
                    </p>
                    <p className="font-semibold text-amber-950">
                      {formatCurrency(preview.storeCredit.originalCredit)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-amber-700">
                      Already applied
                    </p>
                    <p className="font-semibold text-amber-950">
                      {formatCurrency(preview.storeCredit.appliedAmount)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-amber-700">
                      Will be reversed
                    </p>
                    <p className="font-semibold text-amber-950">
                      {formatCurrency(preview.storeCredit.unspentAmount)}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200 bg-gray-50">
                <Link2 className="w-4 h-4 text-gray-600" />
                <h3 className="text-sm font-semibold text-gray-900">
                  Will be removed from these invoices
                </h3>
              </div>

              {preview.linkedInvoices.length === 0 ? (
                <p className="px-4 py-5 text-sm text-gray-500">
                  This payment is not linked to any invoice.
                </p>
              ) : (
                <div className="divide-y divide-gray-100">
                  {preview.linkedInvoices.map((invoice) => (
                    <div
                      key={`${invoice.invoiceId}-${invoice.linkType}`}
                      className="px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {invoice.invoiceNumber}
                        </p>
                        <p className="text-xs text-gray-600">
                          {invoice.clientName}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Invoice total {formatCurrency(invoice.amount)} · Paid{" "}
                          {formatCurrency(invoice.paidAmount)} · Status{" "}
                          {invoice.status}
                        </p>
                      </div>
                      <div className="text-left sm:text-right">
                        <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-100 text-blue-800">
                          {linkTypeLabel(invoice.linkType)}
                        </span>
                        <p className="text-sm font-semibold text-red-700 mt-1">
                          -{formatCurrency(invoice.linkedAmount)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-4 h-4 text-gray-600" />
                <h3 className="text-sm font-semibold text-gray-900">
                  What will happen
                </h3>
              </div>
              <ul className="space-y-1.5 text-sm text-gray-700 list-disc pl-5">
                {preview.summary.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          </>
        )}

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
        </div>

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
            disabled={isLoading || previewLoading || !reason.trim()}
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
                Abandon & Remove Links
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>,
    document.body,
  );
}
