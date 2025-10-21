'use client';

import { useState, useEffect } from 'react';
import Navigation from '../../components/Navigation';
import { 
  CreateInvoiceModal, 
  EditInvoiceModal, 
  ViewInvoiceModal, 
  PaymentModal,
  ConfirmModal 
} from '../../components/invoices';
import { ToastProvider, useToastContext } from '../../components/ToastContext';
import { invoicesToCSV, downloadCSV } from '../../lib/csv-export';
import Pagination from '../../components/Pagination';
import TableSkeleton from '../../components/TableSkeleton';

interface InvoiceItem {
  name: string;
  quantity: number;
  price: number;
}

interface Invoice {
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
}

function InvoicesPageContent() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [filter, setFilter] = useState<'all' | 'pending' | 'paid' | 'overdue' | 'partial' | 'layaway'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('date-desc');
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  
  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  // Selected invoice states
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [viewingInvoice, setViewingInvoice] = useState<Invoice | null>(null);
  const [paymentInvoice, setPaymentInvoice] = useState<Invoice | null>(null);
  const [deletingInvoice, setDeletingInvoice] = useState<Invoice | null>(null);
  
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const { showSuccess, showError, showInfo } = useToastContext();

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    fetchInvoices();
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + K for search focus
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        const searchInput = document.querySelector('input[placeholder="Search invoices..."]') as HTMLInputElement;
        searchInput?.focus();
      }
      // Cmd/Ctrl + N for new invoice
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault();
        setShowCreateModal(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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
    } catch (error) {
      console.error('Failed to export CSV:', error);
      showError('Failed to export CSV');
    }
  };

  const filteredInvoices = invoices
    .filter(invoice => {
      if (filter === 'layaway' && !invoice.isLayaway) return false;
      if (filter !== 'all' && filter !== 'layaway' && invoice.status !== filter) return false;
      if (debouncedSearchTerm && 
          !invoice.clientName.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) &&
          !invoice.invoiceNumber.toLowerCase().includes(debouncedSearchTerm.toLowerCase())) return false;
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

  // Pagination logic
  const totalPages = Math.ceil(filteredInvoices.length / itemsPerPage);
  const paginatedInvoices = filteredInvoices.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Reset to page 1 when filter or search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filter, debouncedSearchTerm, sortBy]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleItemsPerPageChange = (items: number) => {
    setItemsPerPage(items);
    setCurrentPage(1);
  };

  const totalOutstanding = invoices
    .filter(inv => inv.status === 'pending' || inv.status === 'overdue' || inv.status === 'partial')
    .reduce((sum, inv) => sum + (inv.amount - inv.paidAmount), 0);

  const stats = {
    total: invoices.length,
    paidThisMonth: invoices.filter(inv => inv.status === 'paid').reduce((sum, inv) => sum + inv.amount, 0),
    overdue: invoices.filter(inv => inv.status === 'overdue').length,
    pending: invoices.filter(inv => inv.status === 'pending').length,
    layaway: invoices.filter(inv => inv.isLayaway).length,
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getStatusBadge = (status: string) => {
    const classes = {
      paid: 'status-paid',
      pending: 'status-pending',
      overdue: 'status-overdue',
      partial: 'status-partial',
    };
    return `status-badge ${classes[status as keyof typeof classes]}`;
  };

  return (
    <div className="bg-gray-50 hero-pattern min-h-screen">
      <Navigation />

      {/* Page Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-bold text-gray-900">Invoice Management</h2>
              <p className="text-gray-600 mt-2">Create, manage, and track all your invoices in one place</p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="text-sm text-gray-500">Total Outstanding</p>
                <p className="text-2xl font-bold text-gray-900">${totalOutstanding.toLocaleString()}</p>
              </div>
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors shadow-lg hover:shadow-xl"
              >
                + Create Invoice
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200 mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
            <div className="flex flex-wrap gap-2">
              {['all', 'pending', 'paid', 'overdue', 'partial', 'layaway'].map((filterType) => (
                <button
                  key={filterType}
                  onClick={() => setFilter(filterType as any)}
                  className={`filter-btn px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    filter === filterType ? 'filter-active' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {filterType === 'all' ? 'All Invoices' : 
                   filterType === 'layaway' ? `Layaway (${stats.layaway})` :
                   filterType.charAt(0).toUpperCase() + filterType.slice(1)}
                </button>
              ))}
            </div>
            <div className="flex items-center space-x-4">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search invoices..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-300 text-gray-900 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-64"
                />
                <svg className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                </svg>
              </div>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="border border-gray-300 text-gray-900 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="date-desc">Newest First</option>
                <option value="date-asc">Oldest First</option>
                <option value="amount-desc">Highest Amount</option>
                <option value="amount-asc">Lowest Amount</option>
                <option value="client-asc">Client A-Z</option>
              </select>
            </div>
          </div>
        </div>

        {/* Invoice Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200 card-hover animate-fade-in-up stagger-1">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Invoices</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-full">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path>
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200 card-hover animate-fade-in-up stagger-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Paid This Month</p>
                <p className="text-2xl font-bold text-gray-900">${stats.paidThisMonth.toLocaleString()}</p>
              </div>
              <div className="p-3 bg-green-100 rounded-full">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"></path>
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200 card-hover animate-fade-in-up stagger-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Overdue</p>
                <p className="text-2xl font-bold text-gray-900">{stats.overdue}</p>
              </div>
              <div className="p-3 bg-red-100 rounded-full">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200 card-hover animate-fade-in-up stagger-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Pending Review</p>
                <p className="text-2xl font-bold text-gray-900">{stats.pending}</p>
              </div>
              <div className="p-3 bg-amber-100 rounded-full">
                <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Invoice Table */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                Invoice List
                {filteredInvoices.length !== invoices.length && (
                  <span className="ml-2 text-sm font-normal text-gray-500">
                    ({filteredInvoices.length} of {invoices.length})
                  </span>
                )}
              </h3>
              <div className="flex items-center space-x-3">
                <button 
                  onClick={handleExportCSV}
                  className="text-gray-600 hover:text-gray-900 px-3 py-2 text-sm font-medium flex items-center border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Export CSV
                </button>
              </div>
            </div>
          </div>

          {isLoading ? (
            <TableSkeleton rows={10} />
          ) : filteredInvoices.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Invoice #</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Client</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Paid</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Due Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {paginatedInvoices.map((invoice, index) => (
                    <tr key={invoice.id} className={`hover:bg-gray-50 transition-colors animate-fade-in-left stagger-fast-${Math.min(index + 1, 8)}`}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => handleViewInvoice(invoice)}
                          className="text-blue-600 hover:text-blue-800 hover:underline transition-colors"
                        >
                          {invoice.invoiceNumber}
                        </button>
                        {invoice.isLayaway && (
                          <span className="ml-2 text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">Layaway</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {invoice.clientName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        ${invoice.amount.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        ${invoice.paidAmount.toLocaleString()}
                        {invoice.status === 'partial' && (
                          <div className="text-xs text-gray-500 mt-1">
                            {Math.round((invoice.paidAmount / invoice.amount) * 100)}% paid
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(invoice.dueDate)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={getStatusBadge(invoice.status)}>
                          {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex items-center space-x-3">
                          <button
                            onClick={() => handleEditInvoice(invoice)}
                            className="text-indigo-600 hover:text-indigo-900"
                            title="Edit invoice"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleOpenPaymentModal(invoice)}
                            disabled={invoice.status === 'paid'}
                            className="text-green-600 hover:text-green-900 disabled:text-green-400 disabled:cursor-not-allowed"
                            title={invoice.status === 'paid' ? 'Already paid' : 'Record payment'}
                          >
                            {invoice.status === 'paid' ? 'Paid' : 'Pay'}
                          </button>
                          <button
                            onClick={() => handleDeleteClick(invoice)}
                            className="text-red-600 hover:text-red-900"
                            title="Delete invoice"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12">
              <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No invoices found</h3>
              <p className="text-gray-500 mb-4">
                {searchTerm || filter !== 'all' 
                  ? 'Try adjusting your search or filter to find what you\'re looking for.'
                  : 'Get started by creating your first invoice.'}
              </p>
              {!searchTerm && filter === 'all' && (
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                >
                  Create Your First Invoice
                </button>
              )}
            </div>
          )}

          {/* Pagination */}
          {filteredInvoices.length > 0 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={filteredInvoices.length}
              itemsPerPage={itemsPerPage}
              onPageChange={handlePageChange}
              onItemsPerPageChange={handleItemsPerPageChange}
            />
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <p className="text-gray-500 text-sm">© 2024 FinanceFlow Accounting System. Professional invoice and payment management.</p>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <CreateInvoiceModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => {
          fetchInvoices();
          showSuccess('Invoice created successfully!');
        }}
      />

      <EditInvoiceModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setEditingInvoice(null);
        }}
        onSuccess={() => {
          fetchInvoices();
          showSuccess('Invoice updated successfully!');
        }}
        invoice={editingInvoice}
      />

      <ViewInvoiceModal
        isOpen={showViewModal}
        onClose={() => {
          setShowViewModal(false);
          setViewingInvoice(null);
        }}
        invoice={viewingInvoice}
      />

      <PaymentModal
        isOpen={showPaymentModal}
        onClose={() => {
          setShowPaymentModal(false);
          setPaymentInvoice(null);
        }}
        onSuccess={() => {
          fetchInvoices();
          showSuccess('Payment recorded successfully!');
        }}
        invoice={paymentInvoice}
      />

      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => {
          setShowDeleteConfirm(false);
          setDeletingInvoice(null);
        }}
        onConfirm={handleDeleteConfirm}
        title="Delete Invoice"
        message={`Are you sure you want to delete invoice ${deletingInvoice?.invoiceNumber}? This action cannot be undone.`}
        confirmText="Delete Invoice"
        cancelText="Cancel"
        type="danger"
        isLoading={isDeleting}
      />
    </div>
  );
}

export default function InvoicesPage() {
  return (
    <ToastProvider>
      <InvoicesPageContent />
    </ToastProvider>
  );
}
