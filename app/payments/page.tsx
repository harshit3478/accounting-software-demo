'use client';

import { useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import Navigation from '../../components/Navigation';
import Pagination from '../../components/Pagination';
import { RecordPaymentModal, ViewPaymentModal, LinkInvoiceModal } from '../../components/payments';
import { ToastProvider, useToastContext } from '../../components/ToastContext';
import CSVUploadModal from '../../components/CSVUploadModal';
import PaymentToolbar from '../../components/payments/PaymentToolbar';
import PaymentSourceCards from '../../components/payments/PaymentSourceCards';
import PaymentTable from '../../components/payments/PaymentTable';
import { usePayments } from '../../hooks/usePayments';
import Footer from '@/components/Footer';

function PaymentsPageContent() {
  const router = useRouter();
  const { showSuccess, showError } = useToastContext();
  const [isSyncing, setIsSyncing] = useState(false);

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
    totalItems,
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
    paymentMethods,
  } = usePayments();

  // Link Invoice Modal State
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkingPayment, setLinkingPayment] = useState<any>(null);

  const handleOpenLinkModal = (payment: any) => {
    setLinkingPayment(payment);
    setShowLinkModal(true);
  };

  const handleSync = async () => {
    showSuccess('Sync started...');
    setIsSyncing(true);
    try {
      const res = await fetch('/api/quickbooks/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          daysBack: 30 // Sync last 30 days
        })
      });
      
      const data = await res.json();
      
      if (res.ok) {
        showSuccess(`Sync complete! Created: ${data.created}, Updated: ${data.updated}`);
        fetchPayments(); // Refresh payments list
      } else {
        showError(`Sync failed: ${data.error}`);
      }
    } catch (error) {
      console.error('Sync error:', error);
      showError('Failed to sync with QuickBooks');
    } finally {
      setIsSyncing(false);
    }
  };

  // Check if any filters are active
  const isFiltered = 
    filterMethod !== 'all' || 
    searchQuery.trim() !== '' || 
    dateRange !== null;

  return (
    <div className="bg-gray-50 h-screen flex flex-col overflow-hidden">
      <Navigation />

      {/* Fixed Header Section */}
      <div className="flex-none px-4 sm:px-6 lg:px-8 pt-6 pb-4 space-y-4 bg-gray-50 z-10">
        <PaymentToolbar
          filterMethod={filterMethod}
          onFilterChange={setFilterMethod}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
          onRecordClick={() => setShowRecordModal(true)}
          onExportClick={handleExportPDF}
          onImportClick={() => setShowCSVUploadModal(true)}
          onSyncClick={handleSync}
          isSyncing={isSyncing}
          onMatchClick={() => router.push('/payments/matching')}
          unmatchedCount={unmatchedCount}
          paymentMethods={paymentMethods}
        />
        <PaymentSourceCards
          stats={stats}
          filteredStats={filteredStats}
          filterMethod={filterMethod}
          onFilterChange={setFilterMethod}
          showFiltered={isFiltered}
          paymentMethods={paymentMethods}
        />
      </div>

      <main className="flex-1 px-4 sm:px-6 lg:px-8 pb-4 min-h-0 flex flex-col">
        <div className="flex-1 min-h-0">
          <PaymentTable
            payments={filteredPayments}
            paginatedPayments={paginatedPayments}
            isLoading={isLoading}
            sortBy={sortBy}
            sortDirection={sortDirection}
            onSort={handleSort}
            onLink={handleOpenLinkModal}
            totalItems={totalItems}
          >
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={totalItems}
              itemsPerPage={itemsPerPage}
              onPageChange={handlePageChange}
              onItemsPerPageChange={handleItemsPerPageChange}
            />
          </PaymentTable>
        </div>
      </main>

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

      <LinkInvoiceModal
        isOpen={showLinkModal}
        onClose={() => {
          setShowLinkModal(false);
          setLinkingPayment(null);
        }}
        payment={linkingPayment}
        onSuccess={() => {
          fetchPayments();
          showSuccess("Invoice linked successfully!");
        }}
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
    </div>
  );
}

export default function PaymentsPage() {
  return (
    <ToastProvider>
      <Suspense fallback={<div className="h-screen flex items-center justify-center">Loading payments...</div>}>
        <PaymentsPageContent />
      </Suspense>
    </ToastProvider>
  );
}
