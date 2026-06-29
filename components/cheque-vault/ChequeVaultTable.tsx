"use client";

import { ChequeVaultRecord, ChequeStatus } from "@/hooks/useChequeVault";
import {
  canDeleteChequeRequest,
  canEditChequeRequest,
} from "@/lib/cheque-vault-permissions";
import { useAuth } from "@/lib/AuthContext";
import { formatBusinessDate } from "@/lib/business-date";

interface ChequeVaultTableProps {
  cheques: ChequeVaultRecord[];
  isLoading: boolean;
  currentUserId?: number | null;
  onViewCheque: (cheque: ChequeVaultRecord) => void;
  onDeleteCheque?: (cheque: ChequeVaultRecord) => void;
}

const STATUS_STYLES: Record<ChequeStatus, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  APPROVED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
  NEEDS_CORRECTION: "bg-orange-100 text-orange-800",
};

const STATUS_LABELS: Record<ChequeStatus, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  NEEDS_CORRECTION: "Needs Correction",
};

function formatDate(dateStr: string) {
  return formatBusinessDate(dateStr);
}

export default function ChequeVaultTable({
  cheques,
  isLoading,
  currentUserId,
  onViewCheque,
  onDeleteCheque,
}: ChequeVaultTableProps) {
  const { isSuperAdmin, canApproveCheques, canUploadCheques } = useAuth();
  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              {[
                "Date",
                "Cheque #",
                "Customer / Payor",
                "Bank",
                "Amount",
                "Invoice",
                "Uploaded By",
                "Status",
                "",
              ].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 5 }).map((_, i) => (
              <tr key={i} className="border-t border-gray-100">
                {Array.from({ length: 9 }).map((_, j) => (
                  <td key={j} className="px-4 py-3">
                    <div className="h-4 bg-gray-200 rounded animate-pulse" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (cheques.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
        <div className="text-gray-400 mb-2">
          <svg
            className="w-12 h-12 mx-auto"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        </div>
        <p className="text-gray-500 font-medium">No cheques found</p>
        <p className="text-gray-400 text-sm mt-1">
          {canUploadCheques
            ? "Upload a cheque to get started"
            : "Cheque requests will appear here once uploaded"}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Upload Date
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Cheque #
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Customer / Payor
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Bank
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Amount
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Cheque Date
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Invoice
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Uploaded By
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {cheques.map((cheque) => (
              <tr
                key={cheque.id}
                className="hover:bg-gray-50 transition-colors cursor-pointer"
                onClick={() => onViewCheque(cheque)}
              >
                <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                  {formatDate(cheque.createdAt)}
                </td>
                <td className="px-4 py-3 font-medium text-gray-900">
                  {cheque.chequeNumber || (
                    <span className="text-gray-400 italic">Not set</span>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-700 max-w-[160px] truncate">
                  {cheque.payorName || (
                    <span className="text-gray-400 italic">Unknown</span>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {cheque.bankName || <span className="text-gray-400">—</span>}
                </td>
                <td className="px-4 py-3 text-right font-medium text-gray-900 whitespace-nowrap">
                  ${cheque.amount.toFixed(2)}
                </td>
                <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                  {formatDate(cheque.chequeDate)}
                </td>
                <td className="px-4 py-3">
                  {cheque.invoiceAllocations.length > 0 ? (
                    <span className="text-blue-600 font-medium">
                      {cheque.invoiceAllocations[0].invoice?.invoiceNumber ||
                        "—"}
                      {cheque.invoiceAllocations.length > 1 && (
                        <span className="text-blue-400 ml-1 text-xs">
                          +{cheque.invoiceAllocations.length - 1} more
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className="text-gray-400 text-xs italic">
                      Not linked
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {cheque.uploadedBy?.name || "—"}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${STATUS_STYLES[cheque.status]}`}
                  >
                    {STATUS_LABELS[cheque.status]}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    {onDeleteCheque &&
                      canDeleteChequeRequest(cheque, currentUserId) && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteCheque(cheque);
                          }}
                          className="px-3 py-1 text-xs bg-red-50 hover:bg-red-100 text-red-700 rounded-lg transition-colors"
                        >
                          Delete
                        </button>
                      )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onViewCheque(cheque);
                      }}
                      className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
                    >
                      {canEditChequeRequest(cheque, currentUserId, {
                        isSuperAdmin,
                        canApprove: canApproveCheques,
                      })
                        ? "Edit"
                        : "View"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
