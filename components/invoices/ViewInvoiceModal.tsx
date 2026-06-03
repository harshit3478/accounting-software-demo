"use client";

import { useState, useEffect, useRef } from "react";
import LucideIcon from "../LucideIcon";
import Modal from "./Modal";
import { InvoiceItem } from "./types";
import { generateSingleInvoicePDF } from "../../lib/pdf-export";
import { exportElementAsJPEG } from "../../lib/image-export";
import InvoiceImageTemplate from "./InvoiceImageTemplate";
import {
  getInvoicePaymentsForPdf,
  getRecalculationFeeDisplayEntries,
  getRemovedItemDepositFeeDisplayEntries,
  getVisibleLayawayFee,
} from "../../lib/invoice-display";
import {
  buildLateFeeReason,
  findOverdueLayawayInstallmentClient,
} from "../../lib/late-fee-client";
import { formatPaymentCode } from "../../lib/payment-code";
import { formatUserDisplayName } from "../../lib/user-display";

interface Payment {
  id: number;
  amount: number;
  source?: string;
  paymentCode?: string;
  isRefund?: boolean;
  method:
    | {
        id: number;
        name: string;
        icon: string | null;
        color: string;
      }
    | string;
  date: string;
  notes: string | null;
  createdAt: string;
  createdBy?: string;
  type?: "direct" | "matched";
  matchId?: number;
}

interface PaymentMethodOption {
  id: number;
  name: string;
  icon: string | null;
  color: string;
  isActive: boolean;
}

interface UnmatchedPayment {
  id: number;
  amount: number;
  paymentDate: string;
  notes?: string | null;
  method?: string | { name: string };
  allocatedAmount?: number;
  remainingAmount?: number;
  paymentCode?: string;
}

interface LayawayInstallment {
  id: number;
  dueDate: string;
  amount: number;
  label: string;
  isPaid: boolean;
  paidDate?: string | null;
  paidAmount?: number | null;
  paymentId?: number | null;
}

interface LayawayPlan {
  id: number;
  months: number;
  paymentFrequency: string;
  downPayment: number;
  isCancelled: boolean;
  notes?: string | null;
  installments: LayawayInstallment[];
}

interface Invoice {
  id: number;
  invoiceNumber: string;
  clientName: string;
  items: InvoiceItem[] | null;
  subtotal: number;
  tax: number;
  discount: number;
  shippingFee?: number;
  insuranceAmount?: number;
  amount: number;
  paidAmount: number;
  dueDate: string;
  dueDateReason?: string | null;
  status: "paid" | "pending" | "overdue" | "partial" | "abandoned" | "inactive";
  isLayaway: boolean;
  createdAt: string;
  description?: string | null;
  termsId?: number | null;
  termsSnapshot?: string[] | null;
  liveTypeId?: number | null;
  liveTypeSnapshot?: string | null;
  liveType?: {
    id: number;
    name: string;
    country: string;
    isActive: boolean;
    sortOrder: number;
  } | null;
  terms?: {
    id: number;
    title?: string | null;
    lines: string[];
    isDefault: boolean;
  } | null;
  shipmentId?: string | null;
  trackingNumber?: string | null;
  externalInvoiceNumber?: string | null;
  customer?: {
    id: number;
    name: string;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
  } | null;
  layawayPlan?: LayawayPlan | null;
  editHistory?: Array<{
    id: number;
    reason: string;
    createdAt: string;
    changes?: Record<string, any> | null;
    editedBy?: {
      id: number;
      name: string;
      email?: string;
      displayName?: string;
    };
  }>;
}

interface ShipmentDetails {
  trackingNumber?: string | null;
  orderStatus?: string | null;
  carrier?: string | null;
  shippingService?: string | null;
  serviceCode?: string | null;
  liveTrackingUrl?: string | null;
  bookNumber?: string | null;
  orderId?: string | null;
  orderNumber?: string | null;
}

interface ViewInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: Invoice | null;
}

export default function ViewInvoiceModal({
  isOpen,
  onClose,
  invoice,
}: ViewInvoiceModalProps) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [abandonmentRefunds, setAbandonmentRefunds] = useState<Payment[]>([]);
  const [isLoadingPayments, setIsLoadingPayments] = useState(false);
  const [updatingInstallment, setUpdatingInstallment] = useState<number | null>(
    null,
  );
  const [localInstallments, setLocalInstallments] = useState<
    LayawayInstallment[]
  >([]);
  const [defaultTerms, setDefaultTerms] = useState<string[] | null>(null);
  const [shipmentDetails, setShipmentDetails] =
    useState<ShipmentDetails | null>(null);
  const [shipmentLoading, setShipmentLoading] = useState(false);
  const [shipmentError, setShipmentError] = useState<string | null>(null);
  const [localPaidAmount, setLocalPaidAmount] = useState(0);
  const [localInvoiceAmount, setLocalInvoiceAmount] = useState(
    Number(invoice?.amount || 0),
  );
  const [markPaidModalOpen, setMarkPaidModalOpen] = useState(false);
  const [selectedInstallment, setSelectedInstallment] =
    useState<LayawayInstallment | null>(null);
  const [markPaidMode, setMarkPaidMode] = useState<"create" | "link">("create");
  const [lateFeeSetting, setLateFeeSetting] = useState({
    amount: 0,
    isActive: false,
  });
  const [applyLateFee, setApplyLateFee] = useState<boolean | null>(null);
  const [lateFeeWaivedReason, setLateFeeWaivedReason] = useState("");
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodOption[]>(
    [],
  );
  const [selectedMethodId, setSelectedMethodId] = useState<number | null>(null);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentDate, setPaymentDate] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [unmatchedPayments, setUnmatchedPayments] = useState<
    UnmatchedPayment[]
  >([]);
  const [unmatchedPaymentSearch, setUnmatchedPaymentSearch] = useState("");
  const [selectedUnmatchedPaymentId, setSelectedUnmatchedPaymentId] = useState<
    number | null
  >(null);
  const [linkAmount, setLinkAmount] = useState(0);
  const [isSavingInstallmentPayment, setIsSavingInstallmentPayment] =
    useState(false);
  const [markPaidError, setMarkPaidError] = useState<string | null>(null);
  const [invoiceActionError, setInvoiceActionError] = useState<string | null>(
    null,
  );
  const [isSendingInvoice, setIsSendingInvoice] = useState(false);
  const [isMarkingSent, setIsMarkingSent] = useState(false);
  const [invoiceSentAt, setInvoiceSentAt] = useState<string | null>(null);
  const invoiceRef = useRef<HTMLDivElement>(null);
  const imageTemplateRef = useRef<HTMLDivElement>(null);

  // Fetch default terms once on mount
  useEffect(() => {
    fetch("/api/terms")
      .then((r) => r.json())
      .then((data: { id: number; lines: string[]; isDefault: boolean }[]) => {
        const def = data.find((t) => t.isDefault);
        if (def) setDefaultTerms(def.lines);
      })
      .catch(() => {});
  }, []);

  const mapPaymentForPdf = (p: Payment) => ({
    id: p.id,
    amount: p.amount,
    paymentDate: p.date || p.createdAt,
    method:
      typeof p.method === "object" ? p.method : { name: String(p.method) },
    source: p.source,
    isRefund: p.isRefund,
  });

  const buildPDFInvoice = () => ({
    ...invoice!,
    amount:
      invoice!.status === "abandoned" ? 0 : localInvoiceAmount,
    paidAmount: localPaidAmount,
    payments: getInvoicePaymentsForPdf({
      status: invoice!.status,
      payments: payments.map(mapPaymentForPdf),
      abandonmentRefunds: abandonmentRefunds.map(mapPaymentForPdf),
    }),
  });

  const handlePrintPDF = async () => {
    if (!invoice) return;
    // Open window synchronously (inside user gesture) before any await
    const w = window.open("about:blank", "_blank");
    await generateSingleInvoicePDF(buildPDFInvoice() as any, "print", w);
  };

  const handleDownloadPDF = async () => {
    if (!invoice) return;
    await generateSingleInvoicePDF(buildPDFInvoice() as any, "download");
  };

  const handleDownloadJPG = async () => {
    if (!imageTemplateRef.current) return;
    await exportElementAsJPEG(
      imageTemplateRef.current,
      `invoice-${invoice?.invoiceNumber}.jpg`,
    );
  };

  const resolveLatestSentAt = () => {
    if (!invoice?.editHistory?.length) return null;

    for (const entry of invoice.editHistory) {
      const sentAt = entry.changes?.sentAt?.to;
      if (typeof sentAt === "string" && sentAt.trim()) {
        return sentAt;
      }

      if (entry.reason?.toLowerCase().includes("sent")) {
        return entry.createdAt;
      }
    }

    return null;
  };

  const sendInvoiceToCustomer = async () => {
    if (!invoice) return;
    if (!invoice.customer?.email) {
      setInvoiceActionError("Customer email is required to send this invoice.");
      return;
    }

    setIsSendingInvoice(true);
    setInvoiceActionError(null);

    try {
      const res = await fetch(`/api/invoices/${invoice.id}/send`, {
        method: "POST",
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || "Failed to send invoice");
      }

      const data = await res.json();
      setInvoiceSentAt(data.sentAt || new Date().toISOString());
    } catch (error: any) {
      setInvoiceActionError(error.message || "Failed to send invoice");
    } finally {
      setIsSendingInvoice(false);
    }
  };

  const markInvoiceAsSent = async () => {
    if (!invoice) return;

    setIsMarkingSent(true);
    setInvoiceActionError(null);

    try {
      const res = await fetch(`/api/invoices/${invoice.id}/mark-sent`, {
        method: "POST",
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || "Failed to mark invoice as sent");
      }

      const data = await res.json();
      setInvoiceSentAt(data.sentAt || new Date().toISOString());
    } catch (error: any) {
      setInvoiceActionError(error.message || "Failed to mark invoice as sent");
    } finally {
      setIsMarkingSent(false);
    }
  };

  useEffect(() => {
    if (isOpen && invoice) {
      fetchPayments();
      setLocalPaidAmount(Number(invoice.paidAmount || 0));
      setLocalInvoiceAmount(Number(invoice.amount || 0));
      if (invoice.layawayPlan?.installments) {
        setLocalInstallments(invoice.layawayPlan.installments);
      }
      setInvoiceSentAt(resolveLatestSentAt());
      setInvoiceActionError(null);
      setApplyLateFee(null);
      setLateFeeWaivedReason("");

      fetch("/api/late-fee")
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data) {
            setLateFeeSetting({
              amount: Number(data.amount ?? 0),
              isActive: !!data.isActive,
            });
          }
        })
        .catch(() => {});

      if (invoice.shipmentId || invoice.trackingNumber) {
        setShipmentLoading(true);
        setShipmentError(null);
        fetch(`/api/xps/shipments?invoiceId=${invoice.id}`)
          .then(async (res) => {
            if (!res.ok) {
              throw new Error("Failed to fetch shipment details");
            }
            return res.json();
          })
          .then((data) => setShipmentDetails(data))
          .catch((err) => {
            setShipmentError(err.message || "Failed to fetch shipment details");
            setShipmentDetails(null);
          })
          .finally(() => setShipmentLoading(false));
      } else {
        setShipmentDetails(null);
        setShipmentError(null);
        setShipmentLoading(false);
      }
    }
  }, [isOpen, invoice]);

  const fetchLayawayPlan = async () => {
    if (!invoice || !invoice.isLayaway) return;

    try {
      const res = await fetch(`/api/invoices/${invoice.id}/layaway-plan`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.installments)) {
          setLocalInstallments(data.installments);
        }
      }
    } catch (error) {
      console.error("Failed to fetch layaway plan:", error);
    }
  };

  const openMarkPaidModal = async (installment: LayawayInstallment) => {
    if (!invoice) return;

    setSelectedInstallment(installment);
    setMarkPaidMode("create");
    setPaymentAmount(installment.amount);
    setLinkAmount(installment.amount);
    setPaymentDate(new Date().toISOString().split("T")[0]);
    setPaymentNotes(`Layaway installment payment: ${installment.label}`);
    setApplyLateFee(null);
    setLateFeeWaivedReason("");
    setSelectedUnmatchedPaymentId(null);
    setMarkPaidError(null);
    setMarkPaidModalOpen(true);

    try {
      const [methodRes, unmatchedRes] = await Promise.all([
        fetch("/api/payment-methods"),
        fetch("/api/payments/unmatched"),
      ]);

      if (methodRes.ok) {
        const methods: PaymentMethodOption[] = await methodRes.json();
        const activeMethods = methods.filter((method) => method.isActive);
        setPaymentMethods(activeMethods);
        if (activeMethods.length > 0) {
          setSelectedMethodId(activeMethods[0].id);
        }
      }

      if (unmatchedRes.ok) {
        const payload = await unmatchedRes.json();
        const list: UnmatchedPayment[] = Array.isArray(payload)
          ? payload
          : Array.isArray(payload.payments)
            ? payload.payments
            : [];
        setUnmatchedPayments(list);
      }
    } catch (error) {
      console.error("Failed to fetch mark-paid modal data:", error);
    }
  };

  const confirmInstallmentPaid = async () => {
    if (!invoice || !selectedInstallment) return;

    const overdueInstallment =
      paymentDate && selectedInstallment
        ? findOverdueLayawayInstallmentClient(invoice, paymentDate)
        : null;
    const shouldPromptLateFee =
      !!overdueInstallment &&
      lateFeeSetting.isActive &&
      lateFeeSetting.amount > 0;
    const lateFeeAmount =
      shouldPromptLateFee && applyLateFee === true ? lateFeeSetting.amount : 0;

    if (shouldPromptLateFee && applyLateFee === null) {
      setMarkPaidError("Please choose whether to apply or waive the late fee.");
      return;
    }

    if (
      shouldPromptLateFee &&
      applyLateFee === false &&
      !lateFeeWaivedReason.trim()
    ) {
      setMarkPaidError("Please provide a reason for waiving the late fee.");
      return;
    }

    setIsSavingInstallmentPayment(true);
    setMarkPaidError(null);

    try {
      if (markPaidMode === "create") {
        if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
          setMarkPaidError("Please enter a valid payment amount.");
          return;
        }

        if (!selectedMethodId) {
          setMarkPaidError("Payment method is required.");
          return;
        }

        const createRes = await fetch("/api/payments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            invoiceId: invoice.id,
            amount: paymentAmount,
            methodId: selectedMethodId,
            paymentDate,
            notes: paymentNotes || null,
            lateFeeAmount,
            lateFeeReason:
              shouldPromptLateFee &&
              applyLateFee === true &&
              overdueInstallment
                ? buildLateFeeReason(overdueInstallment)
                : "",
            lateFeeWaivedReason:
              shouldPromptLateFee && applyLateFee === false
                ? lateFeeWaivedReason.trim()
                : "",
          }),
        });

        if (!createRes.ok) {
          const data = await createRes.json();
          setMarkPaidError(data.error || "Failed to create payment.");
          return;
        }

        const createData = await createRes.json();
        const createdPaymentId = createData?.payment?.id;

        if (!createdPaymentId) {
          setMarkPaidError(
            "Payment was created but could not be linked to the installment.",
          );
          return;
        }

        await fetch(`/api/invoices/${invoice.id}/layaway-plan`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            installments: [
              {
                id: selectedInstallment.id,
                isPaid: true,
                paidDate: new Date().toISOString(),
                paidAmount: paymentAmount,
                paymentId: createdPaymentId,
              },
            ],
          }),
        });
      } else {
        if (!Number.isFinite(linkAmount) || linkAmount <= 0) {
          setMarkPaidError("Please enter a valid link amount.");
          return;
        }

        if (!selectedUnmatchedPaymentId) {
          setMarkPaidError("Please select a payment to link.");
          return;
        }

        const linkRes = await fetch("/api/payments/link", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            paymentId: selectedUnmatchedPaymentId,
            invoiceId: invoice.id,
            amount: linkAmount,
            lateFeeAmount,
            lateFeeReason:
              shouldPromptLateFee &&
              applyLateFee === true &&
              overdueInstallment
                ? buildLateFeeReason(overdueInstallment)
                : "",
            lateFeeWaivedReason:
              shouldPromptLateFee && applyLateFee === false
                ? lateFeeWaivedReason.trim()
                : "",
          }),
        });

        if (!linkRes.ok) {
          const data = await linkRes.json();
          setMarkPaidError(data.error || "Failed to link payment.");
          return;
        }

        await fetch(`/api/invoices/${invoice.id}/layaway-plan`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            installments: [
              {
                id: selectedInstallment.id,
                isPaid: true,
                paidDate: new Date().toISOString(),
                paidAmount: Math.min(linkAmount, selectedInstallment.amount),
                paymentId: selectedUnmatchedPaymentId,
              },
            ],
          }),
        });
      }

      await Promise.all([fetchPayments(), fetchLayawayPlan()]);
      if (lateFeeAmount > 0) {
        setLocalInvoiceAmount((prev) =>
          Number((prev + lateFeeAmount).toFixed(2)),
        );
      }
      setMarkPaidModalOpen(false);
      setSelectedInstallment(null);
      setMarkPaidError(null);
      setUnmatchedPaymentSearch("");
      setSelectedUnmatchedPaymentId(null);
    } catch (error) {
      console.error("Failed to mark installment paid:", error);
      setMarkPaidError("Failed to process installment payment.");
    } finally {
      setIsSavingInstallmentPayment(false);
    }
  };

  const unlinkInstallmentPayment = async (installment: LayawayInstallment) => {
    if (!invoice) return;
    setUpdatingInstallment(installment.id);
    try {
      const res = await fetch(`/api/invoices/${invoice.id}/layaway-plan`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          installments: [
            {
              id: installment.id,
              isPaid: false,
              paidDate: null,
              paidAmount: null,
              paymentId: null,
              unlinkPayment: true,
            },
          ],
        }),
      });
      if (res.ok) {
        setLocalInstallments((prev) =>
          prev.map((inst) =>
            inst.id === installment.id
              ? {
                  ...inst,
                  isPaid: false,
                  paidDate: null,
                  paidAmount: null,
                  paymentId: null,
                }
              : inst,
          ),
        );
        await Promise.all([fetchPayments(), fetchLayawayPlan()]);
      }
    } catch (error) {
      console.error("Failed to unlink installment payment:", error);
    } finally {
      setUpdatingInstallment(null);
    }
  };

  const fetchPayments = async () => {
    if (!invoice) return;

    setIsLoadingPayments(true);
    try {
      const res = await fetch(`/api/invoices/${invoice.id}/payments`);
      if (res.ok) {
        const data = await res.json();
        const paymentList: Payment[] = Array.isArray(data)
          ? data
          : data.payments || [];
        const refundList: Payment[] = Array.isArray(data)
          ? []
          : data.abandonmentRefunds || [];
        setPayments(paymentList);
        setAbandonmentRefunds(refundList);
        if (invoice.status === "abandoned") {
          setLocalPaidAmount(Number(invoice.paidAmount || 0));
        } else {
          const totalPaid = paymentList.reduce(
            (sum: number, payment: Payment) =>
              sum + Number(payment.amount || 0),
            0,
          );
          setLocalPaidAmount(totalPaid);
        }
      }
    } catch (error) {
      console.error("Failed to fetch payments:", error);
    } finally {
      setIsLoadingPayments(false);
    }
  };

  if (!invoice) return null;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const getStatusBadgeClass = (status: string) => {
    const classes = {
      paid: "bg-green-100 text-green-800",
      pending: "bg-amber-100 text-amber-800",
      overdue: "bg-red-100 text-red-800",
      partial: "bg-blue-100 text-blue-800",
      abandoned: "bg-orange-100 text-orange-800",
      inactive: "bg-gray-200 text-gray-600",
    };
    return (
      classes[status as keyof typeof classes] || "bg-gray-100 text-gray-800"
    );
  };

  const getPaymentMethodInfo = (method: Payment["method"]) => {
    if (typeof method === "object" && method !== null) {
      return { name: method.name, icon: method.icon, color: method.color };
    }
    // Fallback for legacy string method
    return { name: String(method), icon: null, color: "#6B7280" };
  };

  const getPaymentMethodIcon = (method: Payment["method"]) => {
    const info = getPaymentMethodInfo(method);
    if (info.icon) {
      return <LucideIcon name={info.icon} fallback={info.name} size={20} />;
    }
    return (
      <svg
        className="w-5 h-5"
        style={{ color: info.color }}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"
        />
      </svg>
    );
  };

  const trackedNumber =
    shipmentDetails?.trackingNumber || invoice.trackingNumber || null;
  const shipmentStatus =
    shipmentDetails?.orderStatus ||
    shipmentDetails?.shippingService ||
    shipmentDetails?.carrier ||
    (trackedNumber ? "In transit" : null);
  const trackingUrl =
    shipmentDetails?.liveTrackingUrl ||
    (trackedNumber
      ? `https://tools.usps.com/go/TrackConfirmAction?tLabels=${encodeURIComponent(trackedNumber)}`
      : null);
  const shippingFee = Number(invoice.shippingFee || 0);
  const insuranceAmount = Number(invoice.insuranceAmount || 0);
  const layawayFee = getVisibleLayawayFee(invoice);
  const currentItemDepositFeeTotal = (invoice.items || []).reduce(
    (sum, item) => sum + Number(item.depositFee || 0),
    0,
  );
  const removedItemDepositFeeEntries = getRemovedItemDepositFeeDisplayEntries(
    invoice.editHistory || [],
  );
  const invoiceDepositFeeTotal = currentItemDepositFeeTotal;
  const lateFeeTotal = payments.reduce(
    (sum, payment) =>
      payment.source === "late_fee" ? sum + Number(payment.amount || 0) : sum,
    0,
  );
  const lateFeePayments = payments.filter(
    (payment) => payment.source === "late_fee",
  );
  const depositFeePayments = payments.filter(
    (payment) => payment.source === "deposit_fee",
  );
  const depositFeeTotal = depositFeePayments.reduce(
    (sum, payment) => sum + Number(payment.amount || 0),
    0,
  );
  const restockingFeePayments = payments.filter(
    (payment) => payment.source === "restocking_fee",
  );
  const restockingFeeTotal = restockingFeePayments.reduce(
    (sum, payment) => sum + Number(payment.amount || 0),
    0,
  );
  const formatPaymentNumber = (payment: { paymentCode?: string; id: number }) =>
    payment.paymentCode || formatPaymentCode(payment.id);

  const abandonHistoryEntry = (invoice.editHistory || []).find(
    (entry) => entry.changes?.status?.to === "abandoned",
  );
  const historyFeePaymentCode = abandonHistoryEntry?.changes?.feePaymentCode
    ?.to as string | undefined;
  const historyFeeType = abandonHistoryEntry?.changes?.feeType?.to as
    | string
    | undefined;
  const historyRefundPaymentCodes = (
    (abandonHistoryEntry?.changes?.refundPaymentCodes?.to as string[]) || []
  ).filter(Boolean);

  const refundHistoryEntries = (invoice.editHistory || [])
    .map((entry) => ({
      id: entry.id,
      date: entry.createdAt,
      reason: entry.reason,
      proofUrl: entry.changes?.refundProof?.url as string | undefined,
      proofFileName: entry.changes?.refundProof?.fileName as string | undefined,
      refundPaymentCodes: (entry.changes?.refundPaymentCodes?.to as string[]) || [],
    }))
    .filter((entry) => !!entry.proofUrl);

  const displayedAbandonmentRefunds =
    abandonmentRefunds.length > 0
      ? abandonmentRefunds
      : historyRefundPaymentCodes.map((code, index) => ({
          id: index,
          amount: Number(abandonHistoryEntry?.changes?.movedAmount?.to || 0),
          paymentCode: code,
          date: abandonHistoryEntry?.createdAt || invoice.createdAt,
          notes: null,
          createdAt: abandonHistoryEntry?.createdAt || invoice.createdAt,
          method: { id: 0, name: "Refund", icon: null, color: "#EA580C" },
          isRefund: true,
        }));

  const abandonPaymentDisposition = abandonHistoryEntry?.changes
    ?.paymentDisposition?.to as string | undefined;
  const showRefundInHistory =
    abandonPaymentDisposition === "refund" ||
    displayedAbandonmentRefunds.length > 0;

  type PaymentHistoryRole =
    | "payment"
    | "refund"
    | "deposit_fee"
    | "restocking_fee";

  const paymentHistoryDisplay = (() => {
    if (invoice.status !== "abandoned") {
      return payments.map((payment) => ({
        payment,
        role: (payment.source === "deposit_fee"
          ? "deposit_fee"
          : payment.source === "restocking_fee"
            ? "restocking_fee"
            : "payment") as PaymentHistoryRole,
      }));
    }

    const rows: Array<{ payment: Payment; role: PaymentHistoryRole }> = [];

    if (showRefundInHistory) {
      for (const refundPayment of displayedAbandonmentRefunds) {
        rows.push({ payment: refundPayment, role: "refund" });
      }
    }

    for (const payment of payments) {
      if (payment.source === "deposit_fee") {
        rows.push({ payment, role: "deposit_fee" });
      } else if (payment.source === "restocking_fee") {
        rows.push({ payment, role: "restocking_fee" });
      }
    }

    const hasFeeRow = rows.some(
      (row) => row.role === "deposit_fee" || row.role === "restocking_fee",
    );
    if (!hasFeeRow && historyFeePaymentCode) {
      rows.push({
        payment: {
          id: Number(abandonHistoryEntry?.changes?.feePaymentId?.to || 0),
          amount: Number(abandonHistoryEntry?.changes?.feeAmount?.to || 0),
          paymentCode: historyFeePaymentCode,
          date: abandonHistoryEntry?.createdAt || invoice.createdAt,
          notes: null,
          createdAt: abandonHistoryEntry?.createdAt || invoice.createdAt,
          method: {
            id: 0,
            name:
              historyFeeType === "restocking" ? "Restocking Fee" : "Deposit Fee",
            icon: null,
            color: "#7C3AED",
          },
          source:
            historyFeeType === "restocking" ? "restocking_fee" : "deposit_fee",
        },
        role:
          historyFeeType === "restocking" ? "restocking_fee" : "deposit_fee",
      });
    }

    return rows.sort((a, b) => b.payment.id - a.payment.id);
  })();

  const getPaymentHistoryRoleLabel = (role: PaymentHistoryRole) => {
    switch (role) {
      case "refund":
        return "Refund";
      case "deposit_fee":
        return "Deposit Fee";
      case "restocking_fee":
        return "Restocking Fee";
      default:
        return "Payment";
    }
  };

  const getPaymentHistoryRoleBadgeClass = (role: PaymentHistoryRole) => {
    switch (role) {
      case "refund":
        return "bg-orange-100 text-orange-800";
      case "deposit_fee":
        return "bg-purple-100 text-purple-800";
      case "restocking_fee":
        return "bg-indigo-100 text-indigo-800";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const getAbandonHistoryPaymentSummary = (
    entry: NonNullable<Invoice["editHistory"]>[number],
  ) => {
    if (entry.changes?.status?.to !== "abandoned") return null;

    const parts: string[] = [];
    const disposition = entry.changes?.paymentDisposition?.to as
      | string
      | undefined;
    const refundCodes = (
      (entry.changes?.refundPaymentCodes?.to as string[]) || []
    ).filter(Boolean);
    const feeCode = entry.changes?.feePaymentCode?.to as string | undefined;
    const feeType = entry.changes?.feeType?.to as string | undefined;

    if (disposition === "refund" && refundCodes.length > 0) {
      parts.push(
        `Refund payment${refundCodes.length > 1 ? "s" : ""}: ${refundCodes.join(", ")}`,
      );
    }
    if (feeCode) {
      parts.push(
        `${feeType === "restocking" ? "Restocking fee" : "Deposit fee"} payment: ${feeCode}`,
      );
    }

    return parts.length > 0 ? parts.join(" · ") : null;
  };

  const recalculationFeeEntries = getRecalculationFeeDisplayEntries(
    invoice.editHistory || [],
  );
  const amountDue = Math.max(localInvoiceAmount - localPaidAmount, 0);
  const overdueInstallment =
    selectedInstallment && paymentDate
      ? findOverdueLayawayInstallmentClient(invoice, paymentDate)
      : null;
  const shouldPromptLateFee =
    !!overdueInstallment &&
    lateFeeSetting.isActive &&
    lateFeeSetting.amount > 0;
  const localStatus =
    invoice.status === "inactive" || invoice.status === "abandoned"
      ? invoice.status
      : amountDue <= 0
        ? "paid"
        : localPaidAmount > 0
          ? "partial"
          : new Date(invoice.dueDate) < new Date()
            ? "overdue"
            : "pending";

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Invoice ${invoice.invoiceNumber}`}
      maxWidth="5xl"
      headerColor="gray"
    >
      <div className="space-y-6">
        {/* Export buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={sendInvoiceToCustomer}
            disabled={isSendingInvoice || !invoice?.customer?.email}
            className="px-4 py-2 text-sm bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700 transition-colors flex items-center gap-2 disabled:bg-amber-300 disabled:cursor-not-allowed"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8m-18 8l6.5-4.33m11.5 4.33V6a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2z"
              />
            </svg>
            {isSendingInvoice ? "Sending..." : "Send Invoice"}
          </button>
          <button
            onClick={markInvoiceAsSent}
            disabled={isMarkingSent}
            className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors flex items-center gap-2 disabled:bg-emerald-300 disabled:cursor-not-allowed"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            {isMarkingSent ? "Marking..." : "Mark as Sent"}
          </button>
          <button
            onClick={handlePrintPDF}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
              />
            </svg>
            Print PDF
          </button>
          <button
            onClick={handleDownloadPDF}
            className="px-4 py-2 text-sm bg-blue-800 text-white rounded-lg font-medium hover:bg-blue-900 transition-colors flex items-center gap-2"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"
              />
            </svg>
            Download PDF
          </button>
          <button
            onClick={handleDownloadJPG}
            className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors flex items-center gap-2"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
            Download JPG
          </button>
        </div>

        <div ref={invoiceRef}>
          {invoiceActionError && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {invoiceActionError}
            </div>
          )}

          <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
            <span className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
              Invoice Type
            </span>
            <span
              className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold ${
                invoice.isLayaway
                  ? "bg-purple-100 text-purple-800"
                  : "bg-emerald-100 text-emerald-800"
              }`}
            >
              {invoice.isLayaway ? "Layaway Invoice" : "Cash Invoice"}
            </span>
            {invoiceSentAt && (
              <span className="inline-flex items-center rounded-full bg-sky-100 px-3 py-1 text-sm font-semibold text-sky-800">
                Sent {new Date(invoiceSentAt).toLocaleDateString()}
              </span>
            )}
          </div>

          {/* Invoice Header */}
          <div className="bg-gradient-to-r from-gray-50 to-gray-100 p-6 rounded-xl border border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                  Client Name
                </p>
                <p className="text-lg font-semibold text-gray-900">
                  {invoice.clientName}
                </p>
                {invoice.customer?.address && (
                  <p className="text-sm text-gray-600 mt-2 whitespace-pre-line">
                    {invoice.customer.address}
                  </p>
                )}
                {invoice.customer?.email && (
                  <p className="text-sm text-gray-600 mt-1">
                    {invoice.customer.email}
                  </p>
                )}
                {invoice.customer?.phone && (
                  <p className="text-sm text-gray-600 mt-1">
                    {invoice.customer.phone}
                  </p>
                )}
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                  Status
                </p>
                <span
                  className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusBadgeClass(localStatus)}`}
                >
                  {localStatus.charAt(0).toUpperCase() + localStatus.slice(1)}
                </span>
                {invoice.isLayaway && (
                  <span className="ml-2 inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-purple-100 text-purple-800">
                    Layaway
                  </span>
                )}
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                  Due Date
                </p>
                <p className="text-lg font-semibold text-gray-900">
                  {formatDate(invoice.dueDate)}
                </p>
                {invoice.dueDateReason && (
                  <p className="text-xs text-gray-600 mt-1">
                    Reason: {invoice.dueDateReason}
                  </p>
                )}
                {new Date(invoice.dueDate) < new Date() &&
                  localStatus !== "paid" && (
                    <p className="text-xs text-red-600 mt-1">Overdue</p>
                  )}
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-300 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                  Created On
                </p>
                <p className="text-sm text-gray-700">
                  {formatDate(invoice.createdAt)}
                </p>
              </div>
              {invoice.externalInvoiceNumber && (
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                    External Invoice #
                  </p>
                  <p className="text-sm font-mono text-gray-700">
                    {invoice.externalInvoiceNumber}
                  </p>
                </div>
              )}
              {(invoice.liveType?.name || invoice.liveTypeSnapshot) && (
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                    Live Type
                  </p>
                  <p className="text-sm font-medium text-gray-700">
                    {invoice.liveType
                      ? `${invoice.liveType.name} (${invoice.liveType.country})`
                      : invoice.liveTypeSnapshot}
                  </p>
                </div>
              )}
            </div>

            {(invoice.shipmentId || invoice.trackingNumber) && (
              <div className="mt-4 pt-4 border-t border-gray-300">
                <h5 className="text-sm font-medium text-gray-900 mb-2">
                  Shipment Tracking
                </h5>
                <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 space-y-3">
                  {shipmentLoading ? (
                    <p className="text-sm text-sky-700">
                      Loading live parcel status from XPS...
                    </p>
                  ) : shipmentError ? (
                    <p className="text-sm text-red-600">{shipmentError}</p>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <p className="text-xs text-gray-500 uppercase">
                            Tracking Number
                          </p>
                          <p className="font-mono text-sm font-semibold text-gray-800">
                            {trackedNumber || "Not generated yet"}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 uppercase">
                            Parcel Status
                          </p>
                          <p className="text-sm font-semibold text-gray-800">
                            {shipmentStatus || "Pending"}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 uppercase">
                            Shipment ID
                          </p>
                          <p className="font-mono text-sm text-gray-700">
                            {invoice.shipmentId ||
                              shipmentDetails?.bookNumber ||
                              shipmentDetails?.orderId ||
                              shipmentDetails?.orderNumber ||
                              "-"}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-3">
                        {trackingUrl && trackedNumber && (
                          <a
                            href={trackingUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center rounded-lg bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-700"
                          >
                            Track on USPS
                          </a>
                        )}
                        {shipmentDetails?.carrier && (
                          <span className="text-sm text-gray-600">
                            Carrier:{" "}
                            <span className="font-medium text-gray-900">
                              {shipmentDetails.carrier}
                            </span>
                          </span>
                        )}
                        {shipmentDetails?.shippingService && (
                          <span className="text-sm text-gray-600">
                            Service:{" "}
                            <span className="font-medium text-gray-900">
                              {shipmentDetails.shippingService}
                            </span>
                          </span>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Invoice Items */}
          {invoice.items && invoice.items.length > 0 && (
            <div>
              <h4 className="text-lg font-semibold text-gray-900 my-4">
                Invoice Items
              </h4>
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Item
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Qty / Unit
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Price
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {invoice.items.map((item, index) => (
                      <tr
                        key={index}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-4 py-3 text-sm text-gray-900">
                          <div className="font-medium">{item.name}</div>
                          {Number(item.depositFee || 0) > 0 && (
                            <div className="mt-1 text-xs text-amber-700">
                              Deposit fee:{" "}
                              {formatCurrency(Number(item.depositFee || 0))}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 text-right">
                          {item.quantity} {item.unit || "grams"}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 text-right">
                          {formatCurrency(item.price)}
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900 text-right">
                          {formatCurrency(item.quantity * item.price)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Financial Summary */}
          <div className="bg-blue-50 p-6 my-4 rounded-xl border border-blue-200">
            <h4 className="text-lg font-semibold text-gray-900 mb-4">
              Financial Summary
            </h4>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Subtotal:</span>
                <span className="font-medium text-gray-900">
                  {formatCurrency(invoice.subtotal)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Tax:</span>
                <span className="font-medium text-gray-900">
                  {formatCurrency(invoice.tax)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Discount:</span>
                <span className="font-medium text-red-600">
                  -{formatCurrency(invoice.discount)}
                </span>
              </div>
              {shippingFee > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Shipping Fee:</span>
                  <span className="font-medium text-gray-900">
                    {formatCurrency(shippingFee)}
                  </span>
                </div>
              )}
              {insuranceAmount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Insurance:</span>
                  <span className="font-medium text-gray-900">
                    {formatCurrency(insuranceAmount)}
                  </span>
                </div>
              )}
              {layawayFee > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Layaway Fee:</span>
                  <span className="font-medium text-gray-900">
                    {formatCurrency(layawayFee)}
                  </span>
                </div>
              )}
              {invoiceDepositFeeTotal > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Total Deposit Amount:</span>
                  <span className="font-medium text-amber-700">
                    {formatCurrency(invoiceDepositFeeTotal)}
                  </span>
                </div>
              )}
              {lateFeeTotal > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Late Fee:</span>
                  <span className="font-medium text-amber-700">
                    {formatCurrency(lateFeeTotal)}
                  </span>
                </div>
              )}
              {lateFeePayments.map((payment) => (
                <div
                  key={`late-fee-${payment.id}`}
                  className="flex justify-between gap-4 text-xs text-amber-700"
                >
                  <span>
                    {payment.notes || "Late fee applied"} (
                    {new Date(payment.date).toLocaleDateString()})
                  </span>
                  <span className="font-medium">
                    {formatCurrency(payment.amount)}
                  </span>
                </div>
              ))}
              {depositFeeTotal > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Deposit Fee:</span>
                  <span className="font-medium text-amber-700">
                    {formatCurrency(depositFeeTotal)}
                  </span>
                </div>
              )}
              {depositFeePayments.map((payment) => (
                <div
                  key={`deposit-fee-${payment.id}`}
                  className="flex justify-between gap-4 text-xs text-amber-700"
                >
                  <span>
                    {formatPaymentNumber(payment)} —{" "}
                    {payment.notes || "Deposit fee retained"} (
                    {new Date(payment.date).toLocaleDateString()})
                  </span>
                  <span className="font-medium">
                    {formatCurrency(payment.amount)}
                  </span>
                </div>
              ))}
              {removedItemDepositFeeEntries.map((entry) => (
                <div
                  key={`removed-deposit-fee-${entry?.id}`}
                  className="flex justify-between gap-4 text-xs text-amber-700"
                >
                  <span>
                    Removed item deposit fee{" "}
                    {entry.action === "skip"
                      ? `skipped: ${entry.reason}`
                      : `applied (${new Date(entry.date).toLocaleDateString()})`}
                  </span>
                  <span className="font-medium">
                    {formatCurrency(entry.amount)}
                  </span>
                </div>
              ))}
              {restockingFeeTotal > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Restocking Fee:</span>
                  <span className="font-medium text-orange-700">
                    {formatCurrency(restockingFeeTotal)}
                  </span>
                </div>
              )}
              {restockingFeePayments.map((payment) => (
                <div
                  key={`restocking-fee-${payment.id}`}
                  className="flex justify-between gap-4 text-xs text-orange-700"
                >
                  <span>
                    {formatPaymentNumber(payment)} —{" "}
                    {payment.notes || "Restocking fee retained"} (
                    {new Date(payment.date).toLocaleDateString()})
                  </span>
                  <span className="font-medium">
                    {formatCurrency(payment.amount)}
                  </span>
                </div>
              ))}
              {recalculationFeeEntries.map((entry) => (
                <div
                  key={`${entry.date}-${entry.label}`}
                  className="flex justify-between text-sm"
                >
                  <span className="text-gray-600">
                    {entry.label} ({new Date(entry.date).toLocaleDateString()})
                  </span>
                  <span className="font-medium text-violet-700">
                    {formatCurrency(entry.amount)}
                  </span>
                </div>
              ))}
              <div className="border-t border-blue-300 pt-3 flex justify-between">
                <span className="text-lg font-semibold text-gray-900">
                  Total Amount:
                </span>
                <span className="text-lg font-bold text-blue-600">
                  {formatCurrency(localInvoiceAmount)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Amount Paid:</span>
                <span className="font-medium text-green-600">
                  {formatCurrency(localPaidAmount)}
                </span>
              </div>
              {amountDue > 0 && (
                <div className="flex justify-between pt-2 border-t border-blue-200">
                  <span className="text-base font-semibold text-gray-900">
                    Remaining Balance:
                  </span>
                  <span className="text-base font-bold text-red-600">
                    {formatCurrency(amountDue)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Layaway Schedule */}
          {invoice.isLayaway && invoice.layawayPlan && (
            <div className="bg-purple-50 p-6 rounded-xl border border-purple-200">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-lg font-semibold text-gray-900">
                  Layaway Schedule
                </h4>
                {invoice.layawayPlan.isCancelled && (
                  <span className="px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
                    Cancelled
                  </span>
                )}
              </div>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div>
                  <p className="text-xs text-gray-500 uppercase">Duration</p>
                  <p className="text-sm font-medium text-gray-900">
                    {invoice.layawayPlan.months} month(s)
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase">Frequency</p>
                  <p className="text-sm font-medium text-gray-900 capitalize">
                    {invoice.layawayPlan.paymentFrequency}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase">
                    Down Payment
                  </p>
                  <p className="text-sm font-medium text-gray-900">
                    {formatCurrency(invoice.layawayPlan.downPayment)}
                  </p>
                </div>
              </div>
              {invoice.layawayPlan.notes && (
                <p className="text-sm text-gray-600 italic mb-4">
                  "{invoice.layawayPlan.notes}"
                </p>
              )}
              {invoice.status === "abandoned" ? (
                <p className="text-sm text-purple-800 bg-purple-100/60 rounded-lg px-3 py-2">
                  Layaway installments are closed for abandoned invoices. See
                  payment history below for refund or fee payments.
                </p>
              ) : (
                invoice.layawayPlan.installments.length > 0 && (
                  <div className="border border-purple-200 rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-purple-100 border-b border-purple-200">
                          <th className="px-4 py-2 text-left text-xs font-semibold text-purple-800 uppercase">
                            Label
                          </th>
                          <th className="px-4 py-2 text-right text-xs font-semibold text-purple-800 uppercase">
                            Due Date
                          </th>
                          <th className="px-4 py-2 text-right text-xs font-semibold text-purple-800 uppercase">
                            Amount
                          </th>
                          <th className="px-4 py-2 text-center text-xs font-semibold text-purple-800 uppercase">
                            Status
                          </th>
                          <th className="px-4 py-2 text-center text-xs font-semibold text-purple-800 uppercase w-[80px]">
                            Action
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-purple-100">
                        {localInstallments.map((inst) => (
                          <tr
                            key={inst.id}
                            className={inst.isPaid ? "bg-green-50/50" : ""}
                          >
                            <td className="px-4 py-2 text-sm text-gray-900">
                              {inst.label}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-900 text-right">
                              {formatDate(inst.dueDate)}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-900 text-right">
                              {formatCurrency(inst.amount)}
                            </td>
                            <td className="px-4 py-2 text-center">
                              {inst.isPaid ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                  Paid{" "}
                                  {inst.paidDate
                                    ? `on ${new Date(inst.paidDate).toLocaleDateString()}`
                                    : ""}
                                </span>
                              ) : (
                                <span
                                  className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                    new Date(inst.dueDate) < new Date()
                                      ? "bg-red-100 text-red-800"
                                      : "bg-amber-100 text-amber-800"
                                  }`}
                                >
                                  {new Date(inst.dueDate) < new Date()
                                    ? "Overdue"
                                    : "Pending"}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-2 text-center">
                              <button
                                onClick={() => {
                                  if (inst.isPaid) {
                                    unlinkInstallmentPayment(inst);
                                  } else {
                                    openMarkPaidModal(inst);
                                  }
                                }}
                                disabled={
                                  updatingInstallment === inst.id ||
                                  invoice.layawayPlan!.isCancelled
                                }
                                className={`text-xs px-2.5 py-1 rounded font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                                  inst.isPaid
                                    ? "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                    : "bg-green-600 text-white hover:bg-green-700"
                                }`}
                                title={
                                  inst.isPaid
                                    ? "Unlink payment"
                                    : "Mark as paid"
                                }
                              >
                                {updatingInstallment === inst.id ? (
                                  <svg
                                    className="animate-spin h-3.5 w-3.5 mx-auto"
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
                                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                                    ></path>
                                  </svg>
                                ) : inst.isPaid ? (
                                  "Unlink"
                                ) : (
                                  "Mark Paid"
                                )}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              )}
            </div>
          )}

          {/* Payment History */}
          <div>
            <div className="flex items-center justify-between my-4">
              <h4 className="text-lg font-semibold text-gray-900">
                Payment History
              </h4>
              {isLoadingPayments && (
                <div className="flex items-center text-sm text-gray-500">
                  <svg
                    className="animate-spin h-4 w-4 mr-2"
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
                  Loading...
                </div>
              )}
            </div>

            {paymentHistoryDisplay.length > 0 ? (
              <div className="space-y-3">
                {paymentHistoryDisplay.map(({ payment, role }) => (
                  <div
                    key={`${role}-${payment.id}-${payment.paymentCode}`}
                    className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3">
                        <div className="p-2 bg-gray-50 rounded-lg">
                          {role === "refund" ? (
                            <span className="text-orange-600 text-sm font-semibold">
                              RF
                            </span>
                          ) : (
                            getPaymentMethodIcon(payment.method)
                          )}
                        </div>
                        <div>
                          <div className="flex items-center flex-wrap gap-2">
                            <span className="text-xs font-mono font-semibold text-gray-700">
                              {formatPaymentNumber(payment)}
                            </span>
                            <span
                              className={`text-xs px-2 py-1 rounded font-medium ${getPaymentHistoryRoleBadgeClass(role)}`}
                            >
                              {getPaymentHistoryRoleLabel(role)}
                            </span>
                            <span className="font-semibold text-gray-900">
                              {formatCurrency(payment.amount)}
                            </span>
                            {role === "payment" && (
                              <span className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded">
                                {getPaymentMethodInfo(payment.method).name}
                              </span>
                            )}
                            {payment.type === "matched" && (
                              <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded font-medium">
                                Matched Payment
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 mt-1">
                            {formatDate(payment.date)}
                          </p>
                          {payment.createdBy && role !== "refund" && (
                            <p className="text-xs text-gray-500 mt-1">
                              Recorded by: {payment.createdBy}
                            </p>
                          )}
                          {payment.notes && (
                            <p className="text-sm text-gray-500 mt-2 italic">
                              "{payment.notes}"
                            </p>
                          )}
                        </div>
                      </div>
                      <span className="text-xs text-gray-400">
                        Recorded:{" "}
                        {new Date(payment.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                <svg
                  className="w-12 h-12 text-gray-400 mx-auto mb-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                  />
                </svg>
                <p className="text-gray-600 font-medium">
                  {invoice.status === "abandoned"
                    ? "No abandonment payments recorded"
                    : "No payments recorded yet"}
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  {invoice.status === "abandoned"
                    ? "Refund or fee payment numbers will appear here after abandoning"
                    : "Payments will appear here once recorded"}
                </p>
              </div>
            )}
          </div>

          <div>
            <h4 className="text-lg font-semibold text-gray-900 my-4">
              Edit History
            </h4>
            {refundHistoryEntries.length > 0 && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4">
                <h5 className="text-sm font-semibold text-red-800">
                  Refund History
                </h5>
                <div className="mt-3 space-y-3">
                  {refundHistoryEntries.map((entry) => (
                    <div
                      key={`refund-${entry.id}`}
                      className="rounded-md bg-white p-3 text-sm"
                    >
                      <p className="font-medium text-red-800">
                        {new Date(entry.date).toLocaleString()}
                      </p>
                      {entry.refundPaymentCodes.length > 0 && (
                        <p className="mt-1 font-mono text-sm text-red-800">
                          Refund payment
                          {entry.refundPaymentCodes.length > 1 ? "s" : ""}:{" "}
                          {entry.refundPaymentCodes.join(", ")}
                        </p>
                      )}
                      <p className="mt-1 text-red-700">{entry.reason}</p>
                      <a
                        href={entry.proofUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-flex text-sm font-medium text-blue-700 hover:underline"
                      >
                        View refund proof
                        {entry.proofFileName ? ` (${entry.proofFileName})` : ""}
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {invoice.editHistory && invoice.editHistory.length > 0 ? (
              <div className="space-y-3">
                {invoice.editHistory.map((entry) => {
                  const abandonPaymentSummary =
                    getAbandonHistoryPaymentSummary(entry);

                  return (
                    <div
                      key={entry.id}
                      className="rounded-lg border border-gray-200 bg-gray-50 p-4"
                    >
                      <p className="text-sm text-gray-800">{entry.reason}</p>
                      {abandonPaymentSummary && (
                        <p className="mt-2 font-mono text-sm font-medium text-orange-800">
                          {abandonPaymentSummary}
                        </p>
                      )}
                      <p className="mt-1 text-xs text-gray-500">
                        {new Date(entry.createdAt).toLocaleString()} by{" "}
                        {entry.editedBy?.displayName ||
                          formatUserDisplayName(entry.editedBy)}
                      </p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-500">
                No edits recorded yet.
              </div>
            )}
          </div>
        </div>
        {/* end invoiceRef */}
      </div>

      <Modal
        isOpen={markPaidModalOpen}
        onClose={() => {
          if (!isSavingInstallmentPayment) {
            setMarkPaidModalOpen(false);
            setSelectedInstallment(null);
            setMarkPaidError(null);
            setUnmatchedPaymentSearch("");
            setSelectedUnmatchedPaymentId(null);
          }
        }}
        title={
          selectedInstallment
            ? `Mark Paid: ${selectedInstallment.label}`
            : "Mark Installment Paid"
        }
        maxWidth="2xl"
        footer={
          <div className="flex justify-end gap-3">
            <button
              onClick={() => {
                setMarkPaidModalOpen(false);
                setSelectedInstallment(null);
                setMarkPaidError(null);
                setUnmatchedPaymentSearch("");
                setSelectedUnmatchedPaymentId(null);
              }}
              className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100"
              disabled={isSavingInstallmentPayment}
            >
              Cancel
            </button>
            <button
              onClick={confirmInstallmentPaid}
              disabled={
                isSavingInstallmentPayment ||
                (shouldPromptLateFee && applyLateFee === null) ||
                (shouldPromptLateFee &&
                  applyLateFee === false &&
                  !lateFeeWaivedReason.trim())
              }
              className="px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-60"
            >
              {isSavingInstallmentPayment ? "Saving..." : "Confirm"}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          {selectedInstallment && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm">
              <p className="font-medium text-gray-800">
                Installment: {selectedInstallment.label}
              </p>
              <p className="text-gray-600 mt-1">
                Amount: {formatCurrency(selectedInstallment.amount)}
              </p>
              {new Date(selectedInstallment.dueDate) <
                new Date(paymentDate) && (
                <p className="mt-1 text-red-600 font-medium">
                  This installment is overdue.
                </p>
              )}
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMarkPaidMode("create")}
              className={`px-3 py-1.5 rounded text-sm font-medium ${
                markPaidMode === "create"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-200 text-gray-700"
              }`}
            >
              Create Payment
            </button>
            <button
              type="button"
              onClick={() => setMarkPaidMode("link")}
              className={`px-3 py-1.5 rounded text-sm font-medium ${
                markPaidMode === "link"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-200 text-gray-700"
              }`}
            >
              Link Existing Payment
            </button>
          </div>

          {markPaidMode === "create" ? (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Amount
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={paymentAmount || ""}
                  onChange={(e) =>
                    setPaymentAmount(Number(e.target.value) || 0)
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Payment Date
                </label>
                <input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Method
                </label>
                <select
                  value={selectedMethodId || ""}
                  onChange={(e) =>
                    setSelectedMethodId(Number(e.target.value) || null)
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
                >
                  <option value="">Select method</option>
                  {paymentMethods.map((method) => (
                    <option key={method.id} value={method.id}>
                      {method.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes
                </label>
                <textarea
                  rows={2}
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Search Payment
                </label>
                <input
                  type="text"
                  placeholder="Search by payment code or amount..."
                  value={unmatchedPaymentSearch}
                  onChange={(e) => setUnmatchedPaymentSearch(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Select Payment
                </label>
                <select
                  value={selectedUnmatchedPaymentId || ""}
                  onChange={(e) => {
                    const paymentId = Number(e.target.value) || null;
                    setSelectedUnmatchedPaymentId(paymentId);
                    const selected = unmatchedPayments.find(
                      (payment) => payment.id === paymentId,
                    );
                    if (selected && selectedInstallment) {
                      const available = Number(
                        selected.remainingAmount ?? selected.amount,
                      );
                      setLinkAmount(
                        Math.min(selectedInstallment.amount, available),
                      );
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
                >
                  <option value="">Select unmatched payment</option>
                  {unmatchedPayments
                    .filter((payment) => {
                      const code =
                        payment?.paymentCode ||
                        `PAY-${String(payment.id).padStart(6, "0")}`;
                      const amount = Number(
                        payment.remainingAmount ?? payment.amount,
                      ).toFixed(2);
                      const searchLower = unmatchedPaymentSearch.toLowerCase();
                      return (
                        code.toLowerCase().includes(searchLower) ||
                        amount.includes(searchLower)
                      );
                    })
                    .map((payment) => (
                      <option key={payment.id} value={payment.id}>
                        {payment?.paymentCode ||
                          `PAY-${String(payment.id).padStart(6, "0")}`}{" "}
                        - $
                        {Number(
                          payment.remainingAmount ?? payment.amount,
                        ).toFixed(2)}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Link Amount
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={linkAmount || ""}
                  onChange={(e) => setLinkAmount(Number(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
                />
              </div>
            </div>
          )}

          {shouldPromptLateFee && overdueInstallment && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-3">
              <div>
                <p className="text-sm font-semibold text-amber-900">
                  Installment due date has passed
                </p>
                <p className="text-xs text-amber-800 mt-1">
                  {overdueInstallment.label} was due on{" "}
                  {new Date(overdueInstallment.dueDate).toLocaleDateString()}.
                  Apply late fee to this invoice? Admin late fee: $
                  {lateFeeSetting.amount.toFixed(2)}
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setApplyLateFee(true)}
                  className={`px-3 py-2 rounded-lg text-sm border ${
                    applyLateFee === true
                      ? "bg-amber-600 text-white border-amber-600"
                      : "bg-white text-amber-900 border-amber-200"
                  }`}
                >
                  Apply late fee
                </button>
                <button
                  type="button"
                  onClick={() => setApplyLateFee(false)}
                  className={`px-3 py-2 rounded-lg text-sm border ${
                    applyLateFee === false
                      ? "bg-white text-amber-900 border-amber-500"
                      : "bg-white text-amber-900 border-amber-200"
                  }`}
                >
                  Waive late fee
                </button>
              </div>
              {applyLateFee === false && (
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

          {markPaidError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {markPaidError}
            </div>
          )}
        </div>
      </Modal>

      {/* Hidden invoice image template — rendered off-screen for JPG export */}
      <div
        style={{
          position: "fixed",
          left: "-9999px",
          top: 0,
          width: "800px",
          pointerEvents: "none",
          zIndex: -1,
        }}
        aria-hidden="true"
      >
        <div ref={imageTemplateRef}>
          <InvoiceImageTemplate
            invoice={{
              ...invoice,
              amount:
                invoice.status === "abandoned" ? 0 : localInvoiceAmount,
              paidAmount: localPaidAmount,
            }}
            payments={payments}
            abandonmentRefunds={abandonmentRefunds}
            terms={
              invoice?.terms?.lines || invoice?.termsSnapshot || defaultTerms
            }
          />
        </div>
      </div>
    </Modal>
  );
}
