"use client";

import Modal from "./Modal";
import { InvoiceItem } from "./types";
import { useEffect, useState } from "react";
import { formatBusinessDate } from "../../lib/business-date";

interface PreviewInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  clientName: string;
  invoiceDate: string;
  dueDate: string;
  dueDateReason?: string | null;
  items: InvoiceItem[];
  subtotal: number;
  tax: number;
  taxType: "fixed" | "percentage";
  discount: number;
  discountType: "fixed" | "percentage";
  shippingFee?: number;
  insuranceAmount?: number;
  layawayFee?: number;
  insuranceBaseAmount?: number | null;
  total: number;
  isLayaway: boolean;
  isSubmitting?: boolean;
  useDefaultTerms?: boolean;
  customTerms?: string[];
  availableStoreCredit?: number;
  applyStoreCredit?: boolean;
  onApplyStoreCreditChange?: (value: boolean) => void;
}

export default function PreviewInvoiceModal({
  isOpen,
  onClose,
  onConfirm,
  clientName,
  invoiceDate,
  dueDate,
  dueDateReason,
  items,
  subtotal,
  tax,
  taxType,
  discount,
  discountType,
  shippingFee = 0,
  insuranceAmount = 0,
  layawayFee = 0,
  insuranceBaseAmount,
  total,
  isLayaway,
  isSubmitting = false,
  useDefaultTerms = true,
  customTerms = [],
  availableStoreCredit = 0,
  applyStoreCredit = false,
  onApplyStoreCreditChange,
}: PreviewInvoiceModalProps) {
  const [defaultTerms, setDefaultTerms] = useState<string[] | null>(null);

  useEffect(() => {
    if (useDefaultTerms) {
      // fetch default terms
      fetch("/api/terms")
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data)) {
            const def = data.find((t: any) => t.isDefault);
            if (def) setDefaultTerms(def.lines || null);
          }
        })
        .catch(() => {});
    }
  }, [useDefaultTerms]);

  const termsToShow = useDefaultTerms ? defaultTerms || [] : customTerms;
  const creditToApply = Math.min(availableStoreCredit, total);
  const amountDueAfterCredit = Math.max(total - creditToApply, 0);
  const showStoreCreditOption = availableStoreCredit > 0;
  const getTaxAmount = () => {
    return taxType === "percentage" ? (subtotal * tax) / 100 : tax;
  };

  const getDiscountAmount = () => {
    return discountType === "percentage"
      ? (subtotal * discount) / 100
      : discount;
  };

  const footer = (
    <div className="flex justify-end space-x-4">
      <button
        onClick={onClose}
        className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-100 transition-colors"
        disabled={isSubmitting}
      >
        Edit
      </button>
      <button
        onClick={onConfirm}
        disabled={isSubmitting}
        className="px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors disabled:bg-green-400 disabled:cursor-not-allowed flex items-center"
      >
        {isSubmitting ? (
          <>
            <svg
              className="animate-spin h-5 w-5 mr-2"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            Creating...
          </>
        ) : (
          "Confirm & Create"
        )}
      </button>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Preview Invoice"
      footer={footer}
      maxWidth="4xl"
      headerColor="green"
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-blue-50 p-4 rounded-lg">
          <h4 className="text-lg font-semibold text-gray-900 mb-2">
            Invoice Summary
          </h4>
          <p className="text-sm text-gray-600">
            Please review the invoice details before creating.
          </p>
        </div>

        {/* Client Info */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Client Name
            </p>
            <p className="text-lg font-semibold text-gray-900 mt-1">
              {clientName}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Invoice Date
            </p>
            <p className="text-lg font-semibold text-gray-900 mt-1">
              {formatBusinessDate(invoiceDate, {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Due Date
            </p>
            <p className="text-lg font-semibold text-gray-900 mt-1">
              {formatBusinessDate(dueDate, {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>
        </div>

        {dueDateReason?.trim() && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <p className="text-xs font-medium text-amber-700 uppercase tracking-wide">
              Back Due Date Reason
            </p>
            <p className="text-sm text-amber-900 mt-1">{dueDateReason}</p>
          </div>
        )}

        {/* Items Table */}
        <div>
          <h4 className="text-sm font-semibold text-gray-900 mb-3">Items</h4>
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">
                    Item
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700">
                    Qty / Unit
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700">
                    Price
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => (
                  <tr
                    key={index}
                    className="border-b border-gray-100 last:border-b-0"
                  >
                    <td className="px-4 py-3 text-sm text-gray-900">
                      <div className="font-medium">{item.name}</div>
                      {Number(item.depositFee || 0) > 0 && (
                        <div className="mt-1 text-xs text-amber-700">
                          Deposit fee: $
                          {Number(item.depositFee || 0).toFixed(2)}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right">
                      {item.quantity} {item.unit || "grams"}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right">
                      ${item.price.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 text-right">
                      ${(item.quantity * item.price).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Calculations */}
        <div className="space-y-2 bg-gray-50 p-4 rounded-lg">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Subtotal:</span>
            <span className="font-medium text-gray-900">
              ${subtotal.toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">
              Tax {taxType === "percentage" ? `(${tax.toFixed(2)}%)` : ""}:
            </span>
            <span className="font-medium text-gray-900">
              ${getTaxAmount().toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">
              Discount{" "}
              {discountType === "percentage" ? `(${discount.toFixed(2)}%)` : ""}
              :
            </span>
            <span className="font-medium text-red-600">
              -${getDiscountAmount().toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Shipping Fee:</span>
            <span className="font-medium text-gray-900">
              ${shippingFee.toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Insurance:</span>
            <span className="font-medium text-gray-900">
              ${insuranceAmount.toFixed(2)}
            </span>
          </div>
          {layawayFee > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Layaway Fee:</span>
              <span className="font-medium text-gray-900">
                ${layawayFee.toFixed(2)}
              </span>
            </div>
          )}
          {insuranceBaseAmount != null && insuranceBaseAmount > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Insurance Applied On:</span>
              <span className="font-medium text-gray-900">
                ${insuranceBaseAmount.toFixed(2)}
              </span>
            </div>
          )}
          <div className="border-t border-gray-300 pt-2 mt-2 flex justify-between">
            <span className="font-semibold text-gray-900">Total:</span>
            <span className="text-lg font-bold text-blue-600">
              ${total.toFixed(2)}
            </span>
          </div>
          {showStoreCreditOption && applyStoreCredit && (
            <>
              <div className="flex justify-between text-sm pt-1">
                <span className="text-emerald-700">Store Credit Applied:</span>
                <span className="font-medium text-emerald-700">
                  -${creditToApply.toFixed(2)}
                </span>
              </div>
              <div className="border-t border-gray-300 pt-2 mt-1 flex justify-between">
                <span className="font-semibold text-gray-900">Amount Due:</span>
                <span className="text-lg font-bold text-gray-900">
                  ${amountDueAfterCredit.toFixed(2)}
                </span>
              </div>
            </>
          )}
        </div>

        {showStoreCreditOption && (
          <div className="rounded-xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50 via-white to-amber-50 p-5 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-100 ring-4 ring-emerald-50">
                <svg
                  className="h-5 w-5 text-emerald-700"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                  />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
                  Store Credit
                </p>
                <p className="mt-1 text-2xl font-bold text-emerald-700">
                  ${availableStoreCredit.toFixed(2)}
                </p>
                <p className="mt-1 text-sm text-gray-600">
                  Available for {clientName} from previous overpayments.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                onApplyStoreCreditChange?.(!applyStoreCredit)
              }
              className={`mt-4 w-full rounded-lg border p-4 text-left transition-all ${
                applyStoreCredit
                  ? "border-emerald-400 bg-white shadow-sm ring-2 ring-emerald-100"
                  : "border-gray-200 bg-white/80 hover:border-emerald-200 hover:bg-white"
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                    applyStoreCredit
                      ? "border-emerald-600 bg-emerald-600 text-white"
                      : "border-gray-300 bg-white"
                  }`}
                >
                  {applyStoreCredit && (
                    <svg
                      className="h-3.5 w-3.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="3"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    Apply store credit to this invoice
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    {applyStoreCredit
                      ? `${creditToApply.toFixed(2)} will be applied when you confirm.`
                      : "Invoice will be created fully unpaid if you leave this off."}
                  </p>
                </div>
              </div>
            </button>

            {applyStoreCredit && (
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-center">
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                    Invoice Total
                  </p>
                  <p className="mt-1 text-lg font-bold text-gray-900">
                    ${total.toFixed(2)}
                  </p>
                </div>
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-center">
                  <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">
                    Credit Applied
                  </p>
                  <p className="mt-1 text-lg font-bold text-emerald-800">
                    -${creditToApply.toFixed(2)}
                  </p>
                </div>
                <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-center">
                  <p className="text-xs font-medium uppercase tracking-wide text-blue-700">
                    Amount Due
                  </p>
                  <p className="mt-1 text-lg font-bold text-blue-900">
                    ${amountDueAfterCredit.toFixed(2)}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Status */}
        {isLayaway && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <p className="text-sm text-yellow-800">
              <span className="font-semibold">⚠️ Layaway Invoice:</span> This
              invoice is marked as an installment payment plan.
            </p>
          </div>
        )}

        {/* Terms Preview */}
        <div className="mt-4">
          <h4 className="text-sm font-semibold text-gray-900 mb-2">
            Terms & Conditions
          </h4>
          <div className="bg-white border rounded p-3">
            {termsToShow.length === 0 ? (
              <p className="text-sm text-gray-500">No terms attached</p>
            ) : (
              <ol className="list-decimal pl-5 text-sm text-gray-800 space-y-1">
                {termsToShow.map((line: any, idx: number) => (
                  <li key={idx}>{line}</li>
                ))}
              </ol>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
