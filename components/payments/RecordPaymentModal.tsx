"use client";

import { useState, useEffect, useMemo } from "react";
import Modal from "../invoices/Modal";
import LucideIcon from "../LucideIcon";
import {
  findOverdueLayawayInstallmentClient,
  isLateFeeConfigured,
} from "../../lib/late-fee-client";
import {
  getBusinessTodayString,
  formatBusinessDate,
} from "../../lib/business-date";
import { getUnitDiscountedRemaining } from "../../lib/unit-discount-client";
import type { UnitDiscountSettingSnapshot } from "../../lib/unit-discount-client";

interface PaymentMethodType {
  id: number;
  name: string;
  icon: string | null;
  color: string;
  isActive: boolean;
  isSystem: boolean;
  sortOrder: number;
}

interface CustomerOption {
  id: number;
  name: string;
  email?: string | null;
  storeCredit?: number;
}

interface RecordPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface Invoice {
  id: number;
  invoiceNumber: string;
  clientName: string;
  amount: number;
  paidAmount: number;
  status: string;
  customerId?: number | null;
  invoiceDate?: string;
  isLayaway?: boolean;
  items?: Array<{
    unit?: string | null;
    quantity?: number;
    price?: number;
  }> | null;
  unitDiscountAmount?: number;
  unitDiscountOffer?: unknown;
  customer?: {
    id: number;
    name: string;
    storeCredit?: number;
  } | null;
}

export default function RecordPaymentModal({
  isOpen,
  onClose,
  onSuccess,
}: RecordPaymentModalProps) {
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodType[]>([]);
  const [payment, setPayment] = useState({
    amount: "",
    methodId: "" as string,
    paymentDate: getBusinessTodayString(),
    notes: "",
    invoiceId: "",
    customerId: "" as string,
  });
  const [lateFeeSetting, setLateFeeSetting] = useState({
    amount: 0,
    isActive: false,
  });
  const [applyLateFee, setApplyLateFee] = useState(true);
  const [lateFeeWaivedReason, setLateFeeWaivedReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [unitDiscountSettings, setUnitDiscountSettings] = useState<
    UnitDiscountSettingSnapshot[]
  >([]);

  useEffect(() => {
    if (isOpen) {
      fetchCustomers();
      fetchPaymentMethods();
      fetch("/api/late-fee")
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data) {
            setLateFeeSetting({
              amount: Number(data.amount ?? 0),
              isActive: !!data.isActive,
            });
          }
        })
        .catch(() => {});
      fetch("/api/unit-discount")
        .then((res) => (res.ok ? res.json() : []))
        .then((data) => {
          setUnitDiscountSettings(Array.isArray(data) ? data : []);
        })
        .catch(() => {
          setUnitDiscountSettings([]);
        });
      setPayment({
        amount: "",
        methodId: "",
        paymentDate: getBusinessTodayString(),
        notes: "",
        invoiceId: "",
        customerId: "",
      });
      setCustomerSearch("");
      setShowCustomerDropdown(false);
      setInvoices([]);
      setApplyLateFee(true);
      setLateFeeWaivedReason("");
      setError("");
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    if (payment.customerId) {
      fetchInvoices(Number(payment.customerId));
    } else {
      setInvoices([]);
      setPayment((prev) =>
        prev.invoiceId ? { ...prev, invoiceId: "" } : prev,
      );
    }
  }, [isOpen, payment.customerId]);

  useEffect(() => {
    if (!isOpen || !payment.invoiceId) return;
    const inv = invoices.find((row) => row.id === parseInt(payment.invoiceId));
    if (!inv) return;
    const due = getUnitDiscountedRemaining({
      ...inv,
      paymentDate: payment.paymentDate,
      settings: unitDiscountSettings,
    });
    setPayment((prev) => ({ ...prev, amount: due.toFixed(2) }));
  }, [isOpen, payment.invoiceId, payment.paymentDate, invoices, unitDiscountSettings]);

  const fetchCustomers = async () => {
    try {
      const res = await fetch("/api/customers?all=true");
      if (res.ok) {
        setCustomers(await res.json());
      }
    } catch (err) {
      console.error("Failed to fetch customers:", err);
    }
  };

  const fetchPaymentMethods = async () => {
    try {
      const res = await fetch("/api/payment-methods");
      if (res.ok) {
        const data = await res.json();
        const activeMethods = data.filter((m: PaymentMethodType) => m.isActive);
        setPaymentMethods(activeMethods);
        if (activeMethods.length > 0) {
          setPayment((prev) => ({
            ...prev,
            methodId: String(activeMethods[0].id),
          }));
        }
      }
    } catch (err) {
      console.error("Failed to fetch payment methods:", err);
    }
  };

  const fetchInvoices = async (customerId: number) => {
    try {
      const res = await fetch(`/api/invoices/unpaid?customerId=${customerId}`);
      if (res.ok) {
        const data = await res.json();
        setInvoices(Array.isArray(data) ? data : []);
      } else {
        setInvoices([]);
      }
    } catch (err) {
      console.error("Failed to fetch invoices:", err);
      setInvoices([]);
    }
  };

  const selectedCustomer = useMemo(
    () =>
      customers.find((c) => String(c.id) === payment.customerId) || null,
    [customers, payment.customerId],
  );

  const filteredCustomers = useMemo(() => {
    const q = customerSearch.trim().toLowerCase();
    if (!q) return customers.slice(0, 50);
    return customers
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.email || "").toLowerCase().includes(q),
      )
      .slice(0, 50);
  }, [customers, customerSearch]);

  const handleSubmit = async () => {
    if (!payment.customerId) {
      setError("Customer is required");
      return;
    }

    if (!payment.amount || parseFloat(payment.amount) <= 0) {
      setError("Please enter a valid amount");
      return;
    }

    if (shouldPromptLateFee && !applyLateFee && !lateFeeWaivedReason.trim()) {
      setError("Please provide a reason for waiving the late fee");
      return;
    }

    const amount = parseFloat(payment.amount);

    setIsSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          customerId: parseInt(payment.customerId),
          methodId: parseInt(payment.methodId),
          paymentDate: payment.paymentDate,
          notes: payment.notes || null,
          invoiceId: payment.invoiceId ? parseInt(payment.invoiceId) : null,
          lateFeeAmount:
            shouldPromptLateFee && applyLateFee ? lateFeeSetting.amount : 0,
          lateFeeWaivedReason:
            shouldPromptLateFee && !applyLateFee
              ? lateFeeWaivedReason.trim()
              : "",
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.storeCreditAdded > 0) {
          alert(
            `Payment recorded. $${Number(data.storeCreditAdded).toFixed(2)} saved as store credit.`,
          );
        }
        onSuccess();
        onClose();
      } else {
        const errorData = await res.json();
        setError(errorData.error || "Failed to record payment");
      }
    } catch (err) {
      console.error("Failed to record payment:", err);
      setError("Failed to record payment. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAmountBlur = () => {
    if (payment.amount) {
      const value = parseFloat(payment.amount);
      if (!isNaN(value)) {
        setPayment({ ...payment, amount: value.toFixed(2) });
      }
    }
  };

  const selectedInvoice = invoices.find(
    (inv) => inv.id === parseInt(payment.invoiceId),
  );
  const overdueInstallment =
    selectedInvoice && payment.paymentDate
      ? findOverdueLayawayInstallmentClient(
          selectedInvoice,
          payment.paymentDate,
        )
      : null;
  const shouldPromptLateFee =
    !!selectedInvoice &&
    !!overdueInstallment &&
    isLateFeeConfigured(lateFeeSetting);
  const remainingAmount = selectedInvoice
    ? getUnitDiscountedRemaining({
        ...selectedInvoice,
        paymentDate: payment.paymentDate,
        settings: unitDiscountSettings,
      })
    : 0;
  const grossRemaining = selectedInvoice
    ? selectedInvoice.amount - selectedInvoice.paidAmount
    : 0;
  const excessAmount =
    selectedInvoice && payment.amount
      ? Math.max(0, parseFloat(payment.amount || "0") - remainingAmount)
      : 0;
  const currentStoreCredit = Number(selectedCustomer?.storeCredit || 0);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Record New Payment"
      headerColor="blue"
    >
      <div className="space-y-6">
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start">
            <svg
              className="w-5 h-5 text-red-500 mr-2 mt-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Customer (required) */}
        <div className="relative">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Customer <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={
              selectedCustomer
                ? selectedCustomer.name
                : customerSearch
            }
            onChange={(e) => {
              setCustomerSearch(e.target.value);
              setShowCustomerDropdown(true);
              if (payment.customerId) {
                setPayment((prev) => ({
                  ...prev,
                  customerId: "",
                  invoiceId: "",
                }));
              }
            }}
            onFocus={() => setShowCustomerDropdown(true)}
            className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Search customer by name or email..."
            required
          />
          {selectedCustomer && (
            <button
              type="button"
              onClick={() => {
                setPayment((prev) => ({
                  ...prev,
                  customerId: "",
                  invoiceId: "",
                }));
                setCustomerSearch("");
                setShowCustomerDropdown(true);
              }}
              className="absolute right-3 top-9 text-xs text-blue-600 hover:text-blue-700"
            >
              Change
            </button>
          )}
          {showCustomerDropdown && !selectedCustomer && (
            <div className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg">
              {filteredCustomers.length === 0 ? (
                <p className="px-4 py-3 text-sm text-gray-500">
                  No customers found
                </p>
              ) : (
                filteredCustomers.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setPayment((prev) => ({
                        ...prev,
                        customerId: String(c.id),
                        invoiceId: "",
                      }));
                      setCustomerSearch(c.name);
                      setShowCustomerDropdown(false);
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-blue-50 text-sm text-gray-900 border-b border-gray-50 last:border-0"
                  >
                    <span className="font-medium">{c.name}</span>
                    {c.email && (
                      <div className="text-xs text-gray-500 mt-0.5">
                        {c.email}
                      </div>
                    )}
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* Invoice Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Invoice (Optional)
          </label>
          <select
            value={payment.invoiceId}
            onChange={(e) =>
              setPayment({ ...payment, invoiceId: e.target.value })
            }
            disabled={!payment.customerId}
            className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
          >
            <option value="">
              {payment.customerId
                ? "No invoice (standalone payment)"
                : "Select a customer first"}
            </option>
            {invoices.map((invoice) => {
              const due = getUnitDiscountedRemaining({
                ...invoice,
                paymentDate: payment.paymentDate,
                settings: unitDiscountSettings,
              });
              return (
                <option key={invoice.id} value={invoice.id}>
                  {invoice.invoiceNumber} - {invoice.clientName}
                  (Remaining: ${due.toFixed(2)})
                </option>
              );
            })}
          </select>
          {selectedInvoice && (
            <p className="text-sm text-gray-600 mt-1">
              Invoice total: ${selectedInvoice.amount.toFixed(2)} | Paid: $
              {selectedInvoice.paidAmount.toFixed(2)} |
              <span className="font-medium text-blue-600">
                Remaining:{" "}
                {grossRemaining - remainingAmount > 0.01 && (
                  <span className="line-through text-gray-400 mr-1 font-normal">
                    ${grossRemaining.toFixed(2)}
                  </span>
                )}
                ${remainingAmount.toFixed(2)}
              </span>
            </p>
          )}
          {selectedCustomer && (
            <p className="text-sm text-emerald-700 mt-1">
              Available Store Credit: ${currentStoreCredit.toFixed(2)}
            </p>
          )}
        </div>

        {/* Amount */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Payment Amount <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <span className="absolute left-4 top-2.5 text-gray-500 font-medium">
              $
            </span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={payment.amount}
              onChange={(e) =>
                setPayment({ ...payment, amount: e.target.value })
              }
              onBlur={handleAmountBlur}
              className="w-full border border-gray-300 rounded-lg pl-8 pr-4 py-2.5 text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="0.00"
              required
            />
          </div>
          {selectedInvoice && parseFloat(payment.amount) > remainingAmount && (
            <p className="text-sm text-emerald-700 mt-1 flex items-center">
              Excess ${excessAmount.toFixed(2)} will be saved as Store Credit
            </p>
          )}
        </div>

        {/* Payment Method */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Payment Method <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-2 gap-3">
            {paymentMethods.map((method) => (
              <button
                key={method.id}
                type="button"
                onClick={() =>
                  setPayment({ ...payment, methodId: String(method.id) })
                }
                className={`p-3 rounded-lg border-2 transition-all ${
                  payment.methodId === String(method.id)
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-gray-300 hover:border-gray-400 text-gray-700"
                }`}
              >
                {method.icon && (
                  <LucideIcon
                    name={method.icon}
                    fallback={method.name}
                    size={24}
                    className="mr-2"
                  />
                )}
                <span
                  className="font-medium"
                  style={{
                    color:
                      payment.methodId === String(method.id)
                        ? undefined
                        : method.color,
                  }}
                >
                  {method.name}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Payment Date */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Payment Date <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={payment.paymentDate}
            onChange={(e) =>
              setPayment({ ...payment, paymentDate: e.target.value })
            }
            max={getBusinessTodayString()}
            className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            required
          />
        </div>

        {shouldPromptLateFee && overdueInstallment && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-3">
            <div>
              <p className="text-sm font-semibold text-amber-900">
                Late fee required for overdue installment — adds to invoice
                total
              </p>
              <p className="text-xs text-amber-800 mt-1">
                {overdueInstallment.label} was due on{" "}
                {formatBusinessDate(overdueInstallment.dueDate)}. Admin late
                fee: ${lateFeeSetting.amount.toFixed(2)}
              </p>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setApplyLateFee(true)}
                className={`px-3 py-2 rounded-lg text-sm border ${
                  applyLateFee
                    ? "bg-amber-600 text-white border-amber-600"
                    : "bg-white text-amber-900 border-amber-200"
                }`}
              >
                Add to invoice total
              </button>
              <button
                type="button"
                onClick={() => setApplyLateFee(false)}
                className={`px-3 py-2 rounded-lg text-sm border ${
                  !applyLateFee
                    ? "bg-white text-amber-900 border-amber-500"
                    : "bg-white text-amber-900 border-amber-200"
                }`}
              >
                Waive late fee
              </button>
            </div>
            {!applyLateFee && (
              <div>
                <label className="block text-sm font-medium text-amber-900 mb-2">
                  Reason for waiving late fee
                </label>
                <textarea
                  value={lateFeeWaivedReason}
                  onChange={(e) => setLateFeeWaivedReason(e.target.value)}
                  className="w-full px-4 py-2 border border-amber-200 rounded-lg text-gray-900 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  rows={3}
                  placeholder="Explain why the late fee is not being charged"
                />
              </div>
            )}
          </div>
        )}

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Notes (Optional)
          </label>
          <textarea
            value={payment.notes}
            onChange={(e) => setPayment({ ...payment, notes: e.target.value })}
            rows={3}
            className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Add any additional notes about this payment..."
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={
              isSubmitting ||
              !payment.customerId ||
              (shouldPromptLateFee &&
                !applyLateFee &&
                !lateFeeWaivedReason.trim())
            }
            className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center"
          >
            {isSubmitting ? "Recording..." : "Record Payment"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
