'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Navigation from '../../components/Navigation';
import Pagination from '../../components/Pagination';
import { RecordPaymentModal, ViewPaymentModal } from '../../components/payments';
import { ToastProvider, useToastContext } from '../../components/ToastContext';
import TableSkeleton from '../../components/TableSkeleton';
import CSVUploadModal from '../../components/CSVUploadModal';

interface Payment {
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

interface PaymentStats {
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

interface Invoice {
  id: number;
  invoiceNumber: string;
  clientName: string;
  amount: number;
  paidAmount: number;
  status: string;
}

function PaymentsPageContent() {
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
  const [filterMethod, setFilterMethod] = useState<'all' | 'cash' | 'zelle' | 'quickbooks' | 'layaway'>('all');
  const [isLoading, setIsLoading] = useState(true);
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  
  // Modal states
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showCSVUploadModal, setShowCSVUploadModal] = useState(false);
  const [viewingPayment, setViewingPayment] = useState<Payment | null>(null);

  const { showSuccess, showError } = useToastContext();

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

  const fetchPayments = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/payments');
      if (res.ok) {
        const data = await res.json();
        setPayments(data.map((payment: any) => ({
          ...payment,
          paymentDate: payment.paymentDate ? new Date(payment.paymentDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
          createdAt: payment.createdAt ? new Date(payment.createdAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        })));

        // Calculate today's stats
        const today = new Date().toISOString().split('T')[0];
        const todayPayments = data.filter((p: any) => {
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
      }
    } catch (error) {
      console.error('Failed to fetch payments:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
    fetchUnmatchedCount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleViewPayment = (payment: Payment) => {
    setViewingPayment(payment);
    setShowViewModal(true);
  };

  const filteredPayments = payments.filter(payment => {
    if (filterMethod === 'all') return true;
    return payment.method === filterMethod;
  });

  // Pagination logic
  const totalPages = Math.ceil(filteredPayments.length / itemsPerPage);
  const paginatedPayments = filteredPayments.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Reset to page 1 when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filterMethod]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleItemsPerPageChange = (items: number) => {
    setItemsPerPage(items);
    setCurrentPage(1);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getMethodBadgeClass = (method: string) => {
    const classes = {
      cash: 'bg-amber-100 text-amber-800',
      zelle: 'bg-green-100 text-green-800',
      quickbooks: 'bg-blue-100 text-blue-800',
      layaway: 'bg-purple-100 text-purple-800',
    };
    return `px-2 py-1 rounded-full text-xs font-medium ${classes[method as keyof typeof classes]}`;
  };

  const paymentSources = [
    {
      id: 'zelle',
      name: 'Zelle Payments',
      amount: stats.zelleToday,
      count: `${stats.zelleCount} payment${stats.zelleCount !== 1 ? 's' : ''}`,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"></path>
        </svg>
      ),
      iconBg: 'bg-green-100',
      iconColor: 'text-green-600',
      label: 'Today'
    },
    {
      id: 'credit-card',
      name: 'QuickBooks',
      amount: stats.quickbooksToday,
      count: `${stats.quickbooksCount} payment${stats.quickbooksCount !== 1 ? 's' : ''}`,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"></path>
        </svg>
      ),
      iconBg: 'bg-blue-100',
      iconColor: 'text-blue-600',
      label: 'Auto'
    },
    {
      id: 'cash',
      name: 'Cash Payments',
      amount: stats.cashToday,
      count: `${stats.cashCount} payment${stats.cashCount !== 1 ? 's' : ''}`,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path>
        </svg>
      ),
      iconBg: 'bg-amber-100',
      iconColor: 'text-amber-600',
      label: 'Manual'
    },
    {
      id: 'layaway',
      name: 'Layaway',
      amount: stats.layawayToday,
      count: `${stats.layawayCount} payment${stats.layawayCount !== 1 ? 's' : ''}`,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
      ),
      iconBg: 'bg-purple-100',
      iconColor: 'text-purple-600',
      label: 'Schedule'
    }
  ];

  const mockMatches = [
    {
      id: 1,
      payment: { amount: 1250, source: 'Zelle', client: 'Acme Corporation', date: '2024-01-15' },
      invoice: { id: 'INV-2024-0015', amount: 1250, client: 'Acme Corporation' },
      confidence: 95,
      status: 'suggested'
    },
    {
      id: 2,
      payment: { amount: 850, source: 'Credit Card', client: 'TechStart Inc', date: '2024-01-14' },
      invoice: { id: 'INV-2024-0023', amount: 850, client: 'TechStart Inc' },
      confidence: 88,
      status: 'suggested'
    }
  ];

  return (
    <div className="bg-gray-50 hero-pattern min-h-screen">
      <Navigation />

      {/* Page Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div>
                <h2 className="text-3xl font-bold text-gray-900">Payment Processing</h2>
                {/* <p className="text-gray-600 mt-2">Upload, match, and reconcile payments from multiple sources</p> */}
              </div>
              {/* Payment Matching Link Icon */}
              <Link
                href="/payments/matching"
                className="flex items-center gap-2 px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors border border-purple-200"
                title="Payment Matching"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                </svg>
                <span className="text-sm font-medium">Match Payments</span>
                {unmatchedCount > 0 && (
                  <span className="bg-purple-600 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                    {unmatchedCount > 99 ? '99+' : unmatchedCount}
                  </span>
                )}
              </Link>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setShowCSVUploadModal(true)}
                className="px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
                </svg>
                Bulk Upload
              </button>
              <button
                onClick={() => setShowRecordModal(true)}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path>
                </svg>
                Record New Payment
              </button>
              <div className="text-right">
                <p className="text-sm text-gray-500">Processed Today</p>
                <p className="text-2xl font-bold text-gray-900">${stats.totalToday.toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Payment Sources */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          {paymentSources.map((source, index) => (
            <div
              key={source.id}
              onClick={() => setFilterMethod(source.id as any)}
              className={`bg-white p-6 rounded-xl shadow-lg border border-gray-200 card-hover cursor-pointer animate-fade-in-up stagger-${index + 1} ${
                filterMethod === source.id ? 'ring-2 ring-blue-500' : ''
              }`}
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`p-3 ${source.iconBg} rounded-full`}>
                  <div className={source.iconColor}>{source.icon}</div>
                </div>
                <span className="text-sm text-gray-500">{source.label}</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">{source.name}</h3>
              <p className="text-2xl font-bold text-gray-900 mb-2">${source.amount.toFixed(2)}</p>
              <p className="text-sm text-gray-600">{source.count}</p>
            </div>
          ))}
        </div>

        {/* Filter Buttons */}
        <div className="mb-6 flex items-center space-x-3">
          <button
            onClick={() => setFilterMethod('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filterMethod === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All Payments
          </button>
          <button
            onClick={() => setFilterMethod('cash')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filterMethod === 'cash'
                ? 'bg-amber-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Cash
          </button>
          <button
            onClick={() => setFilterMethod('zelle')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filterMethod === 'zelle'
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Zelle
          </button>
          <button
            onClick={() => setFilterMethod('quickbooks')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filterMethod === 'quickbooks'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            QuickBooks
          </button>
          <button
            onClick={() => setFilterMethod('layaway')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filterMethod === 'layaway'
                ? 'bg-purple-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Layaway
          </button>
        </div>

        {/* Payment History Table */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 mb-8">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Payment History</h3>
              <span className="text-sm text-gray-500">
                {filteredPayments.length} payment{filteredPayments.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            {isLoading ? (
              <TableSkeleton rows={10} />
            ) : filteredPayments.length === 0 ? (
              <div className="p-12 text-center">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"></path>
                </svg>
                <p className="text-gray-500 mt-4">No payments found</p>
                <p className="text-sm text-gray-400 mt-1">Record your first payment from an invoice</p>
              </div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Invoice</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Client</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Method</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Notes</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {paginatedPayments.map((payment, index) => (
                    <tr key={payment.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {formatDate(payment.paymentDate)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {payment.invoice ? (
                          payment.invoice.invoiceNumber
                        ) : payment.paymentMatches && payment.paymentMatches.length > 0 ? (
                          <div className="flex flex-col space-y-1">
                            {payment.paymentMatches.map((match) => (
                              <span key={match.id} className="text-blue-600">
                                {match.invoice.invoiceNumber}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-gray-400">No invoice</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {payment.invoice ? (
                          payment.invoice.clientName
                        ) : payment.paymentMatches && payment.paymentMatches.length > 0 ? (
                          <div className="flex flex-col space-y-1">
                            {payment.paymentMatches.map((match) => (
                              <span key={match.id}>
                                {match.invoice.clientName}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                        ${payment.amount.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={getMethodBadgeClass(payment.method)}>
                          {payment.method.charAt(0).toUpperCase() + payment.method.slice(1)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate">
                        {payment.notes || <span className="text-gray-400">-</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination */}
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
      </div>

      {/* Modals */}
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

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <p className="text-gray-500 text-sm">© 2024 FinanceFlow Accounting System. Professional invoice and payment management.</p>
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