"use client";

import { Suspense, useState } from "react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import Pagination from "@/components/Pagination";
import { ToastProvider, useToastContext } from "@/components/ToastContext";
import { useChequeVault } from "@/hooks/useChequeVault";
import {
  ChequeVaultTable,
  UploadChequeModal,
  ChequeDetailModal,
} from "@/components/cheque-vault";
import { useAuth } from "@/lib/AuthContext";
import DateRangePicker from "@/components/DateRangePicker";
import ConfirmModal from "@/components/ConfirmModal";
import type { ChequeVaultRecord } from "@/hooks/useChequeVault";

const STATUS_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "PENDING", label: "Pending" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
  { value: "NEEDS_CORRECTION", label: "Needs Correction" },
] as const;

const DOCUMENT_TYPE_OPTIONS = [
  { value: "all", label: "All Types" },
  { value: "CHEQUE", label: "Cheques" },
  { value: "MEMO", label: "Memos" },
] as const;

function ChequeVaultContent() {
  const { isSuperAdmin, canUploadCheques, canApproveCheques, user } = useAuth();
  const vault = useChequeVault();
  const canUploadCheque = canUploadCheques;
  const [deleteTarget, setDeleteTarget] = useState<ChequeVaultRecord | null>(
    null,
  );
  const [isDeleting, setIsDeleting] = useState(false);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    const ok = await vault.handleDelete(deleteTarget.id);
    setIsDeleting(false);
    if (ok) setDeleteTarget(null);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navigation />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        {/* Page header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Cheque Vault</h1>
            <p className="text-sm text-gray-500 mt-1">
              {canApproveCheques
                ? "Review, approve, or reject cheque and memo payment requests"
                : canUploadCheque
                  ? "Upload and manage cheque and memo payments"
                  : "View uploaded cheque and memo payment requests"}
            </p>
          </div>
          {canUploadCheque && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  vault.setUploadDocumentType("CHEQUE");
                  vault.setShowUploadModal(true);
                }}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
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
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
                Upload Cheque
              </button>
              <button
                onClick={() => {
                  vault.setUploadDocumentType("MEMO");
                  vault.setShowUploadModal(true);
                }}
                className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2"
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
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                Upload Memo
              </button>
            </div>
          )}
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <StatCard
            label="Pending Review"
            value={String(vault.stats.pendingCount)}
            color="yellow"
          />
          <StatCard
            label="Approved (Total)"
            value={`$${vault.stats.approvedTotal.toFixed(2)}`}
            color="green"
          />
          <StatCard
            label="Rejected"
            value={String(vault.stats.rejectedCount)}
            color="red"
          />
          <StatCard
            label="Needs Correction"
            value={String(vault.stats.needsCorrectionCount)}
            color="orange"
          />
        </div>

        {/* Toolbar */}
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 mb-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* Status filter */}
            <select
              value={vault.filterStatus}
              onChange={(e) => vault.setFilterStatus(e.target.value as any)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            <select
              value={vault.filterDocumentType}
              onChange={(e) =>
                vault.setFilterDocumentType(e.target.value as any)
              }
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {DOCUMENT_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            {/* Payee search */}
            <input
              type="text"
              value={vault.searchPayee}
              onChange={(e) => vault.setSearchPayee(e.target.value)}
              placeholder="Search payee name..."
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-52"
            />

            {/* Date range */}
            <DateRangePicker
              value={
                vault.dateRange
                  ? { ...vault.dateRange, preset: "" }
                  : { startDate: "", endDate: "", preset: "" }
              }
              onChange={(r) =>
                vault.setDateRange(
                  r.startDate && r.endDate
                    ? { startDate: r.startDate, endDate: r.endDate }
                    : null,
                )
              }
            />

            {/* Admin: uploaded by filter could be added here */}
          </div>
        </div>

        {/* Table */}
        <ChequeVaultTable
          cheques={vault.cheques}
          isLoading={vault.isLoading}
          currentUserId={user?.id}
          onViewCheque={vault.handleOpenDetail}
          onDeleteCheque={setDeleteTarget}
        />

        {/* Pagination */}
        {vault.pagination.totalPages > 1 && (
          <Pagination
            currentPage={vault.pagination.currentPage}
            totalPages={vault.pagination.totalPages}
            totalItems={vault.pagination.totalItems}
            itemsPerPage={vault.pagination.itemsPerPage}
            onPageChange={vault.setCurrentPage}
            onItemsPerPageChange={() => {}}
          />
        )}
      </main>

      <Footer />

      {/* Modals */}
      <UploadChequeModal
        isOpen={vault.showUploadModal}
        documentType={vault.uploadDocumentType}
        onClose={() => vault.setShowUploadModal(false)}
        onSuccess={(_cheque) => {
          vault.setShowUploadModal(false);
          vault.fetchCheques();
        }}
      />

      <ChequeDetailModal
        isOpen={vault.showDetailModal}
        cheque={vault.selectedCheque}
        onClose={() => {
          vault.setShowDetailModal(false);
          vault.setSelectedCheque(null);
        }}
        onApprove={vault.handleApprove}
        onReject={vault.handleReject}
        onRequestCorrection={vault.handleRequestCorrection}
        onUpdateAllocations={vault.handleUpdateAllocations}
        onUpdateDetails={vault.handleUpdateDetails}
        onDelete={vault.handleDelete}
      />

      <ConfirmModal
        isOpen={!!deleteTarget}
        title="Delete cheque request?"
        message={
          deleteTarget
            ? `Delete pending ${deleteTarget.documentType === "MEMO" ? "memo" : "cheque"} request for #${deleteTarget.chequeNumber || "—"}? This cannot be undone. Approved requests cannot be deleted.`
            : ""
        }
        confirmText="Delete"
        cancelText="Cancel"
        danger
        isLoading={isDeleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: "yellow" | "green" | "red" | "orange";
}) {
  const colorStyles = {
    yellow: "bg-yellow-50 border-yellow-200 text-yellow-800",
    green: "bg-green-50 border-green-200 text-green-800",
    red: "bg-red-50 border-red-200 text-red-800",
    orange: "bg-orange-50 border-orange-200 text-orange-800",
  };
  return (
    <div className={`rounded-xl border p-4 ${colorStyles[color]}`}>
      <p className="text-xs font-medium opacity-70 uppercase tracking-wide">
        {label}
      </p>
      <p className="text-xl font-bold mt-1">{value}</p>
    </div>
  );
}

export default function ChequeVaultPage() {
  return (
    <ToastProvider>
      <Suspense>
        <ChequeVaultContent />
      </Suspense>
    </ToastProvider>
  );
}
