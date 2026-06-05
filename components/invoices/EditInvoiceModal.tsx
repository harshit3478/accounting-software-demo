"use client";

import { useState, useEffect, useRef } from "react";
import {
  calculateLayawayFeeFromItems,
  DEFAULT_LAYAWAY_FEE_RATES,
  type LayawayFeeRate,
  normalizeLayawayFeeRates,
} from "../../lib/layaway-fees";
import {
  buildLayawayInstallmentSchedule,
  formatLayawayInstallmentDate,
} from "../../lib/layaway-installments";
import InvoiceItemsEditor from "./InvoiceItemsEditor";
import InvoiceSummary from "./InvoiceSummary";
import Modal from "./Modal";
import { InvoiceItem } from "./types";

interface CustomerOption {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
}

interface DueDateReasonOption {
  id: number;
  reason: string;
  isActive: boolean;
  sortOrder: number;
}

interface LiveTypeOption {
  id: number;
  name: string;
  country: string;
  isActive: boolean;
  sortOrder: number;
}

interface TermOption {
  id: number;
  title?: string | null;
  lines: string[];
  isDefault: boolean;
}

interface LayawayInstallment {
  id?: number;
  dueDate: string;
  amount: number;
  label: string;
  isPaid?: boolean;
  paidDate?: string | null;
  paidAmount?: number | null;
}

interface LayawayPlan {
  id?: number;
  months: number;
  paymentFrequency: "monthly" | "bi-weekly" | "weekly";
  downPayment: number;
  notes?: string | null;
  installments?: LayawayInstallment[];
}

interface Invoice {
  id: number;
  invoiceNumber: string;
  clientName: string;
  customerId?: number | null;
  customer?: {
    id: number;
    name: string;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
  } | null;
  items: InvoiceItem[] | null;
  subtotal: number;
  tax: number;
  discount: number;
  shippingFee?: number;
  insuranceAmount?: number;
  amount: number;
  paidAmount: number;
  invoiceDate?: string;
  dueDate: string;
  dueDateReason?: string | null;
  status: "paid" | "pending" | "overdue" | "partial" | "abandoned" | "inactive";
  isLayaway: boolean;
  createdAt: string;
  termsId?: number | null;
  termsSnapshot?: string[] | null;
  liveTypeId?: number | null;
  liveTypeSnapshot?: string | null;
  liveType?: LiveTypeOption | null;
  terms?: TermOption | null;
  layawayPlan?: LayawayPlan | null;
}

interface EditInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onError?: (message: string) => void;
  invoice: Invoice | null;
}

export default function EditInvoiceModal({
  isOpen,
  onClose,
  onSuccess,
  onError,
  invoice,
}: EditInvoiceModalProps) {
  const [clientName, setClientName] = useState("");
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const customerRef = useRef<HTMLDivElement>(null);
  const [customerAddress, setCustomerAddress] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [dueDateReason, setDueDateReason] = useState("");
  const [dueDateReasons, setDueDateReasons] = useState<DueDateReasonOption[]>(
    [],
  );
  const [liveTypes, setLiveTypes] = useState<LiveTypeOption[]>([]);
  const [selectedLiveTypeId, setSelectedLiveTypeId] = useState<number | "none">(
    "none",
  );
  const [items, setItems] = useState<InvoiceItem[]>([
    { name: "", quantity: 1, price: 0, unit: "grams" },
  ]);
  const [tax, setTax] = useState(0);
  const [taxType, setTaxType] = useState<"fixed" | "percentage">("fixed");
  const [discount, setDiscount] = useState(0);
  const [discountType, setDiscountType] = useState<"fixed" | "percentage">(
    "fixed",
  );
  const [shippingFee, setShippingFee] = useState(0);
  const [insuranceAmount, setInsuranceAmount] = useState(0);
  const [layawayFeeRates, setLayawayFeeRates] = useState<LayawayFeeRate[]>(
    DEFAULT_LAYAWAY_FEE_RATES,
  );
  const [isLayaway, setIsLayaway] = useState(false);
  const [layawayMonths, setLayawayMonths] = useState(3);
  const [layawayFrequency, setLayawayFrequency] = useState<
    "monthly" | "bi-weekly" | "weekly"
  >("monthly");
  const [layawayBasisUnit, setLayawayBasisUnit] = useState("grams");
  const [layawayDownPayment, setLayawayDownPayment] = useState(0);
  const [layawayNotes, setLayawayNotes] = useState("");
  const [recalculationFeeSetting, setRecalculationFeeSetting] = useState({
    amount: 0,
    isActive: false,
  });
  const [termsOptions, setTermsOptions] = useState<TermOption[]>([]);
  const [selectedTermsId, setSelectedTermsId] = useState<
    number | "custom" | "none"
  >("none");
  const [customTerms, setCustomTerms] = useState<string[]>([""]);
  const [isUpdating, setIsUpdating] = useState(false);
  const [invoiceDateError, setInvoiceDateError] = useState("");
  const [dateError, setDateError] = useState("");
  const [editReason, setEditReason] = useState("");
  const [showRecalculationFeeModal, setShowRecalculationFeeModal] =
    useState(false);
  const [selectedRecalculationFeeAction, setSelectedRecalculationFeeAction] =
    useState<"apply" | "skip" | null>(null);
  const [showRemovedDepositFeeModal, setShowRemovedDepositFeeModal] =
    useState(false);
  const [removedDepositFeeAction, setRemovedDepositFeeAction] = useState<
    "apply" | "skip" | null
  >(null);
  const [removedDepositFeeSkipReason, setRemovedDepositFeeSkipReason] =
    useState("");

  const paidAmount = Number(invoice?.paidAmount || 0);

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
        })
        .catch(() => setTermsOptions([]));

      fetch("/api/live-types?all=true")
        .then((res) => (res.ok ? res.json() : []))
        .then((data) => {
          const normalized: LiveTypeOption[] = Array.isArray(data)
            ? data.map((item: any) => ({
                id: item.id,
                name: item.name,
                country: item.country,
                isActive: !!item.isActive,
                sortOrder: Number(item.sortOrder || 0),
              }))
            : [];
          setLiveTypes(normalized);
        })
        .catch(() => setLiveTypes([]));

      fetch("/api/layaway-fees")
        .then((res) => (res.ok ? res.json() : []))
        .then((data) => {
          if (Array.isArray(data) && data.length > 0) {
            setLayawayFeeRates(normalizeLayawayFeeRates(data));
          }
        })
        .catch(() => {
          setLayawayFeeRates(DEFAULT_LAYAWAY_FEE_RATES);
        });

      fetch("/api/recalculation-fee")
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data) {
            setRecalculationFeeSetting({
              amount: Number(data.amount ?? data.ratePercent ?? 0),
              isActive: !!data.isActive,
            });
          }
        })
        .catch(() => {});

      try {
        const stored = localStorage.getItem("layaway-defaults");
        if (stored) {
          const defaults = JSON.parse(stored);
          if (defaults.basisUnit) setLayawayBasisUnit(defaults.basisUnit);
        }
      } catch {
        // ignore
      }
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

  const selectedCustomer = customerId
    ? customers.find((customer) => customer.id === customerId) || null
    : customers.find(
        (customer) =>
          customer.name.trim().toLowerCase() ===
          clientName.trim().toLowerCase(),
      ) || null;

  useEffect(() => {
    if (invoice && isOpen) {
      setClientName(invoice.clientName);
      setCustomerId(invoice.customerId || null);
      setCustomerAddress(invoice.customer?.address || "");
      setInvoiceDate(
        (invoice.invoiceDate || invoice.createdAt || "").split("T")[0] || "",
      );
      setDueDate(invoice.dueDate);
      setDueDateReason(invoice.dueDateReason || "");
      setItems(
        (
          invoice.items || [{ name: "", quantity: 1, price: 0, unit: "grams" }]
        ).map((item) => ({ ...item, unit: item.unit || "grams" })),
      );
      setTax(invoice.tax);
      setTaxType("fixed"); // Default to fixed, adjust based on your needs
      setDiscount(invoice.discount);
      setDiscountType("fixed");
      setShippingFee(Number(invoice.shippingFee || 0));
      setInsuranceAmount(Number(invoice.insuranceAmount || 0));
      setIsLayaway(invoice.isLayaway);
      setSelectedLiveTypeId(
        invoice.liveTypeId || invoice.liveType?.id || "none",
      );
      setLayawayMonths(invoice.layawayPlan?.months || 3);
      setLayawayFrequency(invoice.layawayPlan?.paymentFrequency || "monthly");
      setLayawayDownPayment(Number(invoice.layawayPlan?.downPayment || 0));
      setLayawayNotes(invoice.layawayPlan?.notes || "");
      if (invoice.terms?.id) {
        setSelectedTermsId(invoice.terms.id);
        setCustomTerms(
          invoice.terms.lines?.length ? invoice.terms.lines : [""],
        );
      } else if (
        Array.isArray(invoice.termsSnapshot) &&
        invoice.termsSnapshot.length > 0
      ) {
        setSelectedTermsId("custom");
        setCustomTerms(
          invoice.termsSnapshot.length > 0 ? invoice.termsSnapshot : [""],
        );
      } else {
        setSelectedTermsId("none");
        setCustomTerms([""]);
      }
      setEditReason("");
      setInvoiceDateError("");
      setDateError("");
      setShowRecalculationFeeModal(false);
      setSelectedRecalculationFeeAction(null);
      setShowRemovedDepositFeeModal(false);
      setRemovedDepositFeeAction(null);
      setRemovedDepositFeeSkipReason("");
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

  const calculateLayawayFeeAmount = () => {
    if (!isLayaway) return 0;
    return calculateLayawayFeeFromItems(
      items as any,
      layawayMonths || 3,
      layawayFeeRates,
      layawayBasisUnit,
    );
  };

  const calculateTotal = () => {
    return (
      calculateSubtotal() +
      calculateTaxAmount() -
      calculateDiscountAmount() +
      shippingFee +
      insuranceAmount +
      calculateLayawayFeeAmount()
    );
  };

  const getItemKey = (item: InvoiceItem) =>
    [
      item.name.trim().toLowerCase(),
      (item.unit || "").trim().toLowerCase(),
    ].join("|");

  const getRemovedDepositFeeItems = () => {
    const currentCounts = new Map<string, number>();
    for (const item of items) {
      const key = getItemKey(item);
      currentCounts.set(key, (currentCounts.get(key) || 0) + 1);
    }

    return (invoice?.items || []).filter((item) => {
      const key = getItemKey(item);
      const count = currentCounts.get(key) || 0;
      if (count > 0) {
        currentCounts.set(key, count - 1);
        return false;
      }
      return Number(item.depositFee || 0) > 0;
    });
  };

  const removedDepositFeeItems = getRemovedDepositFeeItems();
  const removedDepositFeeTotal = removedDepositFeeItems.reduce(
    (sum, item) => sum + Number(item.depositFee || 0),
    0,
  );
  const shouldOfferRemovedDepositFee = removedDepositFeeTotal > 0;

  const calculateRemainingBalance = () => {
    return Math.max(calculateTotal() - paidAmount, 0);
  };

  const hasLayawayReconfigurationChanged = Boolean(
    invoice?.isLayaway &&
      invoice?.layawayPlan &&
    (layawayMonths !== Number(invoice.layawayPlan?.months || 3) ||
      layawayFrequency !==
        (invoice.layawayPlan?.paymentFrequency || "monthly") ||
      layawayDownPayment !== Number(invoice.layawayPlan?.downPayment || 0) ||
      layawayNotes.trim() !== String(invoice.layawayPlan?.notes || "").trim()),
  );

  const shouldOfferRecalculationFee =
    hasLayawayReconfigurationChanged &&
    recalculationFeeSetting.isActive &&
    recalculationFeeSetting.amount > 0;

  const buildLayawayInstallments = () => {
    const remainingBalance = calculateRemainingBalance();
    const baseDate = invoiceDate ? new Date(invoiceDate) : new Date();
    if (Number.isNaN(baseDate.getTime())) {
      return [];
    }

    return buildLayawayInstallmentSchedule({
      invoiceDate: baseDate,
      frequency: layawayFrequency,
      months: layawayMonths,
      downPayment: layawayDownPayment,
      totalAmount: remainingBalance,
    }).map((installment) => ({
      dueDate: installment.dueDate.toISOString(),
      amount: installment.amount,
      label: installment.label,
      isPaid: false,
    }));
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

  const handleUpdateInvoice = async (
    recalculationFeeActionOverride?: "apply" | "skip",
    removedFeeActionOverride?: "apply" | "skip",
  ) => {
    if (!invoice || !clientName.trim() || !invoiceDate || !dueDate) {
      onError?.("Please fill in all required fields");
      return;
    }

    if (!validateInvoiceDate(invoiceDate)) {
      onError?.("Invalid invoice date");
      return;
    }

    if (!validateDate(dueDate)) {
      onError?.("Invalid due date");
      return;
    }

    if (requiresDueDateReason && !dueDateReason.trim()) {
      onError?.("Please provide reason for due date");
      return;
    }

    if (
      items.length === 0 ||
      items.some(
        (item) => !item.name.trim() || item.quantity <= 0 || item.price <= 0,
      )
    ) {
      onError?.("Please add at least one valid item");
      return;
    }

    if (!editReason.trim()) {
      onError?.("Please provide a reason for this edit");
      return;
    }

    if (
      selectedCustomer &&
      !selectedCustomer.address?.trim() &&
      !customerAddress.trim()
    ) {
      onError?.("Customer address is required for this client");
      return;
    }

    const effectiveRemovedDepositFeeAction =
      removedFeeActionOverride || removedDepositFeeAction;
    const effectiveRecalculationFeeAction =
      recalculationFeeActionOverride || selectedRecalculationFeeAction;

    if (
      shouldOfferRemovedDepositFee &&
      !effectiveRemovedDepositFeeAction
    ) {
      setShowRemovedDepositFeeModal(true);
      return;
    }

    if (
      shouldOfferRemovedDepositFee &&
      effectiveRemovedDepositFeeAction === "skip" &&
      !removedDepositFeeSkipReason.trim()
    ) {
      onError?.("Please provide reason for skipping removed item deposit fee");
      return;
    }

    if (
      shouldOfferRecalculationFee &&
      !effectiveRecalculationFeeAction
    ) {
      setShowRemovedDepositFeeModal(false);
      setShowRecalculationFeeModal(true);
      return;
    }

    setShowRecalculationFeeModal(false);
    setShowRemovedDepositFeeModal(false);
    setIsUpdating(true);
    try {
      const subtotal = calculateSubtotal();
      const selectedCustomTerms =
        selectedTermsId === "custom"
          ? customTerms
              .map((term) => term.trim())
              .filter(Boolean)
              .slice(0, 5)
          : [];
      const resolvedTermsId =
        selectedTermsId === "none" ||
        (selectedTermsId === "custom" && selectedCustomTerms.length === 0)
          ? null
          : selectedTermsId === "custom"
            ? undefined
            : selectedTermsId;

      const res = await fetch(`/api/invoices/${invoice.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientName,
          customerId: customerId || null,
          customerAddress: customerAddress.trim() || undefined,
          items,
          subtotal,
          tax: calculateTaxAmount(),
          discount: calculateDiscountAmount(),
          shippingFee,
          insuranceAmount,
          liveTypeId: selectedLiveTypeId === "none" ? null : selectedLiveTypeId,
          invoiceDate,
          dueDate,
          dueDateReason: requiresDueDateReason ? dueDateReason.trim() : null,
          isLayaway,
          layawayPlan: isLayaway
            ? {
                months: layawayMonths,
                paymentFrequency: layawayFrequency,
                downPayment: layawayDownPayment,
                notes: layawayNotes || null,
                installments: buildLayawayInstallments(),
              }
            : null,
          termsId: resolvedTermsId,
          newTerms:
            selectedCustomTerms.length > 0 ? selectedCustomTerms : undefined,
          editReason: editReason.trim(),
          recalculationFeeAction: shouldOfferRecalculationFee
            ? effectiveRecalculationFeeAction
            : "none",
          removedItemDepositFeeAction: shouldOfferRemovedDepositFee
            ? effectiveRemovedDepositFeeAction
            : "none",
          removedItemDepositFeeSkipReason:
            effectiveRemovedDepositFeeAction === "skip"
              ? removedDepositFeeSkipReason.trim()
              : undefined,
        }),
      });

      if (res.ok) {
        onSuccess();
        onClose();
        return { success: true };
      } else {
        const error = await res.json();
        onError?.(error.error || "Failed to update invoice");
        return {
          success: false,
          error: error.error || "Failed to update invoice",
        };
      }
    } catch (error) {
      console.error("Failed to update invoice:", error);
      onError?.("Failed to update invoice");
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
        onClick={() => handleUpdateInvoice()}
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
    <>
      <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Edit Invoice ${invoice.invoiceNumber}`}
      footer={footer}
      maxWidth="4xl"
      headerColor="blue"
    >
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-blue-700">
            Invoice Type
          </span>
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold ${
              isLayaway
                ? "bg-purple-100 text-purple-800"
                : "bg-emerald-100 text-emerald-800"
            }`}
          >
            {isLayaway ? "Layaway Invoice" : "Cash Invoice"}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
              Invoice Total
            </p>
            <p className="text-lg font-semibold text-gray-900">
              ${calculateTotal().toFixed(2)}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
              Already Paid
            </p>
            <p className="text-lg font-semibold text-emerald-700">
              ${paidAmount.toFixed(2)}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
              Remaining Balance
            </p>
            <p className="text-lg font-semibold text-blue-700">
              ${calculateRemainingBalance().toFixed(2)}
            </p>
          </div>
        </div>

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
              required
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
                        setCustomerAddress(c.address || "");
                        setShowCustomerDropdown(false);
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
                  required
                />
                <p className="text-xs text-amber-600 mt-1">
                  This customer record does not have an address yet.
                </p>
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
              required
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
              required
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

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Shipping Fee
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={shippingFee || ""}
                  onChange={(e) =>
                    setShippingFee(parseFloat(e.target.value) || 0)
                  }
                  onBlur={(e) => {
                    const val = parseFloat(e.target.value);
                    if (!isNaN(val)) {
                      setShippingFee(parseFloat(val.toFixed(2)));
                    }
                  }}
                  className="w-full px-4 py-2 border border-gray-300 text-gray-900 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Insurance
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={insuranceAmount || ""}
                  onChange={(e) =>
                    setInsuranceAmount(parseFloat(e.target.value) || 0)
                  }
                  onBlur={(e) => {
                    const val = parseFloat(e.target.value);
                    if (!isNaN(val)) {
                      setInsuranceAmount(parseFloat(val.toFixed(2)));
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

              {isLayaway && (
                <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg space-y-4">
                  <h4 className="text-sm font-semibold text-purple-900">
                    Layaway Plan Configuration
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                      placeholder="e.g. Flexible schedule approved"
                    />
                  </div>

                  <div className="rounded-lg border border-purple-200 bg-white p-3">
                    <p className="text-xs font-semibold text-purple-800 mb-2">
                      Installment Preview
                    </p>
                    <div className="space-y-1 text-xs text-gray-700 max-h-40 overflow-y-auto">
                      {buildLayawayInstallments()
                        .slice(0, 8)
                        .map((inst, idx) => (
                          <div
                            key={`${inst.label}-${idx}`}
                            className="flex justify-between gap-3"
                          >
                            <span>
                              {inst.label}
                              <span className="text-gray-500">
                                {" "}
                                ({formatLayawayInstallmentDate(inst.dueDate)})
                              </span>
                            </span>
                            <span className="font-medium">
                              ${inst.amount.toFixed(2)}
                            </span>
                          </div>
                        ))}
                      {buildLayawayInstallments().length > 8 && (
                        <p className="text-xs text-gray-500">
                          ... and {buildLayawayInstallments().length - 8} more
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg mb-4 space-y-3">
                <h4 className="text-sm font-semibold text-emerald-900">
                  Live Type
                </h4>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Select Live Type
                  </label>
                  <select
                    value={String(selectedLiveTypeId)}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === "none") {
                        setSelectedLiveTypeId("none");
                        return;
                      }
                      const parsed = parseInt(value, 10);
                      if (!Number.isNaN(parsed)) setSelectedLiveTypeId(parsed);
                    }}
                    className="w-full px-4 py-2 border border-gray-300 text-gray-900 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  >
                    <option value="none">No live type</option>
                    {liveTypes.map((liveType) => (
                      <option key={liveType.id} value={liveType.id}>
                        {liveType.name} ({liveType.country})
                      </option>
                    ))}
                  </select>
                </div>
                {selectedLiveTypeId !== "none" && (
                  <div className="rounded-lg border border-emerald-200 bg-white p-3 text-xs text-gray-700">
                    <p className="font-semibold text-emerald-900 mb-1">
                      Selected live type
                    </p>
                    <p>
                      {
                        liveTypes.find((item) => item.id === selectedLiveTypeId)
                          ?.name
                      }{" "}
                      (
                      {
                        liveTypes.find((item) => item.id === selectedLiveTypeId)
                          ?.country
                      }
                      )
                    </p>
                  </div>
                )}
              </div>

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
                      if (!Number.isNaN(parsed)) setSelectedTermsId(parsed);
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

                {selectedTermsId === "custom" && (
                  <div className="space-y-3">
                    <p className="text-xs text-gray-500">
                      Add up to 5 points for this invoice.
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
                    <div className="flex flex-wrap gap-2">
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
                          setCustomTerms(
                            customTerms.length > 1
                              ? customTerms.slice(0, -1)
                              : [""],
                          )
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
              layawayFee={calculateLayawayFeeAmount()}
              total={calculateTotal()}
            />

            {paidAmount > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                This invoice already has payments applied. Layaway calculations
                and the schedule preview use the remaining balance, not the full
                invoice total.
              </div>
            )}
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
      {showRecalculationFeeModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            aria-hidden="true"
            onClick={() => setShowRecalculationFeeModal(false)}
          />
          <div
            className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="recalculation-fee-title"
          >
            <h3
              id="recalculation-fee-title"
              className="text-xl font-bold text-gray-900"
            >
              Apply recalculation fee?
            </h3>
            <p className="mt-2 text-sm text-gray-600">
              This layaway invoice has paid installments and its configuration
              changed. You can add the configured recalculation fee to the
              invoice, or save the new schedule without adding the fee.
            </p>

            <div className="mt-4 rounded-xl border border-purple-200 bg-purple-50 p-4 text-sm text-gray-800">
              <div className="flex justify-between gap-4">
                <span>Duration</span>
                <span className="font-medium">
                  {invoice.layawayPlan?.months || 3} month(s) {"->"}{" "}
                  {layawayMonths} month(s)
                </span>
              </div>
              <div className="mt-2 flex justify-between gap-4">
                <span>Payment frequency</span>
                <span className="font-medium">
                  {invoice.layawayPlan?.paymentFrequency || "monthly"} {"->"}{" "}
                  {layawayFrequency}
                </span>
              </div>
              <div className="mt-2 flex justify-between gap-4">
                <span>Down payment</span>
                <span className="font-medium">
                  ${Number(invoice.layawayPlan?.downPayment || 0).toFixed(2)}{" "}
                  {"->"} ${layawayDownPayment.toFixed(2)}
                </span>
              </div>
              <div className="mt-3 flex justify-between border-t border-purple-200 pt-3">
                <span>Recalculation fee</span>
                <span className="font-semibold text-purple-800">
                  ${recalculationFeeSetting.amount.toFixed(2)}
                </span>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowRecalculationFeeModal(false)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                disabled={isUpdating}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedRecalculationFeeAction("skip");
                  handleUpdateInvoice("skip");
                }}
                className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-800 hover:bg-amber-100"
                disabled={isUpdating}
              >
                Leave without fee
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedRecalculationFeeAction("apply");
                  handleUpdateInvoice("apply");
                }}
                className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:bg-purple-300"
                disabled={isUpdating}
              >
                Apply fee and update
              </button>
            </div>
          </div>
        </div>
      )}
      {showRemovedDepositFeeModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            aria-hidden="true"
            onClick={() => setShowRemovedDepositFeeModal(false)}
          />
          <div
            className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="removed-deposit-fee-title"
          >
            <h3
              id="removed-deposit-fee-title"
              className="text-xl font-bold text-gray-900"
            >
              Apply removed item deposit fee?
            </h3>
            <p className="mt-2 text-sm text-gray-600">
              You removed item(s) that had deposit fees. You can retain those
              deposit fees by adding them to the invoice total, or skip the fee
              with a reason.
            </p>

            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-gray-800">
              <div className="space-y-2">
                {removedDepositFeeItems.map((item, index) => (
                  <div
                    key={`${item.name}-${index}`}
                    className="flex justify-between gap-4"
                  >
                    <span>
                      {item.name} ({Number(item.quantity || 0)}{" "}
                      {item.unit || "item"})
                    </span>
                    <span className="font-medium text-amber-800">
                      ${Number(item.depositFee || 0).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex justify-between border-t border-amber-200 pt-3 font-semibold">
                <span>Total removed deposit fee</span>
                <span className="text-amber-800">
                  ${removedDepositFeeTotal.toFixed(2)}
                </span>
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700">
                Reason when skipping fee
              </label>
              <textarea
                value={removedDepositFeeSkipReason}
                onChange={(e) => setRemovedDepositFeeSkipReason(e.target.value)}
                rows={2}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                placeholder="Why should this removed item deposit fee be skipped?"
              />
            </div>

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowRemovedDepositFeeModal(false)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                disabled={isUpdating}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!removedDepositFeeSkipReason.trim()) {
                    onError?.("Please provide reason for skipping deposit fee");
                    return;
                  }
                  setRemovedDepositFeeAction("skip");
                  handleUpdateInvoice(
                    undefined,
                    "skip",
                  );
                }}
                className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-800 hover:bg-amber-100"
                disabled={isUpdating}
              >
                Skip with reason
              </button>
              <button
                type="button"
                onClick={() => {
                  setRemovedDepositFeeAction("apply");
                  handleUpdateInvoice(
                    undefined,
                    "apply",
                  );
                }}
                className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:bg-amber-300"
                disabled={isUpdating}
              >
                Apply fee and update
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// Export the handler for external use
export { EditInvoiceModal };
