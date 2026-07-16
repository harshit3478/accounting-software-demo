"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ChequeVaultRecord, InvoiceAllocation } from "@/hooks/useChequeVault";
import InvoiceSearchModal, { AllocationEntry } from "./InvoiceSearchModal";
import ChequeDocumentPreview from "./ChequeDocumentPreview";
import { useAuth } from "@/lib/AuthContext";
import {
  canDeleteChequeRequest,
  canEditChequeRequest,
  canLinkInvoicesOnCheque,
  isChequeRequestReadOnly,
} from "@/lib/cheque-vault-permissions";
import { getChequeVaultDocumentTypeLabel } from "@/lib/cheque-vault-upload";
import {
  formatBusinessDate,
  getBusinessTodayString,
  toBusinessDateString,
} from "@/lib/business-date";

interface ChequeDetailModalProps {
  isOpen: boolean;
  cheque: ChequeVaultRecord | null;
  onClose: () => void;
  onApprove: (
    id: number,
  ) => Promise<{ paymentRefs?: string[]; warnings?: string[] } | null>;
  onReject: (id: number, reason: string) => Promise<boolean>;
  onRequestCorrection: (id: number, note: string) => Promise<boolean>;
  onUpdateAllocations: (
    chequeId: number,
    invoices: { invoiceId: number; allocatedAmount: number }[],
  ) => Promise<boolean>;
  onUpdateDetails?: (
    chequeId: number,
    fields: {
      chequeNumber: string;
      payorName: string;
      amount: number;
      chequeDate: string;
      bankName: string | null;
      customerEmail: string | null;
      memoText?: string | null;
    },
  ) => Promise<boolean>;
  onDelete?: (id: number) => Promise<boolean>;
}

const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  APPROVED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
  NEEDS_CORRECTION: "bg-orange-100 text-orange-800",
};

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  return formatBusinessDate(dateStr);
}

function formatDateTime(dateStr: string | null) {
  if (!dateStr) return "—";
  return formatBusinessDate(dateStr, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function ChequeDetailModal({
  isOpen,
  cheque,
  onClose,
  onApprove,
  onReject,
  onRequestCorrection,
  onUpdateAllocations,
  onUpdateDetails,
  onDelete,
}: ChequeDetailModalProps) {
  const { isSuperAdmin, canApproveCheques, user } = useAuth();
  const canReviewCheque = isSuperAdmin || canApproveCheques;
  const reviewOptions = { isSuperAdmin, canApprove: canApproveCheques };
  const [chequeNumber, setChequeNumber] = useState("");
  const [payorName, setPayorName] = useState("");
  const [amount, setAmount] = useState("");
  const [chequeDate, setChequeDate] = useState("");
  const [bankName, setBankName] = useState("");
  const [memoText, setMemoText] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [isSavingDetails, setIsSavingDetails] = useState(false);
  const [actionMode, setActionMode] = useState<
    "none" | "reject" | "correction"
  >("none");
  const [rejectionReason, setRejectionReason] = useState("");
  const [correctionNote, setCorrectionNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [approveResult, setApproveResult] = useState<{
    paymentRefs?: string[];
    warnings?: string[];
  } | null>(null);
  const [showInvoiceSearch, setShowInvoiceSearch] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!cheque) return;
    setChequeNumber(cheque.chequeNumber || "");
    setPayorName(cheque.payorName || "");
    setAmount(String(cheque.amount ?? ""));
    setChequeDate(
      cheque.chequeDate
        ? toBusinessDateString(new Date(cheque.chequeDate))
        : "",
    );
    setBankName(cheque.bankName || "");
    setMemoText(cheque.memoText || "");
    setCustomerEmail(cheque.customerEmail || "");
  }, [cheque]);

  if (!isOpen || !cheque) return null;

  const isMemo = cheque.documentType === "MEMO";
  const docLabel = getChequeVaultDocumentTypeLabel(cheque.documentType);

  const readOnly = isChequeRequestReadOnly(cheque);
  const canEdit =
    !!onUpdateDetails && canEditChequeRequest(cheque, user?.id, reviewOptions);
  const canLink = canLinkInvoicesOnCheque(cheque, user?.id, reviewOptions);

  const handleApprove = async () => {
    setIsSubmitting(true);
    const result = await onApprove(cheque.id);
    setIsSubmitting(false);
    if (result) setApproveResult(result);
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) return;
    setIsSubmitting(true);
    const ok = await onReject(cheque.id, rejectionReason);
    setIsSubmitting(false);
    if (ok) {
      setActionMode("none");
      setRejectionReason("");
      onClose();
    }
  };

  const handleRequestCorrection = async () => {
    if (!correctionNote.trim()) return;
    setIsSubmitting(true);
    const ok = await onRequestCorrection(cheque.id, correctionNote);
    setIsSubmitting(false);
    if (ok) {
      setActionMode("none");
      setCorrectionNote("");
      onClose();
    }
  };

  const handleClose = () => {
    setActionMode("none");
    setRejectionReason("");
    setCorrectionNote("");
    setApproveResult(null);
    onClose();
  };

  const handleConfirmAllocations = async (entries: AllocationEntry[]) => {
    setShowInvoiceSearch(false);
    await onUpdateAllocations(
      cheque.id,
      entries.map((e) => ({
        invoiceId: e.invoiceId,
        allocatedAmount: e.allocatedAmount,
      })),
    );
  };

  const canAction =
    cheque.status === "PENDING" || cheque.status === "NEEDS_CORRECTION";
  const canDelete = !!onDelete && canDeleteChequeRequest(cheque, user?.id);
  const hasAllocations = cheque.invoiceAllocations.length > 0;

  const handleDelete = async () => {
    if (!onDelete) return;
    setIsDeleting(true);
    const ok = await onDelete(cheque.id);
    setIsDeleting(false);
    if (ok) {
      setShowDeleteConfirm(false);
      handleClose();
    }
  };

  const handleSaveDetails = async () => {
    if (!onUpdateDetails || !chequeNumber.trim()) return;
    setIsSavingDetails(true);
    await onUpdateDetails(cheque.id, {
      chequeNumber: chequeNumber.trim(),
      payorName: payorName.trim(),
      amount: parseFloat(amount) || 0,
      chequeDate: chequeDate || getBusinessTodayString(),
      bankName: bankName.trim() || null,
      customerEmail: customerEmail.trim() || null,
      memoText: isMemo ? memoText.trim() || null : undefined,
    });
    setIsSavingDetails(false);
  };

  // Build initial allocations for the modal from current cheque data
  const currentAllocations: AllocationEntry[] = cheque.invoiceAllocations.map(
    (a: InvoiceAllocation) => ({
      invoiceId: a.invoiceId,
      invoiceNumber: a.invoice?.invoiceNumber || "",
      clientName: a.invoice?.clientName || "",
      allocatedAmount: a.allocatedAmount,
      remaining: a.invoice
        ? Math.max((a.invoice.amount || 0) - (a.invoice.paidAmount || 0), 0)
        : 0,
    }),
  );

  // Determine customer ID from first allocation's invoice (for filtering)
  const linkedCustomerId = cheque.invoiceAllocations[0]?.invoice
    ? undefined
    : undefined;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={handleClose}
        />
        <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-5xl mx-4 flex flex-col max-h-[90vh]">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-gray-900">
                {canEdit ? `Edit ${docLabel} Request` : `${docLabel} Detail`}
              </h2>
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  isMemo
                    ? "bg-indigo-100 text-indigo-800"
                    : "bg-blue-100 text-blue-800"
                }`}
              >
                {docLabel}
              </span>
              <span
                className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_STYLES[cheque.status]}`}
              >
                {cheque.status.replace("_", " ")}
              </span>
            </div>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 lg:divide-x divide-gray-200">
              {/* Left: Image */}
              <div className="p-6">
                <p className="text-sm font-medium text-gray-700 mb-3">
                  {docLabel} Document
                </p>
                <div
                  className="bg-gray-100 rounded-lg overflow-hidden border border-gray-200 cursor-pointer hover:opacity-90 transition-opacity"
                  onClick={() => window.open(cheque.imageUrl, "_blank")}
                  title="Click to open full size"
                >
                  <ChequeDocumentPreview
                    imageUrl={cheque.imageUrl}
                    imageFileName={cheque.imageFileName}
                    chequeNumber={cheque.chequeNumber}
                    documentTypeLabel={docLabel}
                  />
                </div>
                <p className="text-xs text-gray-400 mt-2 text-center">
                  Click to open full document
                </p>

                {cheque.correctionNote && (
                  <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                    <p className="text-xs font-semibold text-orange-700 mb-1">
                      Correction Required
                    </p>
                    <p className="text-sm text-orange-800">
                      {cheque.correctionNote}
                    </p>
                    {cheque.correctionRequestedBy && (
                      <p className="text-xs text-orange-700 mt-2">
                        Requested by {cheque.correctionRequestedBy.name}
                        {cheque.correctionRequestedAt
                          ? ` on ${formatDateTime(cheque.correctionRequestedAt)}`
                          : ""}
                      </p>
                    )}
                  </div>
                )}
                {cheque.rejectionReason && (
                  <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-xs font-semibold text-red-700 mb-1">
                      Rejection Reason
                    </p>
                    <p className="text-sm text-red-800">
                      {cheque.rejectionReason}
                    </p>
                    {cheque.rejectedBy && (
                      <p className="text-xs text-red-700 mt-2">
                        Rejected by {cheque.rejectedBy.name}
                        {cheque.rejectedAt
                          ? ` on ${formatDateTime(cheque.rejectedAt)}`
                          : ""}
                      </p>
                    )}
                  </div>
                )}
                {cheque.status === "APPROVED" && cheque.approvedBy && (
                  <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-xs font-semibold text-green-700 mb-1">
                      Approved
                    </p>
                    <p className="text-sm text-green-800">
                      By {cheque.approvedBy.name} on{" "}
                      {formatDateTime(cheque.approvedAt)}
                    </p>
                  </div>
                )}
              </div>

              {/* Right: Fields */}
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm font-medium text-gray-700">
                    {canEdit ? `${docLabel} Details` : "Extracted Fields"}
                  </p>
                  {canEdit && (
                    <button
                      onClick={handleSaveDetails}
                      disabled={isSavingDetails || !chequeNumber.trim()}
                      className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors font-medium"
                    >
                      {isSavingDetails ? "Saving..." : "Save Details"}
                    </button>
                  )}
                </div>
                <dl className="space-y-3">
                  {canEdit ? (
                    <>
                      <EditableField label={`${docLabel} Number *`} required>
                        <input
                          value={chequeNumber}
                          onChange={(e) => setChequeNumber(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </EditableField>
                      <EditableField label="Customer / Payor Name">
                        <input
                          value={payorName}
                          onChange={(e) => setPayorName(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </EditableField>
                      <EditableField label="Customer Email">
                        <input
                          type="email"
                          value={customerEmail}
                          onChange={(e) => setCustomerEmail(e.target.value)}
                          placeholder="optional"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </EditableField>
                      <EditableField label="Amount (USD)">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </EditableField>
                      <EditableField label={`${docLabel} Date`}>
                        <input
                          type="date"
                          value={chequeDate}
                          onChange={(e) => setChequeDate(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </EditableField>
                      <EditableField label="Bank Name">
                        <input
                          value={bankName}
                          onChange={(e) => setBankName(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </EditableField>
                      {isMemo && (
                        <EditableField label="Memo Text">
                          <textarea
                            value={memoText}
                            onChange={(e) => setMemoText(e.target.value)}
                            rows={3}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                          />
                        </EditableField>
                      )}
                    </>
                  ) : (
                    <>
                      <Field
                        label={`${docLabel} Number`}
                        value={cheque.chequeNumber}
                      />
                      <Field
                        label="Customer / Payor Name"
                        value={cheque.payorName}
                      />
                      {cheque.customerEmail && (
                        <Field
                          label="Customer Email"
                          value={cheque.customerEmail}
                        />
                      )}
                      <Field
                        label="Amount"
                        value={`$${cheque.amount.toFixed(2)}`}
                      />
                      <Field
                        label={`${docLabel} Date`}
                        value={formatDate(cheque.chequeDate)}
                      />
                      <Field label="Bank Name" value={cheque.bankName} />
                      {isMemo && (
                        <Field label="Memo Text" value={cheque.memoText} />
                      )}
                    </>
                  )}

                  {/* Linked Invoices — approver links before approval */}
                  <div>
                    <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                      Linked Invoices
                      {canLink && (
                        <button
                          onClick={() => setShowInvoiceSearch(true)}
                          className="ml-2 text-xs px-2 py-0.5 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded transition-colors font-normal normal-case tracking-normal"
                        >
                          {hasAllocations ? "Edit Links" : "Link Invoices"}
                        </button>
                      )}
                    </dt>
                    <dd>
                      {canReviewCheque && canAction && !hasAllocations && (
                        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-1">
                          Link at least one invoice before approving this
                          cheque.
                        </p>
                      )}
                      {!canReviewCheque && !hasAllocations && (
                        <p className="text-sm text-gray-500 italic mt-1">
                          An approver will link invoices before this cheque is
                          approved.
                        </p>
                      )}
                      {hasAllocations ? (
                        <div className="space-y-1.5 mt-1">
                          {cheque.invoiceAllocations.map(
                            (a: InvoiceAllocation) => (
                              <div
                                key={a.invoiceId}
                                className="flex items-center justify-between text-sm"
                              >
                                <span className="font-medium text-blue-600">
                                  {a.invoice?.invoiceNumber} —{" "}
                                  {a.invoice?.clientName}
                                </span>
                                <span className="text-gray-700 font-medium">
                                  ${a.allocatedAmount.toFixed(2)}
                                </span>
                              </div>
                            ),
                          )}
                          <div className="flex justify-between text-xs text-gray-500 border-t border-gray-100 pt-1 mt-1">
                            <span>Total allocated</span>
                            <span>
                              $
                              {cheque.invoiceAllocations
                                .reduce(
                                  (s: number, a: InvoiceAllocation) =>
                                    s + a.allocatedAmount,
                                  0,
                                )
                                .toFixed(2)}
                            </span>
                          </div>
                          {cheque.invoicesLinkedBy && (
                            <p className="text-xs text-gray-500 pt-1">
                              Linked by {cheque.invoicesLinkedBy.name}
                              {cheque.invoicesLinkedAt
                                ? ` on ${formatDateTime(cheque.invoicesLinkedAt)}`
                                : ""}
                            </p>
                          )}
                        </div>
                      ) : null}
                    </dd>
                  </div>
                </dl>

                <div className="mt-6 pt-4 border-t border-gray-200">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                    Activity
                  </p>
                  <div className="space-y-2 text-sm">
                    <ActivityRow
                      label="Submitted by"
                      name={cheque.uploadedBy?.name}
                      detail={cheque.uploadedBy?.email}
                      at={cheque.submittedAt || cheque.createdAt}
                    />
                    {cheque.invoicesLinkedBy && (
                      <ActivityRow
                        label="Invoices linked by"
                        name={cheque.invoicesLinkedBy.name}
                        at={cheque.invoicesLinkedAt}
                      />
                    )}
                    {cheque.approvedBy && (
                      <ActivityRow
                        label="Approved by"
                        name={cheque.approvedBy.name}
                        at={cheque.approvedAt}
                      />
                    )}
                    {cheque.rejectedBy && (
                      <ActivityRow
                        label="Rejected by"
                        name={cheque.rejectedBy.name}
                        at={cheque.rejectedAt}
                      />
                    )}
                    {cheque.correctionRequestedBy && (
                      <ActivityRow
                        label="Correction requested by"
                        name={cheque.correctionRequestedBy.name}
                        at={cheque.correctionRequestedAt}
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Approval success banner */}
            {approveResult && (
              <div className="mx-6 mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm font-semibold text-green-700">
                  Cheque approved! Payment ref
                  {(approveResult.paymentRefs?.length ?? 0) > 1 ? "s" : ""}:{" "}
                  {(approveResult.paymentRefs || []).join(", ")}
                </p>
                {approveResult.warnings?.map((w, i) => (
                  <p key={i} className="text-sm text-amber-700 mt-1">
                    {w}
                  </p>
                ))}
              </div>
            )}

            {/* Admin action forms */}
            {canReviewCheque && canAction && !approveResult && (
              <div className="px-6 pb-6">
                {actionMode === "reject" && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm font-medium text-red-700 mb-2">
                      Rejection Reason *
                    </p>
                    <textarea
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="Enter reason for rejection..."
                      rows={3}
                      className="w-full px-3 py-2 border border-red-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={handleReject}
                        disabled={!rejectionReason.trim() || isSubmitting}
                        className="px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                      >
                        {isSubmitting ? "Rejecting..." : "Confirm Reject"}
                      </button>
                      <button
                        onClick={() => setActionMode("none")}
                        className="px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
                {actionMode === "correction" && (
                  <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                    <p className="text-sm font-medium text-orange-700 mb-2">
                      Correction Note *
                    </p>
                    <textarea
                      value={correctionNote}
                      onChange={(e) => setCorrectionNote(e.target.value)}
                      placeholder="Describe what needs to be corrected..."
                      rows={3}
                      className="w-full px-3 py-2 border border-orange-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={handleRequestCorrection}
                        disabled={!correctionNote.trim() || isSubmitting}
                        className="px-4 py-2 bg-orange-600 text-white text-sm rounded-lg hover:bg-orange-700 disabled:opacity-50 transition-colors"
                      >
                        {isSubmitting ? "Sending..." : "Send for Correction"}
                      </button>
                      <button
                        onClick={() => setActionMode("none")}
                        className="px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer — admin actions */}
          {canReviewCheque &&
            canAction &&
            !approveResult &&
            actionMode === "none" && (
              <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-3">
                <button
                  onClick={() => setActionMode("reject")}
                  className="px-4 py-2 bg-red-100 text-red-700 text-sm font-medium rounded-lg hover:bg-red-200 transition-colors"
                >
                  Reject
                </button>
                <button
                  onClick={() => setActionMode("correction")}
                  className="px-4 py-2 bg-orange-100 text-orange-700 text-sm font-medium rounded-lg hover:bg-orange-200 transition-colors"
                >
                  Request Correction
                </button>
                <button
                  onClick={handleApprove}
                  disabled={isSubmitting || !hasAllocations}
                  title={
                    !hasAllocations ? "Link at least one invoice first" : ""
                  }
                  className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isSubmitting ? "Approving..." : "Approve"}
                </button>
              </div>
            )}

          {(canDelete ||
            canEdit ||
            readOnly ||
            approveResult ||
            (cheque.status === "NEEDS_CORRECTION" &&
              !canReviewCheque &&
              !canEdit)) && (
            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between gap-3">
              {canDelete ? (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={isDeleting}
                  className="px-4 py-2 bg-red-50 text-red-700 text-sm font-medium rounded-lg hover:bg-red-100 disabled:opacity-50 transition-colors"
                >
                  Delete Request
                </button>
              ) : (
                <span />
              )}
              <button
                onClick={handleClose}
                className="px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200 transition-colors ml-auto"
              >
                Close
              </button>
            </div>
          )}
        </div>
      </div>

      <ConfirmModal
        isOpen={showDeleteConfirm}
        title="Delete cheque request?"
        message="This pending request will be permanently removed. You cannot delete a request after it has been approved."
        confirmText="Delete"
        cancelText="Cancel"
        danger
        isLoading={isDeleting}
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />

      <InvoiceSearchModal
        isOpen={showInvoiceSearch}
        onClose={() => setShowInvoiceSearch(false)}
        onConfirm={handleConfirmAllocations}
        chequeAmount={parseFloat(amount) || cheque.amount}
        documentTypeLabel={docLabel}
        customerId={linkedCustomerId}
        initialAllocations={currentAllocations}
      />
    </>
  );
}

function ActivityRow({
  label,
  name,
  detail,
  at,
}: {
  label: string;
  name?: string;
  detail?: string;
  at?: string | null;
}) {
  if (!name) return null;
  return (
    <div className="flex flex-col">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="font-medium text-gray-900">
        {name}
        {detail ? ` (${detail})` : ""}
      </span>
      {at && (
        <span className="text-xs text-gray-500">{formatDateTime(at)}</span>
      )}
    </div>
  );
}

function Field({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div>
      <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">
        {label}
      </dt>
      <dd className="text-sm text-gray-900 mt-0.5">
        {value || <span className="text-gray-400 italic">Not available</span>}
      </dd>
    </div>
  );
}

function EditableField({
  label,
  children,
  required,
}: {
  label: string;
  children: ReactNode;
  required?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
        {label}
        {required && (
          <span className="text-red-500 normal-case"> (required)</span>
        )}
      </dt>
      <dd>{children}</dd>
    </div>
  );
}
