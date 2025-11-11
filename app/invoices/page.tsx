'use client';

import { useEffect } from 'react';
import Navigation from '../../components/Navigation';
import { 
  CreateInvoiceModal, 
  EditInvoiceModal, 
  ViewInvoiceModal, 
  PaymentModal,
  ConfirmModal,
  ShipInvoiceModal,
} from '../../components/invoices';
import { ToastProvider, useToastContext } from '../../components/ToastContext';
import Pagination from '../../components/Pagination';
import CSVUploadModal from '../../components/CSVUploadModal';
import InvoicePageHeader from '../../components/invoices/InvoicePageHeader';
import InvoiceFiltersNew from '../../components/invoices/InvoiceFiltersNew';
import InvoiceStats from '../../components/invoices/InvoiceStats';
import InvoiceTable from '../../components/invoices/InvoiceTable';
import { useInvoices } from '../../hooks/useInvoices';
import Footer from '@/components/Footer';

function InvoicesPageContent() {
  const { showSuccess, showError, showInfo } = useToastContext();
  
  const {
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
  shippingInvoice,
  setShippingInvoice,
    editingInvoice,
    setEditingInvoice,
    viewingInvoice,
    setViewingInvoice,
    paymentInvoice,
    setPaymentInvoice,
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
  } = useInvoices(showSuccess, showError, showInfo);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + K for search focus
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        const searchInput = document.querySelector('input[placeholder*="Search"]') as HTMLInputElement;
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
  }, [setShowCreateModal]);

  return (
    <div className="bg-gray-50 hero-pattern min-h-screen">
      <Navigation />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <InvoicePageHeader
          stats={stats}
          onCreateClick={() => setShowCreateModal(true)}
          onBulkUploadClick={() => setShowCSVUploadModal(true)}
          onExportClick={handleExportCSV}
          onExportPDF={handleExportPDF}
        />

        {/* Stats Cards */}
        <InvoiceStats 
          stats={stats} 
          showFiltered={filter !== 'all' || searchTerm !== '' || dateRange !== null}
        />

        {/* Filters */}
        <InvoiceFiltersNew
          filter={filter}
          onFilterChange={setFilter}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          sortBy={sortBy}
          onSortChange={setSortBy}
          totalCount={invoices.length}
          filteredCount={filteredInvoices.length}
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
        />

        {/* Table */}
        <InvoiceTable
          invoices={filteredInvoices}
          paginatedInvoices={paginatedInvoices}
          isLoading={isLoading}
          onView={handleViewInvoice}
          onEdit={handleEditInvoice}
          onPay={handleOpenPaymentModal}
          onDelete={handleDeleteClick}
          onShip={handleOpenShipModal}
          onCreateFirst={() => setShowCreateModal(true)}
          searchTerm={searchTerm}
          filter={filter}
          sortBy={sortBy}
          onSortChange={setSortBy}
        />

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

      {/* Footer */}
     <Footer />

      {/* Modals */}
      <CreateInvoiceModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => {
          fetchInvoices();
          showSuccess('Invoice created successfully!');
        }}
        onError={showError}
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

      <ShipInvoiceModal
        isOpen={showShipModal}
        onClose={() => {
          setShowShipModal(false);
          setShippingInvoice(null);
        }}
        invoice={shippingInvoice}
        onSuccess={() => {
          fetchInvoices();
          showSuccess('Shipment created and attached to invoice');
        }}
        onError={showError}
      />

      <CSVUploadModal
        isOpen={showCSVUploadModal}
        onClose={() => setShowCSVUploadModal(false)}
        onSuccess={() => {
          showSuccess('Invoices uploaded successfully!');
          fetchInvoices();
        }}
        title="Bulk Upload Invoices"
        type="invoices"
        templateUrl="/api/invoices/bulk/template"
        validateUrl="/api/invoices/bulk/validate"
        uploadUrl="/api/invoices/bulk/upload"
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
