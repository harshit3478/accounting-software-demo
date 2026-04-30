"use client";

import { useState, useEffect, useRef } from "react";
import Modal from "./Modal";
import PreviewInvoiceModal from "./PreviewInvoiceModal";
import InvoiceItemsEditor from "./InvoiceItemsEditor";
import InvoiceSummary from "./InvoiceSummary";
import AddCustomerModal from "./AddCustomerModal";
import UpdateCustomerFieldsModal from "./UpdateCustomerFieldsModal";
import { InvoiceItem } from "./types";
import {
  calculateInsuranceAmount,
  DEFAULT_INSURANCE_BANDS,
  type InsuranceBand,
} from "../../lib/insurance";

interface CustomerOption {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
}

interface TermOption {
  id: number;
  title: string | null;
  lines: string[];
  isDefault: boolean;
}

interface ShippingFeeRule {
  id: number;
  name: string;
  minAmount: number | null;
  maxAmount: number | null;
  fee: number;
  isActive: boolean;
  sortOrder: number;
}

interface DueDateReasonOption {
  id: number;
  reason: string;
  isActive: boolean;
  sortOrder: number;
}

interface CreateInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onError?: (message: string) => void;
}

export default function CreateInvoiceModal({
  isOpen,
  onClose,
  onSuccess,
  onError,
}: CreateInvoiceModalProps) {
  const getTodayDateString = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const [clientName, setClientName] = useState("");
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [showNewCustomerForm, setShowNewCustomerForm] = useState(false);
  const [newCustomerData, setNewCustomerData] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
  });
  const [customerAddress, setCustomerAddress] = useState("");
  const [creatingCustomer, setCreatingCustomer] = useState(false);
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [showUpdateCustomerFieldsModal, setShowUpdateCustomerFieldsModal] =
    useState(false);
  const [pendingNewCustomerName, setPendingNewCustomerName] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(getTodayDateString());
  const [dueDate, setDueDate] = useState("");
  const [dueDateReason, setDueDateReason] = useState("");
  const [dueDateReasons, setDueDateReasons] = useState<DueDateReasonOption[]>(
    [],
  );
  const customerRef = useRef<HTMLDivElement>(null);

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

  // Load layaway defaults from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem("layaway-defaults");
      if (stored) {
        const defaults = JSON.parse(stored);
        if (defaults.defaultMonths) setLayawayMonths(defaults.defaultMonths);
        if (defaults.defaultFrequency)
          setLayawayFrequency(defaults.defaultFrequency);
      }
    } catch {
      // ignore
    }
  }, []);

  // Fetch customers for autocomplete
  useEffect(() => {
    fetch("/api/customers?all=true")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setCustomers(data))
      .catch(() => {});
  }, []);

  const selectedCustomer = customerId
    ? customers.find((customer) => customer.id === customerId) || null
    : customers.find(
        (customer) =>
          customer.name.trim().toLowerCase() ===
          clientName.trim().toLowerCase(),
      ) || null;

  useEffect(() => {
    if (!isOpen) return;

    fetch("/api/terms")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        const normalized: TermOption[] = Array.isArray(data)
          ? data.map((t: any) => ({
              id: t.id,
              title: t.title || null,
              lines: Array.isArray(t.lines) ? t.lines : [],
              isDefault: !!t.isDefault,
            }))
          : [];

        setTermsOptions(normalized);

        if (normalized.length === 0) {
          setSelectedTermsId("custom");
          return;
        }

        const defaultTerm = normalized.find((t) => t.isDefault);
        setSelectedTermsId(defaultTerm ? defaultTerm.id : normalized[0].id);
      })
      .catch(() => {
        setTermsOptions([]);
        setSelectedTermsId("custom");
      });

    fetch("/api/shipping-fee-rules?active=true")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        const rules: ShippingFeeRule[] = Array.isArray(data)
          ? data.map((r: any) => ({
              id: r.id,
              name: r.name,
              minAmount: r.minAmount == null ? null : Number(r.minAmount),
              maxAmount: r.maxAmount == null ? null : Number(r.maxAmount),
              fee: Number(r.fee || 0),
              isActive: !!r.isActive,
              sortOrder: Number(r.sortOrder || 0),
            }))
          : [];

        setShippingFeeRules(rules);

        const subtotal = calculateSubtotal();
        const matchingRule = rules.find((r) =>
          doesRuleMatchSubtotal(r, subtotal),
        );
        if (matchingRule) {
          setSelectedShippingFeeRuleId(matchingRule.id);
          setShippingFee(matchingRule.fee);
        } else {
          setSelectedShippingFeeRuleId("none");
          setShippingFee(0);
        }
        setIsShippingFeeManuallyOverridden(false);
      })
      .catch(() => {
        setShippingFeeRules([]);
        setSelectedShippingFeeRuleId("none");
        setShippingFee(0);
        setIsShippingFeeManuallyOverridden(false);
      });

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

    fetch("/api/insurance-rules")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        const rules: InsuranceBand[] = Array.isArray(data)
          ? data.map((rule: any) => ({
              maxValue: Number(rule.maxValue),
              clientShare: Number(rule.clientShare),
            }))
          : [];

        if (rules.length > 0) {
          setInsuranceBands(rules);
        }
      })
      .catch(() => {
        setInsuranceBands(DEFAULT_INSURANCE_BANDS);
      });
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
  const [layawayMonths, setLayawayMonths] = useState(3);
  const [layawayFrequency, setLayawayFrequency] = useState<
    "monthly" | "bi-weekly" | "weekly"
  >("monthly");
  const [layawayDownPayment, setLayawayDownPayment] = useState(0);
  const [layawayNotes, setLayawayNotes] = useState("");
  const [termsOptions, setTermsOptions] = useState<TermOption[]>([]);
  const [selectedTermsId, setSelectedTermsId] = useState<
    number | "custom" | "none"
  >("none");
  const [customTerms, setCustomTerms] = useState<string[]>([""]);
  const [shippingFeeRules, setShippingFeeRules] = useState<ShippingFeeRule[]>(
    [],
  );
  const [selectedShippingFeeRuleId, setSelectedShippingFeeRuleId] = useState<
    number | "none"
  >("none");
  const [shippingFee, setShippingFee] = useState(0);
  const [isShippingFeeManuallyOverridden, setIsShippingFeeManuallyOverridden] =
    useState(false);
  const [insuranceBands, setInsuranceBands] = useState<InsuranceBand[]>(
    DEFAULT_INSURANCE_BANDS,
  );
  const [useCustomInsuranceBase, setUseCustomInsuranceBase] = useState(false);
  const [insuranceBaseAmount, setInsuranceBaseAmount] = useState("");
  const [insuranceBaseError, setInsuranceBaseError] = useState("");
  const [insuranceAmount, setInsuranceAmount] = useState(0);
  const [isInsuranceManuallyOverridden, setIsInsuranceManuallyOverridden] =
    useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [invoiceDateError, setInvoiceDateError] = useState("");
  const [dateError, setDateError] = useState("");

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

  const calculatePreShippingTotal = () => {
    return (
      calculateSubtotal() + calculateTaxAmount() - calculateDiscountAmount()
    );
  };

  const calculateTotal = () => {
    return (
      calculateSubtotal() +
      calculateTaxAmount() -
      calculateDiscountAmount() +
      shippingFee +
      insuranceAmount
    );
  };

  const getInsuranceCalculationBase = () => {
    const preShippingTotal = calculatePreShippingTotal();
    if (!useCustomInsuranceBase) return preShippingTotal;

    const parsed = Number(insuranceBaseAmount);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return preShippingTotal;
    }

    return Math.min(parsed, preShippingTotal);
  };

  const doesRuleMatchSubtotal = (
    rule: ShippingFeeRule,
    amount: number,
  ): boolean => {
    if (rule.minAmount != null && amount < rule.minAmount) return false;
    if (rule.maxAmount != null && amount > rule.maxAmount) return false;
    return true;
  };

  useEffect(() => {
    if (!isOpen || shippingFeeRules.length === 0) return;

    const amount = calculatePreShippingTotal();
    const matchingRule = shippingFeeRules.find((r) =>
      doesRuleMatchSubtotal(r, amount),
    );

    setSelectedShippingFeeRuleId(matchingRule ? matchingRule.id : "none");

    // Auto-apply fee unless user has manually overridden it.
    if (!isShippingFeeManuallyOverridden) {
      setShippingFee(matchingRule ? matchingRule.fee : 0);
    }
  }, [
    isOpen,
    items,
    tax,
    taxType,
    discount,
    discountType,
    shippingFeeRules,
    isShippingFeeManuallyOverridden,
  ]);

  useEffect(() => {
    if (!isOpen || isInsuranceManuallyOverridden) return;
    const insuranceCalculationBase = getInsuranceCalculationBase();
    setInsuranceAmount(
      calculateInsuranceAmount(insuranceCalculationBase, insuranceBands),
    );
  }, [
    isOpen,
    items,
    tax,
    taxType,
    discount,
    discountType,
    insuranceBands,
    insuranceBaseAmount,
    useCustomInsuranceBase,
    isInsuranceManuallyOverridden,
  ]);

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

  const handleCreateNewCustomer = async () => {
    if (!newCustomerData.name.trim()) return;
    setCreatingCustomer(true);
    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newCustomerData),
      });
      if (res.ok) {
        const created = await res.json();
        setCustomers((prev:any) => [
          ...prev,
          {
            id: created.id,
            name: created.name,
            email: created.email,
            phone: created.phone,
          },
        ]);
        setClientName(created.name);
        setCustomerId(created.id);
        setCustomerAddress(created.address || "");
        setShowNewCustomerForm(false);
        setNewCustomerData({ name: "", email: "", phone: "", address: "" });
      } else {
        const err = await res.json();
        onError?.(err.error || "Failed to create customer");
      }
    } catch {
      onError?.("Failed to create customer");
    } finally {
      setCreatingCustomer(false);
    }
  };

  const handleAddCustomerSuccess = (customer: CustomerOption) => {
    // Add the new customer to the list
    setCustomers((prev) => [...prev, customer]);
    setClientName(customer.name);
    setCustomerId(customer.id);
    setCustomerAddress(customer.address || "");
    setShowAddCustomerModal(false);
    setPendingNewCustomerName("");
    // Continue with invoice creation
    setTimeout(() => {
      setShowPreview(true);
    }, 100);
  };

  const handleUpdateCustomerFieldsSuccess = (customer: CustomerOption) => {
    // Update the customer in the list
    setCustomers((prev) =>
      prev.map((c) => (c.id === customer.id ? customer : c)),
    );
    setCustomerAddress(customer.address || "");
    setShowUpdateCustomerFieldsModal(false);
    // Continue with invoice creation
    setTimeout(() => {
      setShowPreview(true);
    }, 100);
  };

  const resetForm = () => {
    setClientName("");
    setCustomerId(null);
    setCustomerAddress("");
    setInvoiceDate(getTodayDateString());
    setDueDate("");
    setDueDateReason("");
    setDueDateReasons([]);
    setItems([{ name: "", quantity: 1, price: 0 }]);
    setTax(0);
    setTaxType("fixed");
    setDiscount(0);
    setDiscountType("fixed");
    setIsLayaway(false);
    setLayawayMonths(3);
    setLayawayFrequency("monthly");
    setLayawayDownPayment(0);
    setLayawayNotes("");
    setSelectedTermsId("none");
    setCustomTerms([""]);
    setShippingFeeRules([]);
    setSelectedShippingFeeRuleId("none");
    setShippingFee(0);
    setIsShippingFeeManuallyOverridden(false);
    setInsuranceBands(DEFAULT_INSURANCE_BANDS);
    setUseCustomInsuranceBase(false);
    setInsuranceBaseAmount("");
    setInsuranceBaseError("");
    setInsuranceAmount(0);
    setIsInsuranceManuallyOverridden(false);
    setInvoiceDateError("");
    setDateError("");
    setShowNewCustomerForm(false);
    setNewCustomerData({ name: "", email: "", phone: "", address: "" });
  };

  const handleCreateInvoice = async () => {
    if (!clientName.trim() || !invoiceDate || !dueDate) {
      onError?.("Please fill in all required fields");
      return;
    }

    // Check if customer exists or needs to be created
    if (!customerId) {
      // Customer not selected - check if name matches an existing customer
      const existingCustomer = customers.find(
        (c) => c.name.toLowerCase() === clientName.toLowerCase(),
      );

      if (!existingCustomer) {
        // Customer doesn't exist - force user to create with mandatory email and address
        setPendingNewCustomerName(clientName);
        setShowAddCustomerModal(true);
        return;
      }

      // Customer exists but not selected - check for missing fields
      const missingFields: ("email" | "address")[] = [];
      if (!existingCustomer.email) missingFields.push("email");
      if (!existingCustomer.address) missingFields.push("address");

      if (missingFields.length > 0) {
        setCustomerId(existingCustomer.id);
        setCustomerAddress(existingCustomer.address || "");
        setShowUpdateCustomerFieldsModal(true);
        return;
      }
    } else {
      // Customer is selected - verify they have required fields
      const selectedCust = customers.find((c) => c.id === customerId);
      const missingFields: ("email" | "address")[] = [];
      if (selectedCust) {
        if (!selectedCust.email) missingFields.push("email");
        if (!selectedCust.address) missingFields.push("address");

        if (missingFields.length > 0) {
          setShowUpdateCustomerFieldsModal(true);
          return;
        }
      }
    }

    if (
      selectedCustomer &&
      !selectedCustomer.address?.trim() &&
      !customerAddress.trim()
    ) {
      onError?.("Customer address is required for this client");
      return;
    }

    if (!validateInvoiceDate(invoiceDate)) {
      return;
    }

    if (!validateDate(dueDate)) {
      return;
    }

    if (requiresDueDateReason && !dueDateReason.trim()) {
      onError?.("Please provide reason for due date");
      return;
    }

    if (useCustomInsuranceBase) {
      const parsedBase = Number(insuranceBaseAmount);
      const preShippingTotal = calculatePreShippingTotal();
      if (!Number.isFinite(parsedBase) || parsedBase <= 0) {
        setInsuranceBaseError(
          "Insurance applied-on amount must be greater than 0",
        );
        return;
      }

      if (parsedBase > preShippingTotal) {
        setInsuranceBaseError(
          "Insurance applied-on amount cannot exceed invoice value before shipping",
        );
        return;
      }

      setInsuranceBaseError("");
    }

    if (
      items.length === 0 ||
      items.some((item) => !item.name.trim() || item.price <= 0)
    ) {
      onError?.("Please add at least one valid item");
      return;
    }

    // Show preview instead of creating directly
    setShowPreview(true);
  };

  const handleConfirmCreate = async () => {
    setIsCreating(true);
    try {
      const subtotal = calculateSubtotal();

      const payload: any = {
        clientName,
        customerId: customerId || undefined,
        customerAddress: customerAddress.trim() || undefined,
        invoiceDate,
        dueDate,
        dueDateReason: requiresDueDateReason ? dueDateReason.trim() : null,
        items,
        subtotal,
        tax: calculateTaxAmount(),
        discount: calculateDiscountAmount(),
        shippingFee,
        insuranceAmount,
        insuranceBaseAmount: useCustomInsuranceBase
          ? Number(insuranceBaseAmount)
          : null,
        shippingFeeRuleId:
          selectedShippingFeeRuleId === "none"
            ? null
            : selectedShippingFeeRuleId,
        isLayaway,
        ...(isLayaway && {
          layawayPlan: {
            months: layawayMonths,
            paymentFrequency: layawayFrequency,
            downPayment: layawayDownPayment,
            notes: layawayNotes || undefined,
          },
        }),
      };

      if (selectedTermsId !== "custom" && selectedTermsId !== "none") {
        payload.termsId = selectedTermsId;
      } else if (
        customTerms &&
        customTerms.filter((t) => t.trim()).length > 0
      ) {
        payload.newTerms = customTerms.filter((t) => t.trim()).slice(0, 5);
      }

      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        resetForm();
        setShowPreview(false);
        onClose();
        onSuccess();
      } else {
        const error = await res.json();
        onError?.(error.error || "Failed to create invoice");
      }
    } catch (error) {
      console.error("Failed to create invoice:", error);
      onError?.("Failed to create invoice");
    } finally {
      setIsCreating(false);
    }
  };

  const handleClose = () => {
    if (!isCreating) {
      resetForm();
      onClose();
    }
  };

  const footer = (
    <div className="flex justify-end space-x-4">
      <button
        onClick={handleClose}
        className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-100 transition-colors"
        disabled={isCreating}
      >
        Cancel
      </button>
      <button
        onClick={handleCreateInvoice}
        disabled={isCreating}
        className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:bg-blue-400 disabled:cursor-not-allowed flex items-center"
      >
        {isCreating ? (
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
          "Preview & Create"
        )}
      </button>
    </div>
  );

  return (
    <>
      <Modal
        isOpen={isOpen && !showPreview}
        onClose={handleClose}
        title="Create New Invoice"
        footer={footer}
        maxWidth="4xl"
      >
        <div className="space-y-6">
          {/* Terms selection */}

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
                  setCustomerAddress("");
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
                          const missingFields: ("email" | "address")[] = [];
                          if (!c.email) missingFields.push("email");
                          if (!c.address) missingFields.push("address");

                          setClientName(c.name);
                          setCustomerId(c.id);
                          setCustomerAddress(c.address || "");
                          setShowCustomerDropdown(false);

                          // If customer is missing required fields, show update modal
                          if (missingFields.length > 0) {
                            setShowUpdateCustomerFieldsModal(true);
                          }
                        }}
                        className="w-full text-left px-4 py-2 hover:bg-blue-50 text-sm text-gray-900 border-b border-gray-50 last:border-0"
                      >
                        <span className="font-medium">{c.name}</span>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {c.address ? c.address : "Address missing"}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              {customerId && (
                <p className="text-xs text-green-600 mt-1">
                  Linked to existing customer
                </p>
              )}
              {selectedCustomer && !selectedCustomer.address?.trim() && (
                <div className="mt-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Customer Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={customerAddress}
                    onChange={(e) => setCustomerAddress(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 text-gray-900 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter customer address"
                  />
                  <p className="text-xs text-amber-600 mt-1">
                    This customer record does not have an address yet.
                  </p>
                </div>
              )}
              {!customerId && !showNewCustomerForm && (
                <button
                  type="button"
                  onClick={() => {
                    setShowNewCustomerForm(true);
                    setNewCustomerData({
                      name: clientName,
                      email: "",
                      phone: "",
                      address: "",
                    });
                  }}
                  className="text-xs text-blue-600 hover:text-blue-700 mt-1 font-medium"
                >
                  + Create as new client
                </button>
              )}
              {showNewCustomerForm && (
                <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-xs font-semibold text-blue-700 mb-2">
                    New Client Details
                  </p>
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={newCustomerData.name}
                      onChange={(e) =>
                        setNewCustomerData({
                          ...newCustomerData,
                          name: e.target.value,
                        })
                      }
                      placeholder="Client name"
                      className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm text-gray-900"
                    />
                    <input
                      type="email"
                      value={newCustomerData.email}
                      onChange={(e) =>
                        setNewCustomerData({
                          ...newCustomerData,
                          email: e.target.value,
                        })
                      }
                      placeholder="Email (optional)"
                      className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm text-gray-900"
                    />
                    <input
                      type="text"
                      value={newCustomerData.phone}
                      onChange={(e) =>
                        setNewCustomerData({
                          ...newCustomerData,
                          phone: e.target.value,
                        })
                      }
                      placeholder="Phone (optional)"
                      className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm text-gray-900"
                    />
                    <input
                      type="text"
                      value={newCustomerData.address}
                      onChange={(e) =>
                        setNewCustomerData({
                          ...newCustomerData,
                          address: e.target.value,
                        })
                      }
                      placeholder="Address"
                      className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm text-gray-900"
                    />
                  </div>
                  <div className="flex gap-2 mt-2">
                    <button
                      type="button"
                      onClick={handleCreateNewCustomer}
                      disabled={
                        creatingCustomer || !newCustomerData.name.trim()
                      }
                      className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 disabled:opacity-50"
                    >
                      {creatingCustomer ? "Creating..." : "Save Client"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowNewCustomerForm(false)}
                      className="px-3 py-1 border border-gray-300 text-gray-600 text-xs rounded hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
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
                    onChange={(e) =>
                      setDiscount(parseFloat(e.target.value) || 0)
                    }
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

                <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-lg space-y-3">
                  <h4 className="text-sm font-semibold text-indigo-900">
                    Shipping Fee Rules
                  </h4>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Apply Rule
                    </label>
                    <select
                      value={String(selectedShippingFeeRuleId)}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === "none") {
                          setSelectedShippingFeeRuleId("none");
                          setIsShippingFeeManuallyOverridden(true);
                          return;
                        }
                        const parsed = parseInt(value, 10);
                        if (!Number.isNaN(parsed)) {
                          setSelectedShippingFeeRuleId(parsed);
                          const selectedRule = shippingFeeRules.find(
                            (r) => r.id === parsed,
                          );
                          if (selectedRule) {
                            setShippingFee(selectedRule.fee);
                          }
                          setIsShippingFeeManuallyOverridden(false);
                        }
                      }}
                      className="w-full px-3 py-2 border border-gray-300 text-gray-900 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      <option value="none">
                        No rule (manual shipping fee)
                      </option>
                      {shippingFeeRules.map((rule) => {
                        const rangeText =
                          rule.minAmount == null && rule.maxAmount == null
                            ? "All subtotals"
                            : rule.minAmount != null && rule.maxAmount == null
                              ? `>= $${rule.minAmount.toFixed(2)}`
                              : rule.minAmount == null && rule.maxAmount != null
                                ? `<= $${rule.maxAmount.toFixed(2)}`
                                : `$${(rule.minAmount as number).toFixed(2)} - $${(rule.maxAmount as number).toFixed(2)}`;

                        return (
                          <option key={rule.id} value={rule.id}>
                            {rule.name} ({rangeText}) - ${rule.fee.toFixed(2)}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Shipping Fee ($)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={shippingFee || ""}
                      onChange={(e) => {
                        setShippingFee(parseFloat(e.target.value) || 0);
                        setIsShippingFeeManuallyOverridden(true);
                      }}
                      className="w-full px-3 py-2 border border-gray-300 text-gray-900 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                    <p className="mt-1 text-xs text-gray-600">
                      You can override the fee manually even when a rule is
                      selected.
                    </p>
                    {isShippingFeeManuallyOverridden && (
                      <button
                        type="button"
                        onClick={() =>
                          setIsShippingFeeManuallyOverridden(false)
                        }
                        className="mt-2 text-xs font-medium text-indigo-700 hover:text-indigo-900"
                      >
                        Use Auto Rule
                      </button>
                    )}
                  </div>

                  <div className="pt-2 border-t border-indigo-200">
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-medium text-gray-700">
                        Insurance ($)
                      </label>
                      {!isInsuranceManuallyOverridden && (
                        <span className="text-[11px] text-indigo-700 font-medium">
                          Auto from invoice value
                        </span>
                      )}
                    </div>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={insuranceAmount || ""}
                      onChange={(e) => {
                        setInsuranceAmount(parseFloat(e.target.value) || 0);
                        setIsInsuranceManuallyOverridden(true);
                      }}
                      className="w-full px-3 py-2 border border-gray-300 text-gray-900 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                    <p className="mt-1 text-xs text-gray-600">
                      Insurance is auto-calculated from invoice value and can be
                      manually adjusted.
                    </p>
                    {isInsuranceManuallyOverridden && (
                      <button
                        type="button"
                        onClick={() => setIsInsuranceManuallyOverridden(false)}
                        className="mt-2 text-xs font-medium text-indigo-700 hover:text-indigo-900"
                      >
                        Use Auto Insurance
                      </button>
                    )}

                    <div className="mt-3 border-t border-indigo-200 pt-3">
                      <div className="flex items-center gap-2 mb-2">
                        <input
                          id="useCustomInsuranceBase"
                          type="checkbox"
                          checked={useCustomInsuranceBase}
                          onChange={(e) => {
                            setUseCustomInsuranceBase(e.target.checked);
                            setInsuranceBaseError("");
                            if (!e.target.checked) {
                              setInsuranceBaseAmount("");
                            }
                          }}
                          className="w-4 h-4 text-indigo-600 rounded"
                        />
                        <label
                          htmlFor="useCustomInsuranceBase"
                          className="text-xs font-medium text-gray-700"
                        >
                          Apply insurance on custom amount
                        </label>
                      </div>

                      {useCustomInsuranceBase && (
                        <>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Insurance Applied On Amount ($)
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={insuranceBaseAmount}
                            onChange={(e) => {
                              setInsuranceBaseAmount(e.target.value);
                              setInsuranceBaseError("");
                            }}
                            className="w-full px-3 py-2 border border-gray-300 text-gray-900 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            placeholder="e.g. 500.00"
                          />
                          {insuranceBaseError && (
                            <p className="mt-1 text-xs text-red-600">
                              {insuranceBaseError}
                            </p>
                          )}
                          <p className="mt-1 text-xs text-gray-600">
                            Current invoice value before shipping: $
                            {calculatePreShippingTotal().toFixed(2)}
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Layaway Checkbox */}
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="isLayaway"
                    checked={isLayaway}
                    onChange={(e) => setIsLayaway(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 mr-2"
                  />
                  <label
                    htmlFor="isLayaway"
                    className="text-sm font-medium text-gray-700"
                  >
                    Mark as Layaway (Installment Payment Plan)
                  </label>
                </div>

                {/* Layaway Plan Configuration */}
                {isLayaway && (
                  <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg space-y-4">
                    <h4 className="text-sm font-semibold text-purple-900 flex items-center gap-2">
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                      Layaway Plan Configuration
                    </h4>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Duration (months)
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="24"
                          value={layawayMonths}
                          onChange={(e) =>
                            setLayawayMonths(
                              Math.min(
                                24,
                                Math.max(1, parseInt(e.target.value) || 1),
                              ),
                            )
                          }
                          className="w-full px-3 py-2 border border-gray-300 text-gray-900 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Payment Frequency
                        </label>
                        <select
                          value={layawayFrequency}
                          onChange={(e) =>
                            setLayawayFrequency(
                              e.target.value as
                                | "monthly"
                                | "bi-weekly"
                                | "weekly",
                            )
                          }
                          className="w-full px-3 py-2 border border-gray-300 text-gray-900 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                        >
                          <option value="monthly">Monthly</option>
                          <option value="bi-weekly">Bi-Weekly</option>
                          <option value="weekly">Weekly</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Down Payment ($)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={layawayDownPayment || ""}
                        onChange={(e) =>
                          setLayawayDownPayment(parseFloat(e.target.value) || 0)
                        }
                        className="w-full px-3 py-2 border border-gray-300 text-gray-900 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                        placeholder="0.00"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Notes (optional)
                      </label>
                      <input
                        type="text"
                        value={layawayNotes}
                        onChange={(e) => setLayawayNotes(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 text-gray-900 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                        placeholder="e.g. Customer agreed to flexible schedule"
                      />
                    </div>

                    {/* Installment Preview */}
                    {calculateTotal() > 0 && (
                      <div className="mt-3 pt-3 border-t border-purple-200">
                        <h5 className="text-xs font-semibold text-purple-800 mb-2">
                          Installment Preview
                        </h5>
                        <div className="space-y-1 max-h-40 overflow-y-auto">
                          {(() => {
                            const total = calculateTotal();
                            const dp = Math.min(layawayDownPayment, total);
                            const remaining = total - dp;

                            let numInstallments: number;
                            if (layawayFrequency === "monthly")
                              numInstallments = layawayMonths;
                            else if (layawayFrequency === "bi-weekly")
                              numInstallments = layawayMonths * 2;
                            else numInstallments = layawayMonths * 4;

                            const installmentAmount =
                              numInstallments > 0
                                ? remaining / numInstallments
                                : 0;
                            const preview: { label: string; amount: number }[] =
                              [];

                            if (dp > 0)
                              preview.push({
                                label: "Down Payment",
                                amount: dp,
                              });
                            for (
                              let i = 1;
                              i <= Math.min(numInstallments, 12);
                              i++
                            ) {
                              const suffix =
                                i === 1
                                  ? "st"
                                  : i === 2
                                    ? "nd"
                                    : i === 3
                                      ? "rd"
                                      : "th";
                              preview.push({
                                label: `${i}${suffix} Payment`,
                                amount: installmentAmount,
                              });
                            }
                            if (numInstallments > 12) {
                              preview.push({
                                label: `... and ${numInstallments - 12} more`,
                                amount: installmentAmount,
                              });
                            }

                            return preview.map((item, idx) => (
                              <div
                                key={idx}
                                className="flex justify-between text-xs text-gray-700"
                              >
                                <span>{item.label}</span>
                                <span className="font-medium">
                                  ${item.amount.toFixed(2)}
                                </span>
                              </div>
                            ));
                          })()}
                        </div>
                        <div className="flex justify-between text-xs font-semibold text-purple-900 mt-2 pt-2 border-t border-purple-200">
                          <span>Total</span>
                          <span>${calculateTotal().toFixed(2)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="border-b border-gray-200 pb-4 mb-4">
                  <h4 className="text-sm font-semibold text-gray-900 mb-3">
                    Terms & Conditions
                  </h4>
                  <div className="mb-3">
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Select Terms Set
                    </label>
                    <select
                      value={String(selectedTermsId)}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === "custom" || value === "none") {
                          setSelectedTermsId(value);
                          return;
                        }
                        const parsed = parseInt(value, 10);
                        if (!Number.isNaN(parsed)) {
                          setSelectedTermsId(parsed);
                        }
                      }}
                      className="w-full px-4 py-2 border border-gray-300 text-gray-900 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      {termsOptions.map((term) => (
                        <option key={term.id} value={term.id}>
                          {term.title?.trim() || `Terms #${term.id}`}
                          {term.isDefault ? " (Default)" : ""}
                        </option>
                      ))}
                      <option value="custom">
                        Custom terms (for this invoice)
                      </option>
                      <option value="none">No terms</option>
                    </select>
                  </div>

                  {selectedTermsId !== "custom" &&
                    selectedTermsId !== "none" && (
                      <div className="mb-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
                        <p className="text-xs font-medium text-gray-700 mb-2">
                          Selected Terms Preview
                        </p>
                        {(
                          termsOptions.find((t) => t.id === selectedTermsId)
                            ?.lines || []
                        ).length === 0 ? (
                          <p className="text-xs text-gray-500">
                            No lines in selected terms.
                          </p>
                        ) : (
                          <ol className="list-decimal pl-5 text-xs text-gray-700 space-y-1">
                            {(
                              termsOptions.find((t) => t.id === selectedTermsId)
                                ?.lines || []
                            ).map((line, idx) => (
                              <li key={idx}>{line}</li>
                            ))}
                          </ol>
                        )}
                      </div>
                    )}

                  {selectedTermsId === "custom" && (
                    <div className="space-y-3">
                      <p className="text-xs text-gray-500">
                        Add up to 5 points. Non-empty lines will be saved and
                        attached to this invoice.
                      </p>
                      <div className="space-y-2">
                        {customTerms.map((term, idx) => (
                          <input
                            key={idx}
                            value={term}
                            onChange={(e) => {
                              const copy = [...customTerms];
                              copy[idx] = e.target.value;
                              setCustomTerms(copy);
                            }}
                            className="w-full px-4 py-2 border border-gray-300 text-gray-900 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder={`Term ${idx + 1}`}
                          />
                        ))}
                      </div>
                      <div className="flex space-x-2">
                        <button
                          type="button"
                          onClick={() => {
                            if (customTerms.length < 5)
                              setCustomTerms([...customTerms, ""]);
                          }}
                          className="px-3 py-1 bg-white border border-gray-200 rounded text-sm hover:bg-gray-50"
                        >
                          Add line
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setCustomTerms(customTerms.slice(0, -1))
                          }
                          className="px-3 py-1 bg-white border border-gray-200 rounded text-sm hover:bg-gray-50"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <InvoiceSummary
                subtotal={calculateSubtotal()}
                tax={tax}
                taxType={taxType}
                discount={discount}
                discountType={discountType}
                shippingFee={shippingFee}
                insuranceAmount={insuranceAmount}
                total={calculateTotal()}
              />
            </div>
          </div>
        </div>
      </Modal>

      <PreviewInvoiceModal
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
        onConfirm={handleConfirmCreate}
        clientName={clientName}
        invoiceDate={invoiceDate}
        dueDate={dueDate}
        dueDateReason={requiresDueDateReason ? dueDateReason : null}
        items={items}
        subtotal={calculateSubtotal()}
        tax={tax}
        taxType={taxType}
        discount={discount}
        discountType={discountType}
        shippingFee={shippingFee}
        insuranceAmount={insuranceAmount}
        insuranceBaseAmount={
          useCustomInsuranceBase ? Number(insuranceBaseAmount || 0) : null
        }
        total={calculateTotal()}
        isLayaway={isLayaway}
        isSubmitting={isCreating}
        useDefaultTerms={false}
        customTerms={
          selectedTermsId === "custom"
            ? customTerms.filter((t) => t.trim())
            : selectedTermsId !== "none"
              ? termsOptions.find((t) => t.id === selectedTermsId)?.lines || []
              : []
        }
      />

      <AddCustomerModal
        isOpen={showAddCustomerModal}
        onClose={() => {
          setShowAddCustomerModal(false);
          setPendingNewCustomerName("");
        }}
        onSuccess={handleAddCustomerSuccess}
        forceEmailAndAddress={true}
        defaultName={pendingNewCustomerName}
      />

      <UpdateCustomerFieldsModal
        isOpen={showUpdateCustomerFieldsModal}
        onClose={() => setShowUpdateCustomerFieldsModal(false)}
        onSuccess={handleUpdateCustomerFieldsSuccess}
        customer={
          customerId ? customers.find((c) => c.id === customerId) || null : null
        }
        missingFields={
          customerId
            ? (() => {
                const cust = customers.find((c) => c.id === customerId);
                const missing: ("email" | "address")[] = [];
                if (cust) {
                  if (!cust.email) missing.push("email");
                  if (!cust.address) missing.push("address");
                }
                return missing;
              })()
            : []
        }
      />
    </>
  );
}
