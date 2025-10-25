'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navigation from '../../../components/Navigation';
import { ToastProvider, useToastContext } from '../../../components/ToastContext';

interface Payment {
  id: number;
  amount: number;
  method: 'cash' | 'zelle' | 'quickbooks' | 'layaway';
  paymentDate: string;
  notes: string | null;
  isMatched: boolean;
  paymentMatches: any[];
}

interface Invoice {
  id: number;
  invoiceNumber: string;
  clientName: string;
  amount: number;
  paidAmount: number;
  remaining: number;
  status: string;
  dueDate: string;
}

interface Suggestion {
  invoice: Invoice;
  confidence: number;
  reason: string;
}

function PaymentMatchingPageContent() {
  const router = useRouter();
  const { showSuccess, showError } = useToastContext();
  
  const [unmatchedPayments, setUnmatchedPayments] = useState<Payment[]>([]);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [searchResults, setSearchResults] = useState<Invoice[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [matchingInvoice, setMatchingInvoice] = useState<Invoice | null>(null);
  const [matchAmount, setMatchAmount] = useState('');
  const [isMatching, setIsMatching] = useState(false);
  
  const [summary, setSummary] = useState({ count: 0, totalAmount: 0 });

  useEffect(() => {
    fetchUnmatchedPayments();
  }, []);

  useEffect(() => {
    if (selectedPayment) {
      fetchSuggestions(selectedPayment.id);
      setSearchQuery('');
      setSearchResults([]);
    }
  }, [selectedPayment]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.trim()) {
        searchInvoices(searchQuery);
      } else {
        setSearchResults([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchUnmatchedPayments = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/payments/unmatched');
      if (res.ok) {
        const data = await res.json();
        setUnmatchedPayments(data.payments);
        setSummary(data.summary);
        if (data.payments.length > 0 && !selectedPayment) {
          setSelectedPayment(data.payments[0]);
        }
      } else {
        showError('Failed to fetch unmatched payments');
      }
    } catch (error) {
      console.error('Failed to fetch unmatched payments:', error);
      showError('Failed to fetch unmatched payments');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSuggestions = async (paymentId: number) => {
    setIsLoadingSuggestions(true);
    try {
      const res = await fetch(`/api/payments/${paymentId}/suggestions`);
      if (res.ok) {
        const data = await res.json();
        setSuggestions(data.suggestions);
      }
    } catch (error) {
      console.error('Failed to fetch suggestions:', error);
    } finally {
      setIsLoadingSuggestions(false);
    }
  };

  const searchInvoices = async (query: string) => {
    setIsSearching(true);
    try {
      const res = await fetch(`/api/invoices/search?q=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.invoices);
      }
    } catch (error) {
      console.error('Failed to search invoices:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleMatchFull = async (invoice: Invoice) => {
    if (!selectedPayment) return;

    const alreadyAllocated = selectedPayment.paymentMatches.reduce((sum: number, m: any) => sum + m.amount, 0);
    const remaining = selectedPayment.amount - alreadyAllocated;
    const matchAmt = Math.min(remaining, invoice.remaining);

    setMatchingInvoice(invoice);
    setMatchAmount(matchAmt.toFixed(2));
    setShowMatchModal(true);
  };

  const handleMatchPartial = (invoice: Invoice) => {
    setMatchingInvoice(invoice);
    setMatchAmount('');
    setShowMatchModal(true);
  };

  const confirmMatch = async () => {
    if (!selectedPayment || !matchingInvoice || !matchAmount) return;

    const amount = parseFloat(matchAmount);
    if (isNaN(amount) || amount <= 0) {
      showError('Please enter a valid amount');
      return;
    }

    const alreadyAllocated = selectedPayment.paymentMatches.reduce((sum: number, m: any) => sum + m.amount, 0);
    const remaining = selectedPayment.amount - alreadyAllocated;

    if (amount > remaining) {
      showError(`Amount exceeds remaining payment balance ($${remaining.toFixed(2)})`);
      return;
    }

    if (amount > matchingInvoice.remaining) {
      showError(`Amount exceeds invoice remaining balance ($${matchingInvoice.remaining.toFixed(2)})`);
      return;
    }

    setIsMatching(true);
    try {
      const res = await fetch(`/api/payments/${selectedPayment.id}/match`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matches: [
            {
              invoiceId: matchingInvoice.id,
              amount
            }
          ]
        })
      });

      if (res.ok) {
        showSuccess(`Payment matched to ${matchingInvoice.invoiceNumber}`);
        setShowMatchModal(false);
        setMatchingInvoice(null);
        setMatchAmount('');
        await fetchUnmatchedPayments();
      } else {
        const error = await res.json();
        showError(error.error || 'Failed to match payment');
      }
    } catch (error) {
      console.error('Failed to match payment:', error);
      showError('Failed to match payment');
    } finally {
      setIsMatching(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getMethodColor = (method: string) => {
    const colors = {
      cash: 'bg-amber-100 text-amber-700',
      zelle: 'bg-green-100 text-green-700',
      quickbooks: 'bg-blue-100 text-blue-700',
      layaway: 'bg-purple-100 text-purple-700'
    };
    return colors[method as keyof typeof colors] || 'bg-gray-100 text-gray-700';
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 90) return 'text-green-600';
    if (confidence >= 70) return 'text-blue-600';
    return 'text-gray-600';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">🔗 Payment Matching</h1>
              <p className="text-gray-600 mt-2">
                {summary.count} unmatched payment{summary.count !== 1 ? 's' : ''} • ${summary.totalAmount.toLocaleString()} total
              </p>
            </div>
            <button
              onClick={() => router.push('/payments')}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
            >
              ← Back to Payments
            </button>
          </div>
        </div>
      </div>

      {unmatchedPayments.length === 0 ? (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center">
            <svg className="w-16 h-16 text-green-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">All Payments Matched!</h2>
            <p className="text-gray-600">There are no unmatched payments at the moment.</p>
          </div>
        </div>
      ) : (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Unmatched Payments */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-200">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">Unmatched Payments</h2>
                <p className="text-sm text-gray-500 mt-1">Select a payment to match</p>
              </div>
              <div className="divide-y divide-gray-200 max-h-[600px] overflow-y-auto">
                {unmatchedPayments.map((payment) => (
                  <div
                    key={payment.id}
                    onClick={() => setSelectedPayment(payment)}
                    className={`p-4 cursor-pointer transition-colors ${
                      selectedPayment?.id === payment.id
                        ? 'bg-blue-50 border-l-4 border-blue-600'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-2xl font-bold text-gray-900">
                        ${payment.amount.toFixed(2)}
                      </span>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getMethodColor(payment.method)}`}>
                        {payment.method.charAt(0).toUpperCase() + payment.method.slice(1)}
                      </span>
                    </div>
                    <div className="flex items-center text-sm text-gray-600">
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                      </svg>
                      {formatDate(payment.paymentDate)}
                    </div>
                    {payment.notes && (
                      <p className="text-xs text-gray-500 mt-1 truncate">{payment.notes}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Match to Invoices */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-200">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Match to Invoice</h2>
                
                {/* Search Bar */}
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search by client name or invoice number..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border  border-gray-300 rounded-lg text-gray-900 focus:ring-0 focus:ring-gray-900 focus:border-gray-900"
                  />
                  <svg className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                  </svg>
                  {isSearching && (
                    <div className="absolute right-3 top-2.5">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                    </div>
                  )}
                </div>
              </div>

              <div className="max-h-[520px] overflow-y-auto">
                {/* Smart Suggestions */}
                {!searchQuery && suggestions.length > 0 && (
                  <div className="p-4 bg-blue-50 border-b border-blue-100">
                    <div className="flex items-center mb-3">
                      <svg className="w-5 h-5 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                      </svg>
                      <h3 className="text-sm font-semibold text-blue-900">Smart Suggestions</h3>
                    </div>
                    {isLoadingSuggestions ? (
                      <div className="flex items-center justify-center py-4">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {suggestions.map((suggestion) => (
                          <div
                            key={suggestion.invoice.id}
                            className="bg-white rounded-lg p-3 border border-blue-200 hover:border-blue-400 transition-colors"
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-gray-900">
                                    {suggestion.invoice.invoiceNumber}
                                  </span>
                                  <span className={`text-xs font-medium ${getConfidenceColor(suggestion.confidence)}`}>
                                    {suggestion.confidence}%
                                  </span>
                                </div>
                                <p className="text-sm text-gray-600">{suggestion.invoice.clientName}</p>
                                <p className="text-xs text-gray-500 mt-1">{suggestion.reason}</p>
                              </div>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-gray-700">
                                Remaining: <span className="font-semibold">${suggestion.invoice.remaining.toFixed(2)}</span>
                              </span>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleMatchFull(suggestion.invoice)}
                                  className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors"
                                >
                                  Match
                                </button>
                                <button
                                  onClick={() => handleMatchPartial(suggestion.invoice)}
                                  className="px-3 py-1 bg-gray-100 text-gray-700 text-xs rounded hover:bg-gray-200 transition-colors"
                                >
                                  Partial
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Search Results */}
                {searchQuery && (
                  <div className="p-4">
                    {searchResults.length === 0 ? (
                      <p className="text-center text-gray-500 py-8">
                        {isSearching ? 'Searching...' : 'No invoices found'}
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {searchResults.map((invoice) => (
                          <div
                            key={invoice.id}
                            className="bg-gray-50 rounded-lg p-3 border border-gray-200 hover:border-gray-300 transition-colors"
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex-1">
                                <span className="font-semibold text-gray-900">{invoice.invoiceNumber}</span>
                                <p className="text-sm text-gray-600">{invoice.clientName}</p>
                              </div>
                              <span className={`px-2 py-1 text-xs rounded ${
                                invoice.status === 'overdue' ? 'bg-red-100 text-red-700' :
                                invoice.status === 'partial' ? 'bg-yellow-100 text-yellow-700' :
                                'bg-gray-100 text-gray-700'
                              }`}>
                                {invoice.status}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-gray-700">
                                Remaining: <span className="font-semibold">${invoice.remaining.toFixed(2)}</span>
                              </span>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleMatchFull(invoice)}
                                  className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors"
                                >
                                  Match
                                </button>
                                <button
                                  onClick={() => handleMatchPartial(invoice)}
                                  className="px-3 py-1 bg-gray-100 text-gray-700 text-xs rounded hover:bg-gray-200 transition-colors"
                                >
                                  Partial
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {!searchQuery && suggestions.length === 0 && !isLoadingSuggestions && (
                  <div className="p-8 text-center text-gray-500">
                    <svg className="w-12 h-12 mx-auto mb-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                    </svg>
                    <p>No suggestions available</p>
                    <p className="text-sm mt-1">Search for invoices above</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Match Confirmation Modal */}
      {showMatchModal && matchingInvoice && selectedPayment && (
        <div className="fixed inset-0  backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-xl font-semibold text-gray-900">Confirm Match</h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <p className="text-sm text-gray-600">Payment</p>
                <p className="text-lg font-semibold text-gray-900">${selectedPayment.amount.toFixed(2)} via {selectedPayment.method}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Invoice</p>
                <p className="text-lg font-semibold text-gray-900">{matchingInvoice.invoiceNumber}</p>
                <p className="text-sm text-gray-600">{matchingInvoice.clientName}</p>
                <p className="text-sm text-gray-600">Remaining: ${matchingInvoice.remaining.toFixed(2)}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Match Amount
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={matchAmount}
                  onChange={(e) => setMatchAmount(e.target.value)}
                  className="w-full border text-gray-900 border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter amount"
                />
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowMatchModal(false);
                  setMatchingInvoice(null);
                  setMatchAmount('');
                }}
                disabled={isMatching}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmMatch}
                disabled={isMatching || !matchAmount}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isMatching ? 'Matching...' : 'Confirm Match'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PaymentMatchingPage() {
  return (
    <ToastProvider>
      <PaymentMatchingPageContent />
    </ToastProvider>
  );
}
