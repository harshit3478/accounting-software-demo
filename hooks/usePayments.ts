"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useToastContext } from "../components/ToastContext";

export interface Payment {
  id: number;
  amount: number;
  method: 'cash' | 'zelle' | 'quickbooks' | 'layaway';
  paymentDate: string;
  notes: string | null;
  createdAt: string;
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
  cashToday: number;
  cashCount: number;
  zelleToday: number;
  zelleCount: number;
  quickbooksToday: number;
  quickbooksCount: number;
  layawayToday: number;
  layawayCount: number;
  totalToday: number;
}

export type PaymentMethodFilter = 'all' | 'cash' | 'zelle' | 'quickbooks' | 'layaway';
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
  
  // Statistics
  stats: PaymentStats;
  filteredStats: PaymentStats;
}

export function usePayments(): UsePaymentsReturn {
  const { showSuccess, showError, showInfo } = useToastContext();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [payments, setPayments] = useState<Payment[]>([]);
  const [unmatchedCount, setUnmatchedCount] = useState(0);
  const [stats, setStats] = useState<PaymentStats>({
    cashToday: 0,
    cashCount: 0,
    zelleToday: 0,
    zelleCount: 0,
    quickbooksToday: 0,
    quickbooksCount: 0,
    layawayToday: 0,
    layawayCount: 0,
    totalToday: 0,
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
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(
    parseInt(searchParams.get("page") || "1")
  );
  const [itemsPerPage, setItemsPerPageState] = useState(10);

  // Load itemsPerPage from localStorage
  useEffect(() => {
    const savedItemsPerPage = localStorage.getItem("paymentsItemsPerPage");
    if (savedItemsPerPage) {
      setItemsPerPageState(parseInt(savedItemsPerPage));
    }
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

        // Calculate today's stats (Note: This only calculates based on the fetched page)
        const today = new Date().toISOString().split('T')[0];
        const todayPayments = fetchedPayments.filter((p: any) => {
          const paymentDate = p.paymentDate ? new Date(p.paymentDate).toISOString().split('T')[0] : null;
          return paymentDate === today;
        });

        const newStats: PaymentStats = {
          cashToday: todayPayments.filter((p: any) => p.method === 'cash').reduce((sum: number, p: any) => sum + p.amount, 0),
          cashCount: todayPayments.filter((p: any) => p.method === 'cash').length,
          zelleToday: todayPayments.filter((p: any) => p.method === 'zelle').reduce((sum: number, p: any) => sum + p.amount, 0),
          zelleCount: todayPayments.filter((p: any) => p.method === 'zelle').length,
          quickbooksToday: todayPayments.filter((p: any) => p.method === 'quickbooks').reduce((sum: number, p: any) => sum + p.amount, 0),
          quickbooksCount: todayPayments.filter((p: any) => p.method === 'quickbooks').length,
          layawayToday: todayPayments.filter((p: any) => p.method === 'layaway').reduce((sum: number, p: any) => sum + p.amount, 0),
          layawayCount: todayPayments.filter((p: any) => p.method === 'layaway').length,
          totalToday: todayPayments.reduce((sum: number, p: any) => sum + p.amount, 0),
        };
        
        setStats(newStats);
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

  // Polling for updates
  useEffect(() => {
    const checkUpdates = async () => {
      try {
        const res = await fetch('/api/payments/last-updated');
        if (!res.ok) return;
        
        const data = await res.json();
        if (data.lastUpdated) {
          if (lastUpdateTimestamp && data.lastUpdated !== lastUpdateTimestamp) {
            showInfo('New payments detected. Refreshing...');
            await fetchPayments();
          }
          setLastUpdateTimestamp(data.lastUpdated);
        }
      } catch (error) {
        console.error('Error checking for updates:', error);
      }
    };

    const intervalId = setInterval(checkUpdates, 10000); // Check every 10 seconds
    checkUpdates(); // Initial check

    return () => clearInterval(intervalId);
  }, [lastUpdateTimestamp, fetchPayments, showInfo]);

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
      
      doc.text(`Cash: $${stats.cashToday.toLocaleString('en-US', { minimumFractionDigits: 2 })} (${stats.cashCount})`, 20, yPos);
      doc.text(`Zelle: $${stats.zelleToday.toLocaleString('en-US', { minimumFractionDigits: 2 })} (${stats.zelleCount})`, 110, yPos);
      yPos += 7;
      
      doc.text(`QuickBooks: $${stats.quickbooksToday.toLocaleString('en-US', { minimumFractionDigits: 2 })} (${stats.quickbooksCount})`, 20, yPos);
      doc.text(`Layaway: $${stats.layawayToday.toLocaleString('en-US', { minimumFractionDigits: 2 })} (${stats.layawayCount})`, 110, yPos);
      
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
        const method = payment.method.toUpperCase();
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
          // Color code payment method column
          if (data.column.index === 4 && data.section === 'body') {
            const method = (data.cell.raw as string).toLowerCase();
            if (method === 'cash') {
              data.cell.styles.textColor = [217, 119, 6]; // Amber
              data.cell.styles.fontStyle = 'bold';
            } else if (method === 'zelle') {
              data.cell.styles.textColor = [34, 139, 34]; // Green
              data.cell.styles.fontStyle = 'bold';
            } else if (method === 'quickbooks') {
              data.cell.styles.textColor = [37, 99, 235]; // Blue
              data.cell.styles.fontStyle = 'bold';
            } else if (method === 'layaway') {
              data.cell.styles.textColor = [147, 51, 234]; // Purple
              data.cell.styles.fontStyle = 'bold';
            }
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

  return {
    payments,
    filteredPayments: payments, // Alias for compatibility
    paginatedPayments: payments, // Alias for compatibility
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
    filteredStats: stats, // Alias for compatibility
  };
}
