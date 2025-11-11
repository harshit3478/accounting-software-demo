'use client';

import { useState, useEffect } from 'react';

export interface InvoiceItem {
  name: string;
  quantity: number;
  price: number;
}

export interface Invoice {
  id: number;
  invoiceNumber: string;
  clientName: string;
  items: InvoiceItem[] | null;
  subtotal: number;
  tax: number;
  discount: number;
  amount: number;
  paidAmount: number;
  dueDate: string;
  status: 'paid' | 'pending' | 'overdue' | 'partial';
  isLayaway: boolean;
  createdAt: string;
  // Shipping fields (nullable)
  shipmentId?: string | null;
  trackingNumber?: string | null;
}

export type InvoiceFilter = 'all' | 'pending' | 'paid' | 'overdue' | 'partial' | 'layaway';

interface UseInvoicesReturn {
  // Data
  invoices: Invoice[];
  filteredInvoices: Invoice[];
  paginatedInvoices: Invoice[];
  isLoading: boolean;
  
  // Filters
  filter: InvoiceFilter;
  setFilter: (filter: InvoiceFilter) => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  sortBy: string;
  setSortBy: (sort: string) => void;
  dateRange: { start: string; end: string } | null;
  setDateRange: (range: { start: string; end: string } | null) => void;
  
  // Pagination
  currentPage: number;
  totalPages: number;
  itemsPerPage: number;
  setCurrentPage: (page: number) => void;
  setItemsPerPage: (items: number) => void;
  
  // Modals
  showCreateModal: boolean;
  setShowCreateModal: (show: boolean) => void;
  showEditModal: boolean;
  setShowEditModal: (show: boolean) => void;
  showViewModal: boolean;
  setShowViewModal: (show: boolean) => void;
  showPaymentModal: boolean;
  setShowPaymentModal: (show: boolean) => void;
  showDeleteConfirm: boolean;
  setShowDeleteConfirm: (show: boolean) => void;
  showCSVUploadModal: boolean;
  setShowCSVUploadModal: (show: boolean) => void;
  showShipModal: boolean;
  setShowShipModal: (show: boolean) => void;
  
  // Selected invoices
  editingInvoice: Invoice | null;
  setEditingInvoice: (invoice: Invoice | null) => void;
  viewingInvoice: Invoice | null;
  setViewingInvoice: (invoice: Invoice | null) => void;
  paymentInvoice: Invoice | null;
  setPaymentInvoice: (invoice: Invoice | null) => void;
  shippingInvoice: Invoice | null;
  setShippingInvoice: (invoice: Invoice | null) => void;
  deletingInvoice: Invoice | null;
  setDeletingInvoice: (invoice: Invoice | null) => void;
  isDeleting: boolean;
  
  // Actions
  fetchInvoices: () => Promise<void>;
  handleViewInvoice: (invoice: Invoice) => void;
  handleOpenShipModal: (invoice: Invoice) => void;
  handleEditInvoice: (invoice: Invoice) => void;
  handleOpenPaymentModal: (invoice: Invoice) => void;
  handleDeleteClick: (invoice: Invoice) => void;
  handleDeleteConfirm: () => Promise<void>;
  handleExportCSV: () => void;
  handleExportPDF: () => void;
  handlePageChange: (page: number) => void;
  handleItemsPerPageChange: (items: number) => void;
  
  // Statistics
  stats: {
    total: number;
    paidThisMonth: number;
    overdue: number;
    pending: number;
    layaway: number;
    totalOutstanding: number;
  };
}

export function useInvoices(
  showSuccess: (message: string) => void,
  showError: (message: string) => void,
  showInfo: (message: string) => void
): UseInvoicesReturn {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [filter, setFilter] = useState<InvoiceFilter>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('date-desc');
  const [dateRange, setDateRange] = useState<{ start: string; end: string } | null>(null);
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  
  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showCSVUploadModal, setShowCSVUploadModal] = useState(false);
  const [showShipModal, setShowShipModal] = useState(false);
  
  // Selected invoice states
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [viewingInvoice, setViewingInvoice] = useState<Invoice | null>(null);
  const [paymentInvoice, setPaymentInvoice] = useState<Invoice | null>(null);
  const [deletingInvoice, setDeletingInvoice] = useState<Invoice | null>(null);
  const [shippingInvoice, setShippingInvoice] = useState<Invoice | null>(null);
  
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Fetch invoices on mount
  useEffect(() => {
    fetchInvoices();
  }, []);

  // Reset to page 1 when filter or search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filter, debouncedSearchTerm, sortBy, dateRange]);

  const fetchInvoices = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/invoices');
      if (res.ok) {
        const data = await res.json();
        setInvoices(data.map((inv: any) => ({
          ...inv,
          dueDate: new Date(inv.dueDate).toISOString().split('T')[0],
          createdAt: new Date(inv.createdAt).toISOString().split('T')[0],
        })));
      } else {
        showError('Failed to fetch invoices');
      }
    } catch (error) {
      console.error('Failed to fetch invoices:', error);
      showError('Failed to fetch invoices');
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewInvoice = (invoice: Invoice) => {
    setViewingInvoice(invoice);
    setShowViewModal(true);
  };

  const handleOpenShipModal = (invoice: Invoice) => {
    setShippingInvoice(invoice);
    setShowShipModal(true);
  };

  const handleEditInvoice = (invoice: Invoice) => {
    setEditingInvoice(invoice);
    setShowEditModal(true);
  };

  const handleOpenPaymentModal = (invoice: Invoice) => {
    setPaymentInvoice(invoice);
    setShowPaymentModal(true);
  };

  const handleDeleteClick = (invoice: Invoice) => {
    setDeletingInvoice(invoice);
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingInvoice) return;

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/invoices/${deletingInvoice.id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        showSuccess(`Invoice ${deletingInvoice.invoiceNumber} deleted successfully`);
        await fetchInvoices();
        setShowDeleteConfirm(false);
        setDeletingInvoice(null);
      } else {
        const error = await res.json();
        showError(error.error || 'Failed to delete invoice');
      }
    } catch (error) {
      console.error('Failed to delete invoice:', error);
      showError('Failed to delete invoice');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleExportCSV = () => {
    if (filteredInvoices.length === 0) {
      showInfo('No invoices to export');
      return;
    }

    try {
      // Dynamic import to avoid build issues
      import('../lib/csv-export').then(({ invoicesToCSV, downloadCSV }) => {
        const csvData = filteredInvoices.map(inv => ({
          invoiceNumber: inv.invoiceNumber,
          clientName: inv.clientName,
          amount: inv.amount,
          paidAmount: inv.paidAmount,
          status: inv.status,
          dueDate: inv.dueDate,
          createdAt: inv.createdAt,
          items: inv.items ? inv.items.map(item => `${item.name} (${item.quantity}x$${item.price})`).join('; ') : '',
          tax: inv.tax,
          discount: inv.discount,
        }));

        const csv = invoicesToCSV(csvData);
        const timestamp = new Date().toISOString().split('T')[0];
        downloadCSV(csv, `invoices-${timestamp}.csv`);
        showSuccess(`Exported ${filteredInvoices.length} invoices to CSV`);
      });
    } catch (error) {
      console.error('Failed to export CSV:', error);
      showError('Failed to export CSV');
    }
  };

  const handleExportPDF = () => {
    if (filteredInvoices.length === 0) {
      showInfo('No invoices to export');
      return;
    }

    try {
      // Dynamic import to avoid build issues
      import('../lib/pdf-export').then(({ generateInvoicesPDF }) => {
        generateInvoicesPDF(filteredInvoices, {
          dateRange,
          statusFilter: filter !== 'all' ? filter : undefined,
          searchTerm: searchTerm || undefined,
        });
        showSuccess(`Exported ${filteredInvoices.length} invoices to PDF`);
      });
    } catch (error) {
      console.error('Failed to export PDF:', error);
      showError('Failed to export PDF');
    }
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleItemsPerPageChange = (items: number) => {
    setItemsPerPage(items);
    setCurrentPage(1);
  };

  // Filter and sort logic
  const filteredInvoices = invoices
    .filter(invoice => {
      // Status filter
      if (filter === 'layaway' && !invoice.isLayaway) return false;
      if (filter !== 'all' && filter !== 'layaway' && invoice.status !== filter) return false;
      
      // Search filter
      if (debouncedSearchTerm && 
          !invoice.clientName.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) &&
          !invoice.invoiceNumber.toLowerCase().includes(debouncedSearchTerm.toLowerCase())) return false;
      
      // Date range filter
      if (dateRange) {
        const invoiceDate = new Date(invoice.createdAt);
        const startDate = new Date(dateRange.start);
        const endDate = new Date(dateRange.end);
        endDate.setHours(23, 59, 59, 999); // Include the entire end date
        
        if (invoiceDate < startDate || invoiceDate > endDate) return false;
      }
      
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'date-desc':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'date-asc':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case 'amount-desc':
          return b.amount - a.amount;
        case 'amount-asc':
          return a.amount - b.amount;
        case 'client-asc':
          return a.clientName.localeCompare(b.clientName);
        default:
          return 0;
      }
    });

  // Pagination
  const totalPages = Math.ceil(filteredInvoices.length / itemsPerPage);
  const paginatedInvoices = filteredInvoices.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Statistics - overall and filtered
  const totalOutstanding = invoices
    .filter(inv => inv.status === 'pending' || inv.status === 'overdue' || inv.status === 'partial')
    .reduce((sum, inv) => sum + (inv.amount - inv.paidAmount), 0);

  const filteredTotalOutstanding = filteredInvoices
    .filter(inv => inv.status === 'pending' || inv.status === 'overdue' || inv.status === 'partial')
    .reduce((sum, inv) => sum + (inv.amount - inv.paidAmount), 0);

  const stats = {
    total: invoices.length,
    paidThisMonth: invoices.filter(inv => inv.status === 'paid').reduce((sum, inv) => sum + inv.amount, 0),
    overdue: invoices.filter(inv => inv.status === 'overdue').length,
    pending: invoices.filter(inv => inv.status === 'pending').length,
    layaway: invoices.filter(inv => inv.isLayaway).length,
    totalOutstanding,
    // Filtered stats
    filteredTotal: filteredInvoices.length,
    filteredPaidThisMonth: filteredInvoices.filter(inv => inv.status === 'paid').reduce((sum, inv) => sum + inv.amount, 0),
    filteredOverdue: filteredInvoices.filter(inv => inv.status === 'overdue').length,
    filteredPending: filteredInvoices.filter(inv => inv.status === 'pending').length,
    filteredTotalOutstanding,
  };

  return {
    invoices,
    filteredInvoices,
    paginatedInvoices,
    isLoading,
    filter,
    setFilter,
    searchTerm,
    setSearchTerm,
    sortBy,
    setSortBy,
    dateRange,
    setDateRange,
    currentPage,
    totalPages,
    itemsPerPage,
    setCurrentPage,
    setItemsPerPage,
    showCreateModal,
    setShowCreateModal,
    showEditModal,
    setShowEditModal,
    showViewModal,
    setShowViewModal,
    showPaymentModal,
    setShowPaymentModal,
    showDeleteConfirm,
    setShowDeleteConfirm,
    showCSVUploadModal,
    setShowCSVUploadModal,
  showShipModal,
  setShowShipModal,
    editingInvoice,
    setEditingInvoice,
    viewingInvoice,
    setViewingInvoice,
    paymentInvoice,
    setPaymentInvoice,
  shippingInvoice,
  setShippingInvoice,
    deletingInvoice,
    setDeletingInvoice,
    isDeleting,
    fetchInvoices,
  handleViewInvoice,
  handleOpenShipModal,
    handleEditInvoice,
    handleOpenPaymentModal,
    handleDeleteClick,
    handleDeleteConfirm,
    handleExportCSV,
    handleExportPDF,
    handlePageChange,
    handleItemsPerPageChange,
    stats,
  };
}
