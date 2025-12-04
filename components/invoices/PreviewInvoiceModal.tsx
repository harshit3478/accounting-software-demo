"use client";

import Modal from "./Modal";
import { InvoiceItem } from "./types";
import { useEffect, useState } from "react";

interface PreviewInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  clientName: string;
  dueDate: string;
  items: InvoiceItem[];
  subtotal: number;
  tax: number;
  taxType: "fixed" | "percentage";
  discount: number;
  discountType: "fixed" | "percentage";
  total: number;
  isLayaway: boolean;
  isSubmitting?: boolean;
  useDefaultTerms?: boolean;
  customTerms?: string[];
}

export default function PreviewInvoiceModal({
  isOpen,
  onClose,
  onConfirm,
  clientName,
  dueDate,
  items,
  subtotal,
  tax,
  taxType,
  discount,
  discountType,
  total,
  isLayaway,
  isSubmitting = false,
  useDefaultTerms = true,
  customTerms = [],
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
        <div className="grid grid-cols-2 gap-4">
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
              Due Date
            </p>
            <p className="text-lg font-semibold text-gray-900 mt-1">
              {new Date(dueDate).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>
        </div>

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
                    Qty
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
                      {item.name}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right">
                      {item.quantity}
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
          <div className="border-t border-gray-300 pt-2 mt-2 flex justify-between">
            <span className="font-semibold text-gray-900">Total:</span>
            <span className="text-lg font-bold text-blue-600">
              ${total.toFixed(2)}
            </span>
          </div>
        </div>

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
