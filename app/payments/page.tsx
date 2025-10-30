'use client';

import Navigation from '../../components/Navigation';
import Pagination from '../../components/Pagination';
import { RecordPaymentModal, ViewPaymentModal } from '../../components/payments';
import { ToastProvider, useToastContext } from '../../components/ToastContext';
import CSVUploadModal from '../../components/CSVUploadModal';
import PaymentPageHeader from '../../components/payments/PaymentPageHeader';
import PaymentSourceCards from '../../components/payments/PaymentSourceCards';
import PaymentFiltersNew from '../../components/payments/PaymentFiltersNew';
import PaymentTable from '../../components/payments/PaymentTable';
import { usePayments } from '../../hooks/usePayments';

function PaymentsPageContent() {
  const { showSuccess, showError } = useToastContext();
  
  const {
    filteredPayments,
    paginatedPayments,
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
    itemsPerPage,
    showRecordModal,
    setShowRecordModal,
    showViewModal,
    setShowViewModal,
    showCSVUploadModal,
    setShowCSVUploadModal,
    viewingPayment,
    setViewingPayment,
    fetchPayments,
    handlePageChange,
    handleItemsPerPageChange,
    handleExportPDF,
    stats,
    filteredStats,
  } = usePayments(showSuccess, showError);

  // Check if any filters are active
  const isFiltered = 
    filterMethod !== 'all' || 
    searchQuery.trim() !== '' || 
    dateRange !== null;

  return (
    <div className="bg-gray-50 hero-pattern min-h-screen">
      <Navigation />

      {/* Page Header */}
      <PaymentPageHeader
        unmatchedCount={unmatchedCount}
        totalToday={stats.totalToday}
        onRecordClick={() => setShowRecordModal(true)}
        onBulkUploadClick={() => setShowCSVUploadModal(true)}
        onExportPDF={handleExportPDF}
      />

      {/* Payment Sources */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <PaymentSourceCards
          stats={stats}
          filteredStats={filteredStats}
          filterMethod={filterMethod}
          onFilterChange={setFilterMethod}
          showFiltered={isFiltered}
        />

        {/* Filter Buttons */}
        <PaymentFiltersNew
          filterMethod={filterMethod}
          onFilterChange={setFilterMethod}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
          onExportPDF={handleExportPDF}
        />

        {/* Payment History Table */}
        <PaymentTable
          payments={filteredPayments}
          paginatedPayments={paginatedPayments}
          isLoading={isLoading}
          sortBy={sortBy}
          sortDirection={sortDirection}
          onSort={handleSort}
        />

        {filteredPayments.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filteredPayments.length}
            itemsPerPage={itemsPerPage}
            onPageChange={handlePageChange}
            onItemsPerPageChange={handleItemsPerPageChange}
          />
        )}
      </div>

      <RecordPaymentModal
        isOpen={showRecordModal}
        onClose={() => setShowRecordModal(false)}
        onSuccess={() => {
          fetchPayments();
          showSuccess('Payment recorded successfully!');
        }}
      />

      <ViewPaymentModal
        isOpen={showViewModal}
        onClose={() => {
          setShowViewModal(false);
          setViewingPayment(null);
        }}
        payment={viewingPayment}
      />

      <CSVUploadModal
        isOpen={showCSVUploadModal}
        onClose={() => setShowCSVUploadModal(false)}
        onSuccess={() => {
          showSuccess('Payments uploaded successfully! Use Payment Matching to link them to invoices.');
          fetchPayments();
        }}
        title="Bulk Upload Payments"
        type="payments"
        templateUrl="/api/payments/bulk/template"
        validateUrl="/api/payments/bulk/validate"
        uploadUrl="/api/payments/bulk/upload"
      />

      <footer className="bg-white border-t border-gray-200 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <p className="text-gray-500 text-sm">
              © 2024 FinanceFlow Accounting System. Professional invoice and payment management.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function PaymentsPage() {
  return (
    <ToastProvider>
      <PaymentsPageContent />
    </ToastProvider>
  );
}
