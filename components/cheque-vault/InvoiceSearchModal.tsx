"use client";

import { useState, useEffect, useCallback } from "react";
import {
  resolveInvoiceDate,
  resolveLiveTypeLabel,
} from "@/lib/invoice-display";

interface InvoiceOption {
  id: number;
  invoiceNumber: string;
  clientName: string;
  amount: number;
  paidAmount: number;
  status: string;
  dueDate: string;
  invoiceDate?: string | null;
  createdAt?: string | null;
  liveTypeSnapshot?: string | null;
  liveType?: {
    name?: string | null;
    country?: string | null;
  } | null;
}

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export interface AllocationEntry {
  invoiceId: number;
  invoiceNumber: string;
  clientName: string;
  allocatedAmount: number;
  remaining: number;
}

interface InvoiceSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (allocations: AllocationEntry[]) => void;
  chequeAmount: number;
  customerId?: number | null;
  initialAllocations?: AllocationEntry[];
}

const statusColor: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  partial: "bg-blue-100 text-blue-800",
  overdue: "bg-red-100 text-red-800",
  paid: "bg-green-100 text-green-800",
};

export default function InvoiceSearchModal({
  isOpen,
  onClose,
  onConfirm,
  chequeAmount,
  customerId,
  initialAllocations = [],
}: InvoiceSearchModalProps) {
  const [search, setSearch] = useState("");
  const [invoices, setInvoices] = useState<InvoiceOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [allocations, setAllocations] =
    useState<AllocationEntry[]>(initialAllocations);

  const fetchInvoices = useCallback(
    async (query: string) => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams({
          limit: "20",
          status: "linkable",
          sortBy: "invoiceNumber",
          sortDirection: "desc",
        });
        if (query) params.set("search", query);
        if (customerId) params.set("customerId", String(customerId));
        const res = await fetch(`/api/invoices?${params.toString()}`);
        if (!res.ok) throw new Error("Failed");
        const data = await res.json();
        setInvoices(
          (data.invoices || []).map((inv: any) => ({
            ...inv,
            amount: Number(inv.amount),
            paidAmount: Number(inv.paidAmount),
          })),
        );
      } catch {
        setInvoices([]);
      } finally {
        setIsLoading(false);
      }
    },
    [customerId],
  );

  useEffect(() => {
    if (!isOpen) return;
    setSearch("");
    setAllocations(initialAllocations);
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => fetchInvoices(search), 300);
    return () => clearTimeout(timer);
  }, [search, isOpen, fetchInvoices]);

  if (!isOpen) return null;

  const selectedIds = new Set(allocations.map((a) => a.invoiceId));
  const totalAllocated = allocations.reduce((s, a) => s + a.allocatedAmount, 0);
  const remaining = (inv: InvoiceOption) =>
    Math.max(inv.amount - inv.paidAmount, 0);

  const handleAdd = (inv: InvoiceOption) => {
    if (selectedIds.has(inv.id)) return;
    setAllocations((prev) => [
      ...prev,
      {
        invoiceId: inv.id,
        invoiceNumber: inv.invoiceNumber,
        clientName: inv.clientName,
        allocatedAmount: Math.min(
          remaining(inv),
          Math.max(chequeAmount - totalAllocated, 0),
        ),
        remaining: remaining(inv),
      },
    ]);
  };

  const handleRemove = (invoiceId: number) => {
    setAllocations((prev) => prev.filter((a) => a.invoiceId !== invoiceId));
  };

  const handleAmountChange = (invoiceId: number, value: string) => {
    const num = parseFloat(value) || 0;
    setAllocations((prev) =>
      prev.map((a) =>
        a.invoiceId === invoiceId ? { ...a, allocatedAmount: num } : a,
      ),
    );
  };

  const isOverAllocated = totalAllocated > chequeAmount + 0.01;
  const isUnderAllocated =
    totalAllocated < chequeAmount - 0.01 && allocations.length > 0;

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-4xl mx-4 flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Link Invoices</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
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

        {/* Search */}
        <div className="px-6 py-3 border-b border-gray-100">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              customerId
                ? "Search this customer's invoices..."
                : "Search by invoice number, client name..."
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            autoFocus
          />
          <p className="text-xs text-gray-500 mt-1">
            Only unpaid invoices (pending, partial, or overdue) are shown.
            {customerId ? " Filtered to the matched customer." : ""}
          </p>
        </div>

        {/* Search results */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
            </div>
          ) : invoices.length === 0 ? (
            <div className="text-center py-8 text-gray-500 text-sm">
              {search
                ? "No unpaid invoices found"
                : "Start typing to search unpaid invoices"}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Invoice #
                  </th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Client
                  </th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Invoice Date
                  </th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Live Type
                  </th>
                  <th className="text-right px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Remaining
                  </th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {invoices.map((inv) => {
                  const isSelected = selectedIds.has(inv.id);
                  const liveTypeLabel = resolveLiveTypeLabel(inv);
                  return (
                    <tr
                      key={inv.id}
                      className={`transition-colors ${isSelected ? "bg-blue-50" : "hover:bg-gray-50"}`}
                    >
                      <td className="px-4 py-2.5 font-medium text-gray-900">
                        {inv.invoiceNumber}
                      </td>
                      <td className="px-4 py-2.5 text-gray-700">
                        {inv.clientName}
                      </td>
                      <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">
                        {formatDate(
                          resolveInvoiceDate(inv.invoiceDate, inv.createdAt),
                        )}
                      </td>
                      <td
                        className="px-4 py-2.5 text-gray-700 max-w-[140px] truncate"
                        title={liveTypeLabel || undefined}
                      >
                        {liveTypeLabel || (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right font-medium text-gray-900">
                        ${remaining(inv).toFixed(2)}
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[inv.status] || "bg-gray-100 text-gray-700"}`}
                        >
                          {inv.status}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {isSelected ? (
                          <span className="text-xs text-blue-600 font-medium">
                            Added ✓
                          </span>
                        ) : (
                          <button
                            onClick={() => handleAdd(inv)}
                            className="px-3 py-1 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 transition-colors"
                          >
                            Add
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Allocation list */}
        {allocations.length > 0 && (
          <div className="border-t border-gray-200 px-6 py-3 space-y-2 max-h-48 overflow-y-auto">
            <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">
              Selected Invoices
            </p>
            {allocations.map((alloc) => (
              <div key={alloc.invoiceId} className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-gray-900">
                    {alloc.invoiceNumber}
                  </span>
                  <span className="text-xs text-gray-500 ml-2">
                    {alloc.clientName}
                  </span>
                  <span className="text-xs text-gray-400 ml-1">
                    (bal: ${alloc.remaining.toFixed(2)})
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-gray-500">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={alloc.allocatedAmount}
                    onChange={(e) =>
                      handleAmountChange(alloc.invoiceId, e.target.value)
                    }
                    className="w-24 px-2 py-1 border border-gray-300 rounded text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <button
                  onClick={() => handleRemove(alloc.invoiceId)}
                  className="text-gray-400 hover:text-red-500 transition-colors"
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
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-200 flex items-center justify-between">
          <div className="text-sm">
            <span
              className={`font-semibold ${isOverAllocated ? "text-red-600" : isUnderAllocated ? "text-amber-600" : "text-gray-700"}`}
            >
              Allocated: ${totalAllocated.toFixed(2)}
            </span>
            <span className="text-gray-400 ml-1">
              / Cheque: ${chequeAmount.toFixed(2)}
            </span>
            {isOverAllocated && (
              <span className="ml-2 text-xs text-red-600 font-medium">
                Over by ${(totalAllocated - chequeAmount).toFixed(2)}
              </span>
            )}
            {isUnderAllocated && (
              <span className="ml-2 text-xs text-amber-600">
                ${(chequeAmount - totalAllocated).toFixed(2)} unallocated
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5"
            >
              Cancel
            </button>
            <button
              onClick={() => onConfirm(allocations)}
              disabled={allocations.length === 0 || isOverAllocated}
              className="px-4 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Confirm ({allocations.length} invoice
              {allocations.length !== 1 ? "s" : ""})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
