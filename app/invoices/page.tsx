"use client";

import { useEffect, useState, Suspense } from "react";
import Navigation from "../../components/Navigation";
import {
  CreateInvoiceModal,
  EditInvoiceModal,
  ViewInvoiceModal,
  PaymentModal,
  ConfirmModal,
  ShipInvoiceModal,
  ShipmentDetailsModal,
  LinkPaymentModal,
} from "../../components/invoices";
import { ToastProvider, useToastContext } from "../../components/ToastContext";
import Pagination from "../../components/Pagination";
import CSVUploadModal from "../../components/CSVUploadModal";
import InvoiceStats from "../../components/invoices/InvoiceStats";
import InvoiceTable from "../../components/invoices/InvoiceTable";
import InvoiceToolbar from "../../components/invoices/InvoiceToolbar";
import { useInvoices } from "../../hooks/useInvoices";
import Footer from "@/components/Footer";

function InvoicesPageContent() {
  const { showSuccess, showError, showInfo } = useToastContext();

  const {
    invoices,
    filteredInvoices,
    paginatedInvoices,
    isLoading,
    totalItems,
    statusFilter,
    setStatusFilter,
    typeFilter,
    setTypeFilter,
    searchTerm,
    setSearchTerm,
    sortBy,
    sortDirection,
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
    layawayOverdue,
    setLayawayOverdue,
    customerIdFilter,
    customerNameFilter,
    setCustomerIdFilter,
  } = useInvoices(showSuccess, showError, showInfo);

  // Shipment Details Modal State
  const [showShipmentDetailsModal, setShowShipmentDetailsModal] = useState(false);
  const [viewingShipmentInvoice, setViewingShipmentInvoice] = useState<any>(null);

  // Link Payment Modal State
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkingInvoice, setLinkingInvoice] = useState<any>(null);

  const handleOpenLinkModal = (invoice: any) => {
    setLinkingInvoice(invoice);
    setShowLinkModal(true);
  };

  const handleShipAction = (invoice: any) => {
    if (invoice.shipmentId) {
      setViewingShipmentInvoice(invoice);
      setShowShipmentDetailsModal(true);
    } else {
      handleOpenShipModal(invoice);
    }
  };

  const handlePrintPDF = async (invoice: any) => {
    const { generateSingleInvoicePDF } = await import("../../lib/pdf-export");
    generateSingleInvoicePDF(invoice, "print");
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + K for search focus
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        const searchInput = document.querySelector(
          'input[placeholder*="Search"]'
        ) as HTMLInputElement;
        searchInput?.focus();
      }
      // Cmd/Ctrl + N for new invoice
      if ((e.metaKey || e.ctrlKey) && e.key === "n") {
        e.preventDefault();
        setShowCreateModal(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [setShowCreateModal]);

  return (
    <div className="bg-gray-50 h-screen flex flex-col overflow-hidden">
      <Navigation />

      {/* Fixed Header Section */}
      <div className="flex-none px-4 sm:px-6 lg:px-8 pt-6 pb-4 space-y-4 bg-gray-50 z-10">
        <InvoiceToolbar
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          typeFilter={typeFilter}
          onTypeFilterChange={setTypeFilter}
          layawayOverdue={layawayOverdue}
          onLayawayOverdueChange={setLayawayOverdue}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
          onCreateClick={() => setShowCreateModal(true)}
          onExportClick={handleExportCSV}
          onImportClick={() => setShowCSVUploadModal(true)}
        />
        <InvoiceStats stats={stats} showFiltered={statusFilter !== 'all' || typeFilter !== 'all' || !!searchTerm || !!dateRange} />
        {customerIdFilter && (
          <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span>Showing invoices for <strong>{customerNameFilter || "a specific client"}</strong></span>
            <button
              onClick={() => setCustomerIdFilter(null)}
              className="ml-auto text-blue-600 hover:text-blue-800 font-medium"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      <main className="flex-1 px-4 sm:px-6 lg:px-8 pb-4 min-h-0 flex flex-col">
        <div className="flex-1 min-h-0">
          <InvoiceTable
            invoices={filteredInvoices}
            paginatedInvoices={paginatedInvoices}
            isLoading={isLoading}
            onView={handleViewInvoice}
            onEdit={handleEditInvoice}
            onPay={handleOpenPaymentModal}
            onLink={handleOpenLinkModal}
            onDelete={handleDeleteClick}
            onShip={handleShipAction}
            onFilterByClient={setCustomerIdFilter}
            onPrintPDF={handlePrintPDF}
            onCreateFirst={() => setShowCreateModal(true)}
            searchTerm={searchTerm}
            statusFilter={statusFilter}
            typeFilter={typeFilter}
            sortBy={sortBy}
            sortDirection={sortDirection}
            onSortChange={setSortBy}
          >
            {/* Pagination */}
            {!isLoading && (
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={handlePageChange}
                itemsPerPage={itemsPerPage}
                onItemsPerPageChange={handleItemsPerPageChange}
                totalItems={totalItems}
              />
            )}
          </InvoiceTable>
        </div>
      </main>

      {/* Modals */}
      <CreateInvoiceModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => {
          fetchInvoices();
          showSuccess("Invoice created successfully!");
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
          showSuccess("Invoice updated successfully!");
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
          showSuccess("Payment recorded successfully!");
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
        title="Deactivate Invoice"
        message={`Are you sure you want to deactivate invoice ${deletingInvoice?.invoiceNumber}? It will be marked as inactive and hidden from default views.`}
        confirmText="Deactivate Invoice"
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
          showSuccess("Shipment created and attached to invoice");
        }}
        onError={showError}
      />

      <LinkPaymentModal
        isOpen={showLinkModal}
        onClose={() => {
          setShowLinkModal(false);
          setLinkingInvoice(null);
        }}
        invoice={linkingInvoice}
        onSuccess={() => {
          fetchInvoices();
          showSuccess("Payment linked successfully!");
        }}
      />

      <CSVUploadModal
        isOpen={showCSVUploadModal}
        onClose={() => setShowCSVUploadModal(false)}
        onSuccess={() => {
          showSuccess("Invoices uploaded successfully!");
          fetchInvoices();
        }}
        title="Bulk Upload Invoices"
        type="invoices"
        templateUrl="/api/invoices/bulk/template"
        validateUrl="/api/invoices/bulk/validate"
        uploadUrl="/api/invoices/bulk/upload"
      />

      {viewingShipmentInvoice && (
        <ShipmentDetailsModal
          invoice={viewingShipmentInvoice}
          onClose={() => {
            setShowShipmentDetailsModal(false);
            setViewingShipmentInvoice(null);
          }}
          onUpdate={() => {
            setShowShipmentDetailsModal(false);
            // Slight delay to allow the first modal to close cleanly before opening the next
            setTimeout(() => {
              handleOpenShipModal(viewingShipmentInvoice);
              setViewingShipmentInvoice(null);
            }, 100);
          }}
        />
      )}
    </div>
  );
}

export default function InvoicesPage() {
  return (
    <ToastProvider>
      <Suspense fallback={<div className="h-screen flex items-center justify-center">Loading invoices...</div>}>
        <InvoicesPageContent />
      </Suspense>
    </ToastProvider>
  );
}
