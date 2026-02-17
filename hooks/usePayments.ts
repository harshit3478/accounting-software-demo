"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useToastContext } from "../components/ToastContext";

export interface PaymentMethodType {
  id: number;
  name: string;
  icon: string | null;
  color: string;
  isActive: boolean;
  isSystem: boolean;
  sortOrder: number;
}

export interface Payment {
  id: number;
  amount: number;
  methodId: number;
  method: PaymentMethodType;
  paymentDate: string;
  notes: string | null;
  createdAt: string;
  source?: string;
  invoice: {
    id: number;
    invoiceNumber: string;
    clientName: string;
    amount: number;
  } | null;
  paymentMatches?: Array<{
    id: number;
    amount: number;
    invoice: {
      id: number;
      invoiceNumber: string;
      clientName: string;
      amount: number;
    };
  }>;
}

export interface PaymentStats {
  byMethod: Record<number, { amount: number; count: number; name: string; color: string }>;
  totalToday: number;
  totalCount: number;
}

export type PaymentMethodFilter = 'all' | string; // 'all' or methodId as string
export type PaymentSortField = 'date' | 'amount' | 'client';
export type SortDirection = 'asc' | 'desc';

export interface DateRange {
  startDate: string;
  endDate: string;
  preset?: string;
}

interface UsePaymentsReturn {
  // Data
  payments: Payment[];
  filteredPayments: Payment[];
  paginatedPayments: Payment[];
  isLoading: boolean;
  unmatchedCount: number;
  
  // Filters
  filterMethod: PaymentMethodFilter;
  setFilterMethod: (filter: PaymentMethodFilter) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  dateRange: DateRange | null;
  setDateRange: (range: DateRange | null) => void;
  
  // Sorting
  sortBy: PaymentSortField;
  sortDirection: SortDirection;
  handleSort: (field: PaymentSortField) => void;
  
  // Pagination
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  setCurrentPage: (page: number) => void;
  setItemsPerPage: (items: number) => void;
  
  // Modals
  showRecordModal: boolean;
  setShowRecordModal: (show: boolean) => void;
  showViewModal: boolean;
  setShowViewModal: (show: boolean) => void;
  showCSVUploadModal: boolean;
  setShowCSVUploadModal: (show: boolean) => void;
  
  // Selected payment
  viewingPayment: Payment | null;
  setViewingPayment: (payment: Payment | null) => void;
  
  // Actions
  fetchPayments: () => Promise<void>;
  fetchUnmatchedCount: () => Promise<void>;
  handleViewPayment: (payment: Payment) => void;
  handlePageChange: (page: number) => void;
  handleItemsPerPageChange: (items: number) => void;
  handleExportPDF: () => Promise<void>;
  handleExportCSV: () => Promise<void>;
  
  // Statistics
  stats: PaymentStats;
  filteredStats: PaymentStats;

  // Payment methods
  paymentMethods: PaymentMethodType[];
}

export function usePayments(): UsePaymentsReturn {
  const { showSuccess, showError, showInfo } = useToastContext();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [payments, setPayments] = useState<Payment[]>([]);
  const [unmatchedCount, setUnmatchedCount] = useState(0);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodType[]>([]);
  const [stats, setStats] = useState<PaymentStats>({
    byMethod: {},
    totalToday: 0,
    totalCount: 0,
  });
  
  const [isLoading, setIsLoading] = useState(true);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Initialize state from URL params
  const [filterMethod, setFilterMethodState] = useState<PaymentMethodFilter>(
    (searchParams.get("method") as PaymentMethodFilter) || "all"
  );
  const [searchQuery, setSearchQueryState] = useState(searchParams.get("search") || "");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(searchQuery);
  
  const [dateRange, setDateRangeState] = useState<DateRange | null>(
    searchParams.get("startDate") && searchParams.get("endDate")
      ? {
          startDate: searchParams.get("startDate")!,
          endDate: searchParams.get("endDate")!,
        }
      : null
  );

  const [sortBy, setSortBy] = useState<PaymentSortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  
  // Apply sorting to payments
  const sortedPayments = [...payments].sort((a, b) => {
    let compareResult = 0;
    
    if (sortBy === 'date') {
      const dateA = new Date(a.paymentDate).getTime();
      const dateB = new Date(b.paymentDate).getTime();
      compareResult = dateA - dateB;
    } else if (sortBy === 'amount') {
      compareResult = a.amount - b.amount;
    } else if (sortBy === 'client') {
      const clientA = a.invoice?.clientName || a.paymentMatches?.[0]?.invoice.clientName || '';
      const clientB = b.invoice?.clientName || b.paymentMatches?.[0]?.invoice.clientName || '';
      compareResult = clientA.localeCompare(clientB);
    }
    
    return sortDirection === 'asc' ? compareResult : -compareResult;
  });
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(
    parseInt(searchParams.get("page") || "1")
  );
  const [itemsPerPage, setItemsPerPageState] = useState(10);

  // Load itemsPerPage from localStorage + fetch payment methods
  useEffect(() => {
    const savedItemsPerPage = localStorage.getItem("paymentsItemsPerPage");
    if (savedItemsPerPage) {
      setItemsPerPageState(parseInt(savedItemsPerPage));
    }
    // Fetch payment methods for filters/display
    fetch('/api/payment-methods')
      .then(res => res.ok ? res.json() : [])
      .then(data => setPaymentMethods(data))
      .catch(() => {});
  }, []);

  // Modal states
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showCSVUploadModal, setShowCSVUploadModal] = useState(false);
  const [viewingPayment, setViewingPayment] = useState<Payment | null>(null);

  // Update URL helper
  const updateUrl = useCallback((params: Record<string, string | null>) => {
    const newSearchParams = new URLSearchParams(searchParams.toString());
    
    Object.entries(params).forEach(([key, value]) => {
      if (value === null || value === "" || value === "all") {
        newSearchParams.delete(key);
      } else {
        newSearchParams.set(key, value);
      }
    });

    router.push(`${pathname}?${newSearchParams.toString()}`);
  }, [pathname, router, searchParams]);

  // Wrappers
  const setFilterMethod = (method: PaymentMethodFilter) => {
    setFilterMethodState(method);
    setCurrentPage(1);
    updateUrl({ method, page: "1" });
  };

  const setSearchQuery = (query: string) => {
    setSearchQueryState(query);
  };

  const setDateRange = (range: DateRange | null) => {
    setDateRangeState(range);
    setCurrentPage(1);
    updateUrl({
      startDate: range?.startDate || null,
      endDate: range?.endDate || null,
      page: "1"
    });
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    updateUrl({ page: page.toString() });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleItemsPerPageChange = (items: number) => {
    setItemsPerPageState(items);
    localStorage.setItem("paymentsItemsPerPage", items.toString());
    setCurrentPage(1);
    updateUrl({ limit: items.toString(), page: "1" });
  };

  const handleSort = (field: PaymentSortField) => {
    if (sortBy === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortDirection('asc');
    }
  };

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
      if (searchQuery !== (searchParams.get("search") || "")) {
        setCurrentPage(1);
        updateUrl({ search: searchQuery, page: "1" });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, updateUrl, searchParams]);

  // Fetch unmatched count
  const fetchUnmatchedCount = async () => {
    try {
      const response = await fetch('/api/payments/unmatched');
      if (response.ok) {
        const result = await response.json();
        setUnmatchedCount(result.summary.count);
      }
    } catch (err) {
      console.error('Failed to fetch unmatched count:', err);
    }
  };

  // Fetch payments
  const fetchPayments = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", currentPage.toString());
      params.set("limit", itemsPerPage.toString());
      if (filterMethod !== "all") params.set("method", filterMethod);
      if (debouncedSearchQuery) params.set("search", debouncedSearchQuery);
      if (dateRange) {
        params.set("startDate", dateRange.startDate);
        params.set("endDate", dateRange.endDate);
      }

      const res = await fetch(`/api/payments?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        const fetchedPayments = data.payments.map((payment: any) => ({
          ...payment,
          paymentDate: payment.paymentDate ? new Date(payment.paymentDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
          createdAt: payment.createdAt ? new Date(payment.createdAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        }));
        
        setPayments(fetchedPayments);
        setTotalPages(data.pagination.pages);
        setTotalItems(data.pagination.total);

        // Calculate stats from all fetched payments
        const byMethod: PaymentStats['byMethod'] = {};
        for (const p of fetchedPayments) {
          const mId = p.method?.id || p.methodId;
          if (!byMethod[mId]) {
            byMethod[mId] = { amount: 0, count: 0, name: p.method?.name || 'Unknown', color: p.method?.color || '#6B7280' };
          }
          byMethod[mId].amount += p.amount;
          byMethod[mId].count += 1;
        }

        const totalAmount = fetchedPayments.reduce((sum: number, p: any) => sum + p.amount, 0);

        setStats({
          byMethod,
          totalToday: totalAmount,
          totalCount: fetchedPayments.length,
        });
      } else {
        showError('Failed to fetch payments');
      }
    } catch (error) {
      console.error('Failed to fetch payments:', error);
      showError('Failed to fetch payments');
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, itemsPerPage, filterMethod, debouncedSearchQuery, dateRange, showError]);

  const [lastUpdateTimestamp, setLastUpdateTimestamp] = useState<string | null>(null);


  // Initial fetch
  useEffect(() => {
    fetchPayments();
    fetchUnmatchedCount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterMethod, debouncedSearchQuery, dateRange, currentPage, itemsPerPage]);

  const handleViewPayment = (payment: Payment) => {
    setViewingPayment(payment);
    setShowViewModal(true);
  };

  const handleExportPDF = async () => {
    try {
      const jsPDF = (await import('jspdf')).default;
      const autoTable = (await import('jspdf-autotable')).default;
      const doc = new jsPDF();
      
      // Title
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.text('Payment History Report', 105, 20, { align: 'center' });
      
      // Subtitle with date
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100);
      doc.text(`Generated: ${new Date().toLocaleDateString()}`, 105, 28, { align: 'center' });
      
      let yPos = 40;
      
      // Summary section in a box
      doc.setTextColor(0);
      doc.setFillColor(245, 247, 250);
      doc.roundedRect(15, yPos, 180, 42, 3, 3, 'F');
      doc.setDrawColor(200, 200, 200);
      doc.roundedRect(15, yPos, 180, 42, 3, 3, 'S');
      
      yPos += 8;
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('Summary', 20, yPos);
      
      yPos += 7;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      
      doc.text(`Total Payments: ${payments.length}`, 20, yPos);
      doc.text(`Total Amount: $${stats.totalToday.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 110, yPos);
      yPos += 7;

      // Dynamic method stats
      const methodEntries = Object.values(stats.byMethod);
      for (let i = 0; i < methodEntries.length; i++) {
        const entry = methodEntries[i];
        const xPos = i % 2 === 0 ? 20 : 110;
        doc.text(`${entry.name}: $${entry.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })} (${entry.count})`, xPos, yPos);
        if (i % 2 === 1) yPos += 7;
      }
      if (methodEntries.length % 2 === 1) yPos += 7;
      
      yPos += 15;
      
      // Prepare table data
      const tableData = payments.map(payment => {
        const date = new Date(payment.paymentDate).toLocaleDateString();
        const invoice = payment.invoice?.invoiceNumber || 
                       payment.paymentMatches?.map(m => m.invoice.invoiceNumber).join(', ') || 
                       'Unmatched';
        const client = payment.invoice?.clientName || 
                      payment.paymentMatches?.[0]?.invoice.clientName || 
                      'N/A';
        const amount = `$${payment.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
        const method = payment.method?.name || 'Unknown';
        const notes = payment.notes ? (payment.notes.length > 30 ? payment.notes.substring(0, 27) + '...' : payment.notes) : '-';
        
        return [date, invoice, client, amount, method, notes];
      });
      
      // Generate professional table with autoTable
      autoTable(doc, {
        startY: yPos,
        head: [['Date', 'Invoice #', 'Client', 'Amount', 'Method', 'Notes']],
        body: tableData,
        theme: 'striped',
        headStyles: {
          fillColor: [75, 0, 130], // Purple theme for payments
          textColor: 255,
          fontStyle: 'bold',
          halign: 'left',
          fontSize: 10
        },
        bodyStyles: {
          fontSize: 9,
          textColor: 50
        },
        alternateRowStyles: {
          fillColor: [245, 247, 250]
        },
        columnStyles: {
          0: { cellWidth: 25 },
          1: { cellWidth: 30 },
          2: { cellWidth: 35 },
          3: { halign: 'right', cellWidth: 25 },
          4: { cellWidth: 25 },
          5: { cellWidth: 35 }
        },
        margin: { left: 15, right: 15 },
        didParseCell: function(data) {
          // Color code payment method column using dynamic colors
          if (data.column.index === 4 && data.section === 'body') {
            data.cell.styles.fontStyle = 'bold';
          }
        }
      });
      
      // Footer
      const pageCount = doc.getNumberOfPages();
      doc.setFontSize(8);
      doc.setTextColor(150);
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.text(
          `Generated on ${new Date().toLocaleString()} - Page ${i} of ${pageCount}`,
          105,
          285,
          { align: 'center' }
        );
      }
      
      doc.save('payment-history.pdf');
      showSuccess('PDF exported successfully!');
    } catch (error) {
      console.error('Error exporting PDF:', error);
      showError('Failed to export PDF');
    }
  };

  const handleExportCSV = async () => {
    try {
      // Build query string with current filters
      const params = new URLSearchParams();
      if (filterMethod !== "all") params.set("method", filterMethod);
      if (debouncedSearchQuery) params.set("search", debouncedSearchQuery);
      if (dateRange) {
        params.set("startDate", dateRange.startDate);
        params.set("endDate", dateRange.endDate);
      }

      const response = await fetch(`/api/payments/export?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error('Export failed');
      }

      // Download the CSV file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `payments-export-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      showSuccess('CSV exported successfully!');
    } catch (error) {
      console.error('Error exporting CSV:', error);
      showError('Failed to export CSV');
    }
  };

  return {
    payments,
    filteredPayments: sortedPayments,
    paginatedPayments: sortedPayments,
    isLoading,
    unmatchedCount,
    filterMethod,
    setFilterMethod,
    searchQuery,
    setSearchQuery,
    dateRange,
    setDateRange,
    sortBy,
    sortDirection,
    handleSort,
    currentPage,
    totalPages,
    totalItems,
    itemsPerPage,
    setCurrentPage: handlePageChange,
    setItemsPerPage: handleItemsPerPageChange,
    showRecordModal,
    setShowRecordModal,
    showViewModal,
    setShowViewModal,
    showCSVUploadModal,
    setShowCSVUploadModal,
    viewingPayment,
    setViewingPayment,
    fetchPayments,
    fetchUnmatchedCount,
    handleViewPayment,
    handlePageChange,
    handleItemsPerPageChange,
    handleExportPDF,
    stats,
    filteredStats: stats,
    paymentMethods,
  };
}
