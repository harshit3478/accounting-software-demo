'use client';

import { useState, useEffect, useMemo } from 'react';
import Modal from './Modal';

interface Invoice {
  id: number;
  invoiceNumber: string;
  clientName: string;
  amount: number;
  paidAmount: number;
}

interface Payment {
  id: number;
  amount: string | number;
  paymentDate: string;
  method: string;
  notes?: string;
  user?: { name: string };
  paymentMatches: { amount: string | number }[];
}

interface LinkPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  invoice: Invoice | null;
}

export default function LinkPaymentModal({ isOpen, onClose, onSuccess, invoice }: LinkPaymentModalProps) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLinking, setIsLinking] = useState(false);
  const [selectedPaymentId, setSelectedPaymentId] = useState<number | null>(null);
  const [linkAmount, setLinkAmount] = useState<number>(0);
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch unmatched payments when modal opens
  useEffect(() => {
    if (isOpen && invoice) {
      setIsLoading(true);
      fetch('/api/payments/unmatched')
        .then((res) => res.json())
        .then((data) => {
          if (data && Array.isArray(data.payments)) {
            setPayments(data.payments);
          } else if (Array.isArray(data)) {
            setPayments(data);
          } else {
            console.error('Expected array of payments, got:', data);
            setPayments([]);
          }
          setIsLoading(false);
        })
        .catch((err) => {
          console.error('Failed to fetch payments:', err);
          setIsLoading(false);
        });
      
      // Reset state
      setSelectedPaymentId(null);
      setLinkAmount(0);
      setSearchTerm('');
    }
  }, [isOpen, invoice]);

  // Calculate available balance for a payment
  const getPaymentBalance = (payment: Payment) => {
    const totalAmount = Number(payment.amount);
    const usedAmount = payment.paymentMatches.reduce((sum, match) => sum + Number(match.amount), 0);
    return totalAmount - usedAmount;
  };

  const processedPayments = useMemo(() => {
    return payments.map(p => ({
        ...p,
        availableBalance: getPaymentBalance(p)
    })).filter(p => p.availableBalance > 0);
  }, [payments]);

  const filteredPayments = useMemo(() => {
    return processedPayments.filter(payment => {
      const searchLower = searchTerm.toLowerCase();
      const notes = payment.notes?.toLowerCase() || '';
      const method = payment.method.toLowerCase();
      const amount = payment.amount.toString();
      
      return (
        notes.includes(searchLower) ||
        method.includes(searchLower) ||
        amount.includes(searchLower)
      );
    }).sort((a, b) => {
        // Smart sorting: Exact matches of invoice remaining balance float to top
        if (!invoice) return 0;
        const remaining = invoice.amount - invoice.paidAmount;
        const diffA = Math.abs(a.availableBalance - remaining);
        const diffB = Math.abs(b.availableBalance - remaining);
        
        // If one is very close (within 0.01), prioritize it
        if (diffA < 0.01 && diffB > 0.01) return -1;
        if (diffB < 0.01 && diffA > 0.01) return 1;

        // Otherwise sort by date desc
        return new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime();
    });
  }, [processedPayments, searchTerm, invoice]);

  const handleSelectPayment = (payment: Payment & { availableBalance: number }) => {
    if (!invoice) return;
    setSelectedPaymentId(payment.id);
    
    // Auto-calculate amount to link: min(invoiceRemaining, paymentAvailable)
    const invoiceRemaining = invoice.amount - invoice.paidAmount;
    const maxLinkable = Math.min(invoiceRemaining, payment.availableBalance);
    setLinkAmount(maxLinkable);
  };

  const handleLinkPayment = async () => {
    if (!invoice || !selectedPaymentId || linkAmount <= 0) return;

    setIsLinking(true);
    try {
      const res = await fetch('/api/payments/link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          paymentId: selectedPaymentId,
          invoiceId: invoice.id,
          amount: linkAmount,
        }),
      });

      const data = await res.json();
      
      if (res.ok) {
        onSuccess();
        onClose();
      } else {
        alert(data.error || 'Failed to link payment');
      }
    } catch (error) {
      console.error('Error linking payment:', error);
      alert('An error occurred while linking payment');
    } finally {
      setIsLinking(false);
    }
  };

  if (!invoice) return null;

  const invoiceRemaining = invoice.amount - invoice.paidAmount;
  const selectedPayment = processedPayments.find(p => p.id === selectedPaymentId);

  const footer = (
    <div className="flex justify-end space-x-4">
      <button
        onClick={onClose}
        className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-100 transition-colors"
        disabled={isLinking}
      >
        Cancel
      </button>
      <button
        onClick={handleLinkPayment}
        disabled={isLinking || !selectedPaymentId || linkAmount <= 0}
        className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:bg-blue-400 disabled:cursor-not-allowed flex items-center"
      >
        {isLinking ? 'Linking...' : 'Link Payment'}
      </button>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Link Payment to Invoice ${invoice.invoiceNumber}`}
      footer={footer}
    >
      <div className="flex flex-col h-full">
        {/* Compact Header Stats */}
        <div className="flex items-center justify-between py-2 border-b border-gray-100 mb-4">
            <div className="flex flex-col">
                <span className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Invoice Client</span>
                <span className="text-sm font-medium text-gray-900">{invoice.clientName}</span>
            </div>
            <div className="flex flex-col items-end">
                <span className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Remaining Due</span>
                <span className="text-lg font-bold text-blue-600">${invoiceRemaining.toFixed(2)}</span>
            </div>
        </div>

        {/* Minimal Search */}
        <div className="relative mb-2">
            <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
            <input
                type="text"
                placeholder="Search payments..."
                className="w-full pl-9 pr-4 py-2 bg-gray-50 border-none rounded-lg text-sm focus:ring-1 focus:ring-blue-500 placeholder-gray-400 transition-all font-medium"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
            />
        </div>

        {/* Scrollable List */}
        <div className={`overflow-y-auto min-h-[200px] duration-300 ease-in-out -mx-2 px-2 ${selectedPaymentId ? 'max-h-[220px]' : 'max-h-[350px]'}`}>
            {isLoading ? (
                <div className="flex flex-col items-center justify-center h-40 text-gray-400 text-sm">
                    <svg className="animate-spin h-5 w-5 mb-2" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    Loading payments...
                </div>
            ) : filteredPayments.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-gray-400 text-sm border-2 border-dashed border-gray-100 rounded-lg bg-gray-50/50">
                    No matching payments found
                </div>
            ) : (
                <div className="space-y-1 pb-4">
                {filteredPayments.map(payment => (
                    <div 
                    key={payment.id}
                    onClick={() => handleSelectPayment(payment)}
                    className={`group flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all border ${selectedPaymentId === payment.id ? 'bg-blue-50 border-blue-200 shadow-sm ring-1 ring-blue-100' : 'bg-white border-transparent hover:bg-gray-50 hover:border-gray-200'}`}
                    >
                        <div className="flex flex-col min-w-0 pr-4">
                            <div className="flex items-center gap-2 mb-0.5">
                                <span className={`font-semibold text-sm ${selectedPaymentId === payment.id ? 'text-blue-700' : 'text-gray-900'}`}>${payment.availableBalance.toFixed(2)}</span>
                                {payment.amount !== payment.availableBalance && (
                                    <span className="text-[10px] text-gray-400 line-through">${Number(payment.amount).toFixed(2)}</span>
                                )}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                                <span className="whitespace-nowrap">{new Date(payment.paymentDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' })}</span>
                                <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                                <span className="truncate max-w-[140px] opacity-80">{payment.notes || 'No notes'}</span>
                            </div>
                        </div>
                        <span className={`text-[10px] font-bold tracking-wide px-2 py-1 rounded-md uppercase border transition-colors ${selectedPaymentId === payment.id ? 'bg-white text-blue-600 border-blue-100' : 'bg-gray-100 text-gray-500 border-gray-200 group-hover:border-gray-300'}`}>
                            {payment.method}
                        </span>
                    </div>
                ))}
                </div>
            )}
        </div>

        {/* Pinned Bottom Section */}
        {selectedPayment && (
            <div className="sticky -bottom-6 -mx-8 px-8 py-5 bg-white border-t border-gray-100 shadow-[0_-8px_20px_-10px_rgba(0,0,0,0.05)] mt-auto z-20 animate-slide-up-fade">
                <div className="flex items-center gap-4">
                    <div className="flex-1">
                        <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
                            Amount to Link
                             <span className="ml-2 font-normal text-blue-600 normal-case bg-blue-50 px-1.5 py-0.5 rounded">Max: ${Math.min(invoiceRemaining, selectedPayment.availableBalance).toFixed(2)}</span>
                        </label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-medium text-lg">$</span>
                            <input
                                type="number"
                                min="0.01"
                                step="0.01"
                                max={Math.min(invoiceRemaining, selectedPayment.availableBalance)}
                                value={linkAmount}
                                onChange={(e) => setLinkAmount(parseFloat(e.target.value))}
                                className="w-full pl-7 pr-4 py-2 bg-gray-50 border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-xl font-bold text-gray-900 placeholder-gray-300 outline-none"
                                autoFocus
                            />
                        </div>
                    </div>
                </div>
            </div>
        )}
      </div>
    </Modal>
  );
}
