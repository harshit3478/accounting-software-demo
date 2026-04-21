"use client";

import { useState, useEffect, useRef } from "react";
import Modal from "./Modal";
import InvoiceItemsEditor from "./InvoiceItemsEditor";
import InvoiceSummary from "./InvoiceSummary";
import { InvoiceItem } from "./types";

interface CustomerOption {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
}

interface DueDateReasonOption {
  id: number;
  reason: string;
  isActive: boolean;
  sortOrder: number;
}

interface Invoice {
  id: number;
  invoiceNumber: string;
  clientName: string;
  customerId?: number | null;
  items: InvoiceItem[] | null;
  subtotal: number;
  tax: number;
  discount: number;
  amount: number;
  paidAmount: number;
  invoiceDate?: string;
  dueDate: string;
  dueDateReason?: string | null;
  status: "paid" | "pending" | "overdue" | "partial" | "abandoned" | "inactive";
  isLayaway: boolean;
  createdAt: string;
}

interface EditInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  invoice: Invoice | null;
}

export default function EditInvoiceModal({
  isOpen,
  onClose,
  onSuccess,
  invoice,
}: EditInvoiceModalProps) {
  const [clientName, setClientName] = useState("");
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const customerRef = useRef<HTMLDivElement>(null);
  const [invoiceDate, setInvoiceDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [dueDateReason, setDueDateReason] = useState("");
  const [dueDateReasons, setDueDateReasons] = useState<DueDateReasonOption[]>(
    [],
  );
  const [items, setItems] = useState<InvoiceItem[]>([
    { name: "", quantity: 1, price: 0 },
  ]);
  const [tax, setTax] = useState(0);
  const [taxType, setTaxType] = useState<"fixed" | "percentage">("fixed");
  const [discount, setDiscount] = useState(0);
  const [discountType, setDiscountType] = useState<"fixed" | "percentage">(
    "fixed",
  );
  const [isLayaway, setIsLayaway] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [invoiceDateError, setInvoiceDateError] = useState("");
  const [dateError, setDateError] = useState("");
  const [editReason, setEditReason] = useState("");

  const isBackDate = (selectedDate: string) => {
    if (!selectedDate) return false;

    const parsed = new Date(selectedDate);
    if (Number.isNaN(parsed.getTime())) return false;

    const selected = new Date(parsed);
    selected.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return selected < today;
  };

  const isFutureDate = (selectedDate: string) => {
    if (!selectedDate) return false;

    const parsed = new Date(selectedDate);
    if (Number.isNaN(parsed.getTime())) return false;

    const selected = new Date(parsed);
    selected.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return selected > today;
  };

  const requiresDueDateReason = isBackDate(dueDate);

  // Fetch customers for autocomplete
  useEffect(() => {
    if (isOpen) {
      fetch("/api/customers?all=true")
        .then((res) => (res.ok ? res.json() : []))
        .then((data) => setCustomers(data))
        .catch(() => {});

      fetch("/api/due-date-reasons?active=true")
        .then((res) => (res.ok ? res.json() : []))
        .then((data) => {
          const reasons: DueDateReasonOption[] = Array.isArray(data)
            ? data.map((r: any) => ({
                id: r.id,
                reason: r.reason,
                isActive: !!r.isActive,
                sortOrder: Number(r.sortOrder || 0),
              }))
            : [];
          setDueDateReasons(reasons);
        })
        .catch(() => {
          setDueDateReasons([]);
        });
    }
  }, [isOpen]);

  useEffect(() => {
    if (!requiresDueDateReason) {
      setDueDateReason("");
    }
  }, [requiresDueDateReason]);

  // Close dropdown on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        customerRef.current &&
        !customerRef.current.contains(e.target as Node)
      ) {
        setShowCustomerDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filteredCustomers = customers
    .filter((c) => c.name.toLowerCase().includes(clientName.toLowerCase()))
    .slice(0, 8);

  useEffect(() => {
    if (invoice && isOpen) {
      setClientName(invoice.clientName);
      setCustomerId(invoice.customerId || null);
      setInvoiceDate(
        (invoice.invoiceDate || invoice.createdAt || "").split("T")[0] || "",
      );
      setDueDate(invoice.dueDate);
      setDueDateReason(invoice.dueDateReason || "");
      setItems(invoice.items || [{ name: "", quantity: 1, price: 0 }]);
      setTax(invoice.tax);
      setTaxType("fixed"); // Default to fixed, adjust based on your needs
      setDiscount(invoice.discount);
      setDiscountType("fixed");
      setIsLayaway(invoice.isLayaway);
      setEditReason("");
      setInvoiceDateError("");
      setDateError("");
    }
  }, [invoice, isOpen]);

  const calculateSubtotal = () => {
    return items.reduce((sum, item) => sum + item.quantity * item.price, 0);
  };

  const calculateTaxAmount = () => {
    const subtotal = calculateSubtotal();
    return taxType === "percentage" ? (subtotal * tax) / 100 : tax;
  };

  const calculateDiscountAmount = () => {
    const subtotal = calculateSubtotal();
    return discountType === "percentage"
      ? (subtotal * discount) / 100
      : discount;
  };

  const calculateTotal = () => {
    return (
      calculateSubtotal() + calculateTaxAmount() - calculateDiscountAmount()
    );
  };

  const validateDate = (selectedDate: string) => {
    if (!selectedDate) {
      setDateError("Due date is required");
      return false;
    }
    setDateError("");
    return true;
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = e.target.value;
    setDueDate(newDate);
    validateDate(newDate);
  };

  const validateInvoiceDate = (selectedDate: string) => {
    if (!selectedDate) {
      setInvoiceDateError("Invoice date is required");
      return false;
    }
    if (isFutureDate(selectedDate)) {
      setInvoiceDateError("Invoice date cannot be in the future");
      return false;
    }
    setInvoiceDateError("");
    return true;
  };

  const handleInvoiceDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = e.target.value;
    setInvoiceDate(newDate);
    validateInvoiceDate(newDate);
  };

  const handleUpdateInvoice = async () => {
    if (!invoice || !clientName.trim() || !invoiceDate || !dueDate) {
      return { success: false, error: "Please fill in all required fields" };
    }

    if (!validateInvoiceDate(invoiceDate)) {
      return { success: false, error: "Invalid invoice date" };
    }

    if (!validateDate(dueDate)) {
      return { success: false, error: "Invalid due date" };
    }

    if (requiresDueDateReason && !dueDateReason.trim()) {
      return {
        success: false,
        error: "Please provide reason for due date",
      };
    }

    if (
      items.length === 0 ||
      items.some((item) => !item.name.trim() || item.price <= 0)
    ) {
      return { success: false, error: "Please add at least one valid item" };
    }

    if (!editReason.trim()) {
      return { success: false, error: "Please provide a reason for this edit" };
    }

    setIsUpdating(true);
    try {
      const subtotal = calculateSubtotal();

      const res = await fetch(`/api/invoices/${invoice.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientName,
          customerId: customerId || null,
          items,
          subtotal,
          tax: calculateTaxAmount(),
          discount: calculateDiscountAmount(),
          invoiceDate,
          dueDate,
          dueDateReason: requiresDueDateReason ? dueDateReason.trim() : null,
          isLayaway,
          editReason: editReason.trim(),
        }),
      });

      if (res.ok) {
        onSuccess();
        onClose();
        return { success: true };
      } else {
        const error = await res.json();
        return {
          success: false,
          error: error.error || "Failed to update invoice",
        };
      }
    } catch (error) {
      console.error("Failed to update invoice:", error);
      return { success: false, error: "Failed to update invoice" };
    } finally {
      setIsUpdating(false);
    }
  };

  const footer = (
    <div className="flex justify-end space-x-4">
      <button
        onClick={onClose}
        className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-100 transition-colors"
        disabled={isUpdating}
      >
        Cancel
      </button>
      <button
        onClick={handleUpdateInvoice}
        disabled={isUpdating}
        className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:bg-blue-400 disabled:cursor-not-allowed flex items-center"
      >
        {isUpdating ? (
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
            Updating...
          </>
        ) : (
          "Update Invoice"
        )}
      </button>
    </div>
  );

  if (!invoice) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Edit Invoice ${invoice.invoiceNumber}`}
      footer={footer}
      maxWidth="4xl"
      headerColor="blue"
    >
      <div className="space-y-6">
        {/* Client Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div ref={customerRef} className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Client Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={clientName}
              onChange={(e) => {
                setClientName(e.target.value);
                setCustomerId(null);
                setShowCustomerDropdown(true);
              }}
              onFocus={() => setShowCustomerDropdown(true)}
              className="w-full px-4 py-2 border border-gray-300 text-gray-900 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Search or enter client name"
            />
            {showCustomerDropdown &&
              clientName &&
              filteredCustomers.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {filteredCustomers.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setClientName(c.name);
                        setCustomerId(c.id);
                        setShowCustomerDropdown(false);
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-blue-50 text-sm text-gray-900 border-b border-gray-50 last:border-0"
                    >
                      <span className="font-medium">{c.name}</span>
                      {c.phone && (
                        <span className="text-gray-400 ml-2">{c.phone}</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            {customerId && (
              <p className="text-xs text-green-600 mt-1">
                Linked to existing customer
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Invoice Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={invoiceDate}
              onChange={handleInvoiceDateChange}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 ${
                invoiceDateError ? "border-red-500" : "border-gray-300"
              }`}
            />
            {invoiceDateError && (
              <p className="text-red-500 text-sm mt-1">{invoiceDateError}</p>
            )}

            <label className="block text-sm font-medium text-gray-700 mb-2">
              Due Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={handleDateChange}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 ${
                dateError ? "border-red-500" : "border-gray-300"
              }`}
            />
            {dateError && (
              <p className="text-red-500 text-sm mt-1">{dateError}</p>
            )}
            {requiresDueDateReason && (
              <>
                <label className="block text-sm font-medium text-gray-700 mt-4 mb-2">
                  Due Date Reason <span className="text-red-500">*</span>
                </label>
                <select
                  value={dueDateReason}
                  onChange={(e) => setDueDateReason(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 text-gray-900 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                >
                  <option value="">Select a reason</option>
                  {dueDateReasons.map((reason) => (
                    <option key={reason.id} value={reason.reason}>
                      {reason.reason}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Required only for back-dated due dates.
                </p>
              </>
            )}
          </div>
        </div>

        {/* Items Section */}
        <InvoiceItemsEditor items={items} onChange={setItems} />

        {/* Calculations */}
        <div className="border-t border-gray-200 pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              {/* Tax Section */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Tax
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setTaxType("fixed")}
                      className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                        taxType === "fixed"
                          ? "bg-blue-600 text-white"
                          : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                      }`}
                    >
                      $
                    </button>
                    <button
                      type="button"
                      onClick={() => setTaxType("percentage")}
                      className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                        taxType === "percentage"
                          ? "bg-blue-600 text-white"
                          : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                      }`}
                    >
                      %
                    </button>
                  </div>
                </div>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={tax || ""}
                  onChange={(e) => setTax(parseFloat(e.target.value) || 0)}
                  onBlur={(e) => {
                    const val = parseFloat(e.target.value);
                    if (!isNaN(val)) {
                      setTax(parseFloat(val.toFixed(2)));
                    }
                  }}
                  className="w-full px-4 py-2 border border-gray-300 text-gray-900 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="0.00"
                />
              </div>

              {/* Discount Section */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Discount
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setDiscountType("fixed")}
                      className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                        discountType === "fixed"
                          ? "bg-blue-600 text-white"
                          : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                      }`}
                    >
                      $
                    </button>
                    <button
                      type="button"
                      onClick={() => setDiscountType("percentage")}
                      className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                        discountType === "percentage"
                          ? "bg-blue-600 text-white"
                          : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                      }`}
                    >
                      %
                    </button>
                  </div>
                </div>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={discount || ""}
                  onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                  onBlur={(e) => {
                    const val = parseFloat(e.target.value);
                    if (!isNaN(val)) {
                      setDiscount(parseFloat(val.toFixed(2)));
                    }
                  }}
                  className="w-full px-4 py-2 border border-gray-300 text-gray-900 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="0.00"
                />
              </div>

              {/* Layaway Checkbox */}
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="editIsLayaway"
                  checked={isLayaway}
                  onChange={(e) => setIsLayaway(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 mr-2"
                />
                <label
                  htmlFor="editIsLayaway"
                  className="text-sm font-medium text-gray-700"
                >
                  Mark as Layaway (Installment Payment Plan)
                </label>
              </div>
            </div>

            <InvoiceSummary
              subtotal={calculateSubtotal()}
              tax={tax}
              taxType={taxType}
              discount={discount}
              discountType={discountType}
              total={calculateTotal()}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Reason for Edit <span className="text-red-500">*</span>
          </label>
          <textarea
            value={editReason}
            onChange={(e) => setEditReason(e.target.value)}
            rows={3}
            className="w-full px-4 py-2 border border-gray-300 text-gray-900 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Why are you editing this invoice?"
            required
          />
        </div>
      </div>
    </Modal>
  );
}

// Export the handler for external use
export { EditInvoiceModal };
