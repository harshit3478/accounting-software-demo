"use client";

import { useState, useEffect, useCallback } from "react";
import { useToastContext } from "../components/ToastContext";

export type ChequeStatus = "PENDING" | "APPROVED" | "REJECTED" | "NEEDS_CORRECTION";

export interface InvoiceAllocation {
  id: number;
  chequeVaultId: number;
  invoiceId: number;
  allocatedAmount: number;
  invoice: {
    id: number;
    invoiceNumber: string;
    clientName: string;
    amount?: number;
    paidAmount?: number;
    status?: string;
  } | null;
}

export interface ChequeVaultRecord {
  id: number;
  chequeNumber: string;
  payeeName: string;
  customerEmail: string | null;
  amount: number;
  chequeDate: string;
  bankName: string | null;
  imageUrl: string;
  imageFileName: string;
  rawOcrText: string | null;
  status: ChequeStatus;
  uploadedById: number;
  approvedById: number | null;
  approvedAt: string | null;
  rejectionReason: string | null;
  correctionNote: string | null;
  createdAt: string;
  updatedAt: string;
  uploadedBy: { id: number; name: string; email: string };
  approvedBy: { id: number; name: string } | null;
  invoiceAllocations: InvoiceAllocation[];
}

export interface ChequeVaultStats {
  pendingCount: number;
  approvedTotal: number;
  rejectedCount: number;
  needsCorrectionCount: number;
}

export interface DateRange {
  startDate: string;
  endDate: string;
}

export function useChequeVault() {
  const { showSuccess, showError } = useToastContext();

  const [cheques, setCheques] = useState<ChequeVaultRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);

  // Filters
  const [filterStatus, setFilterStatus] = useState<ChequeStatus | "all">("all");
  const [searchPayee, setSearchPayee] = useState("");
  const [debouncedPayee, setDebouncedPayee] = useState("");
  const [dateRange, setDateRange] = useState<DateRange | null>(null);
  const [filterUploadedBy, setFilterUploadedBy] = useState<number | null>(null);

  // Modals
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedCheque, setSelectedCheque] = useState<ChequeVaultRecord | null>(null);

  // Debounce payee search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedPayee(searchPayee);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchPayee]);

  const fetchCheques = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", currentPage.toString());
      params.set("limit", itemsPerPage.toString());
      if (filterStatus !== "all") params.set("status", filterStatus);
      if (debouncedPayee) params.set("payeeName", debouncedPayee);
      if (dateRange) {
        params.set("startDate", dateRange.startDate);
        params.set("endDate", dateRange.endDate);
      }
      if (filterUploadedBy) params.set("uploadedBy", filterUploadedBy.toString());

      const res = await fetch(`/api/cheque-vault?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch");

      const data = await res.json();
      setCheques(data.cheques);
      setTotalPages(data.pagination.totalPages);
      setTotalItems(data.pagination.total);
    } catch (error) {
      console.error("useChequeVault fetchCheques:", error);
      showError("Failed to load cheque vault");
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, itemsPerPage, filterStatus, debouncedPayee, dateRange, filterUploadedBy, showError]);

  useEffect(() => {
    fetchCheques();
  }, [fetchCheques]);

  const handleOpenDetail = (cheque: ChequeVaultRecord) => {
    setSelectedCheque(cheque);
    setShowDetailModal(true);
  };

  const handleApprove = async (id: number): Promise<{ paymentRefs?: string[]; warnings?: string[] } | null> => {
    try {
      const res = await fetch(`/api/cheque-vault/${id}/approve`, { method: "PUT" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to approve");
      const refs: string[] = data.paymentRefs || [];
      showSuccess(`Cheque approved. Payment ref${refs.length > 1 ? "s" : ""}: ${refs.join(", ")}`);
      await fetchCheques();
      return data;
    } catch (error: any) {
      showError(error.message || "Failed to approve cheque");
      return null;
    }
  };

  const handleReject = async (id: number, rejectionReason: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/cheque-vault/${id}/reject`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rejectionReason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to reject");
      showSuccess("Cheque rejected");
      await fetchCheques();
      return true;
    } catch (error: any) {
      showError(error.message || "Failed to reject cheque");
      return false;
    }
  };

  const handleRequestCorrection = async (id: number, correctionNote: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/cheque-vault/${id}/request-correction`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ correctionNote }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to request correction");
      showSuccess("Correction requested");
      await fetchCheques();
      return true;
    } catch (error: any) {
      showError(error.message || "Failed to request correction");
      return false;
    }
  };

  const handleUpdateAllocations = async (
    chequeId: number,
    invoices: { invoiceId: number; allocatedAmount: number }[]
  ): Promise<boolean> => {
    try {
      const res = await fetch(`/api/cheque-vault/${chequeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoices }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update invoice links");
      showSuccess(invoices.length > 0 ? "Invoices linked" : "Invoice links cleared");
      if (selectedCheque?.id === chequeId) {
        setSelectedCheque(data.cheque);
      }
      await fetchCheques();
      return true;
    } catch (error: any) {
      showError(error.message || "Failed to link invoices");
      return false;
    }
  };

  const stats: ChequeVaultStats = {
    pendingCount: cheques.filter((c) => c.status === "PENDING").length,
    approvedTotal: cheques
      .filter((c) => c.status === "APPROVED")
      .reduce((sum, c) => sum + c.amount, 0),
    rejectedCount: cheques.filter((c) => c.status === "REJECTED").length,
    needsCorrectionCount: cheques.filter((c) => c.status === "NEEDS_CORRECTION").length,
  };

  return {
    cheques,
    isLoading,
    pagination: { currentPage, totalPages, totalItems, itemsPerPage },
    setCurrentPage,

    // Filters
    filterStatus,
    setFilterStatus: (s: ChequeStatus | "all") => { setFilterStatus(s); setCurrentPage(1); },
    searchPayee,
    setSearchPayee,
    dateRange,
    setDateRange: (r: DateRange | null) => { setDateRange(r); setCurrentPage(1); },
    filterUploadedBy,
    setFilterUploadedBy: (id: number | null) => { setFilterUploadedBy(id); setCurrentPage(1); },

    // Modals
    showUploadModal,
    setShowUploadModal,
    showDetailModal,
    setShowDetailModal,
    selectedCheque,
    setSelectedCheque,

    // Actions
    fetchCheques,
    handleOpenDetail,
    handleApprove,
    handleReject,
    handleRequestCorrection,
    handleUpdateAllocations,

    stats,
  };
}
