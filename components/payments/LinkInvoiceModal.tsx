'use client';

import { useState, useEffect, useMemo } from 'react';
import Modal from '../invoices/Modal'; // Reusing Modal from invoices

interface Payment {
  id: number;
  amount: number;
  paymentDate: string;
  method: { id: number; name: string; icon?: string; color?: string } | string;
  notes?: string;
  isMatched: boolean;
  paymentMatches: { amount: string | number }[];
}

interface Invoice {
  id: number;
  invoiceNumber: string;
  clientName: string;
  amount: string | number;
  paidAmount: string | number;
  status: string;
  dueDate: string;
}

interface LinkInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  payment: Payment | null;
}

export default function LinkInvoiceModal({ isOpen, onClose, onSuccess, payment }: LinkInvoiceModalProps) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLinking, setIsLinking] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<number | null>(null);
  const [linkAmount, setLinkAmount] = useState<number>(0);
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch unpaid invoices when modal opens
  useEffect(() => {
    if (isOpen && payment) {
      setIsLoading(true);
      fetch('/api/invoices/unpaid')
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data)) {
            setInvoices(data);
          } else {
             console.error('Expected array of invoices, got:', data);
             setInvoices([]);
          }
          setIsLoading(false);
        })
        .catch((err) => {
          console.error('Failed to fetch invoices:', err);
          setIsLoading(false);
        });
      
      // Reset state
      setSelectedInvoiceId(null);
      setLinkAmount(0);
      setSearchTerm('');
    }
  }, [isOpen, payment]);

  const getPaymentBalance = (payment: Payment) => {
      const totalAmount = Number(payment.amount);
      const usedAmount = payment.paymentMatches.reduce((sum, match) => sum + Number(match.amount), 0);
      return totalAmount - usedAmount;
  }

  const filteredInvoices = useMemo(() => {
    return invoices.filter(invoice => {
      const searchLower = searchTerm.toLowerCase();
      const client = invoice.clientName.toLowerCase();
      const number = invoice.invoiceNumber.toLowerCase();
      const amount = invoice.amount.toString();
      
      return (
        client.includes(searchLower) ||
        number.includes(searchLower) ||
        amount.includes(searchLower)
      );
    }).sort((a, b) => {
        if (!payment) return 0;
        const available = getPaymentBalance(payment);
        
        const remainingA = Number(a.amount) - Number(a.paidAmount);
        const remainingB = Number(b.amount) - Number(b.paidAmount);

        const diffA = Math.abs(available - remainingA);
        const diffB = Math.abs(available - remainingB);
        
        // Prioritize exact matches
        if (diffA < 0.01 && diffB > 0.01) return -1;
        if (diffB < 0.01 && diffA > 0.01) return 1;

        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    });
  }, [invoices, searchTerm, payment]);

  const handleSelectInvoice = (invoice: Invoice) => {
    if (!payment) return;
    setSelectedInvoiceId(invoice.id);
    
    const available = getPaymentBalance(payment);
    const remaining = Number(invoice.amount) - Number(invoice.paidAmount);
    
    setLinkAmount(Math.min(available, remaining));
  };

  const handleLinkInvoice = async () => {
    if (!payment || !selectedInvoiceId || linkAmount <= 0) return;

    setIsLinking(true);
    try {
      const res = await fetch('/api/payments/link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          paymentId: payment.id,
          invoiceId: selectedInvoiceId,
          amount: linkAmount,
        }),
      });

      const data = await res.json();
      
      if (res.ok) {
        onSuccess();
        onClose();
      } else {
        alert(data.error || 'Failed to link invoice');
      }
    } catch (error) {
      console.error('Error linking invoice:', error);
      alert('An error occurred while linking invoice');
    } finally {
      setIsLinking(false);
    }
  };

  if (!payment) return null;

  const paymentBalance = getPaymentBalance(payment);
  const selectedInvoice = invoices.find(i => i.id === selectedInvoiceId);

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
        onClick={handleLinkInvoice}
        disabled={isLinking || !selectedInvoiceId || linkAmount <= 0}
        className="px-6 py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors disabled:bg-purple-400 disabled:cursor-not-allowed flex items-center"
      >
        {isLinking ? 'Linking...' : 'Link Invoice'}
      </button>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Link Invoice to Payment`}
      footer={footer}
    >
      <div className="flex flex-col h-full">
        {/* Compact Header Stats */}
        <div className="flex items-center justify-between py-2 border-b border-gray-100 mb-4">
            <div className="flex flex-col">
                <span className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Payment Date</span>
                <span className="text-sm font-medium text-gray-900">{new Date(payment.paymentDate).toLocaleDateString()}</span>
            </div>
            <div className="flex flex-col items-end">
                <span className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Funds Available</span>
                <span className="text-lg font-bold text-purple-600">${paymentBalance.toFixed(2)}</span>
            </div>
        </div>

        {/* Minimal Search */}
        <div className="relative mb-2">
            <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
            <input
                type="text"
                placeholder="Search invoices..."
                className="w-full pl-9 pr-4 py-2 bg-gray-50 border-none rounded-lg text-sm focus:ring-1 focus:ring-purple-500 placeholder-gray-400 transition-all font-medium"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
            />
        </div>

        {/* Scrollable List */}
        <div className={`overflow-y-auto min-h-[200px] duration-300 ease-in-out -mx-2 px-2 ${selectedInvoiceId ? 'max-h-[220px]' : 'max-h-[350px]'}`}>
            {isLoading ? (
                <div className="flex flex-col items-center justify-center h-40 text-gray-400 text-sm">
                    <svg className="animate-spin h-5 w-5 mb-2" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    Loading invoices...
                </div>
            ) : filteredInvoices.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-gray-400 text-sm border-2 border-dashed border-gray-100 rounded-lg bg-gray-50/50">
                    No matching invoices found
                </div>
            ) : (
                <div className="space-y-1 pb-4">
                {filteredInvoices.map(inv => {
                    const rem = Number(inv.amount) - Number(inv.paidAmount);
                    return (
                    <div 
                    key={inv.id}
                    onClick={() => handleSelectInvoice(inv)}
                    className={`group flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all border ${selectedInvoiceId === inv.id ? 'bg-purple-50 border-purple-200 shadow-sm ring-1 ring-purple-100' : 'bg-white border-transparent hover:bg-gray-50 hover:border-gray-200'}`}
                    >
                        <div className="flex flex-col min-w-0 pr-4">
                            <div className="flex items-center gap-2 mb-0.5">
                                <span className={`font-semibold text-sm ${selectedInvoiceId === inv.id ? 'text-purple-700' : 'text-gray-900'}`}>{inv.invoiceNumber}</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                                <span className="font-medium text-gray-700 truncate max-w-[120px]">{inv.clientName}</span>
                                <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                                <span className="text-gray-400">Total: ${Number(inv.amount).toFixed(2)}</span>
                            </div>
                        </div>
                        <span className={`text-[10px] font-bold tracking-wide px-2 py-1 rounded-md uppercase border transition-colors ${selectedInvoiceId === inv.id ? 'bg-white text-purple-600 border-purple-100' : 'bg-gray-100 text-gray-500 border-gray-200 group-hover:border-gray-300'}`}>
                            ${rem.toFixed(2)} Due
                        </span>
                    </div>
                )})}
                </div>
            )}
        </div>

        {/* Pinned Bottom Section */}
        {selectedInvoice && (
            <div className="sticky -bottom-4 -mx-8 px-8 py-5 bg-white border-t border-gray-100 shadow-[0_-8px_20px_-10px_rgba(0,0,0,0.05)] mt-auto z-20 animate-slide-up-fade">
                <div className="flex items-center gap-4">
                    <div className="flex-1">
                        <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
                            Amount to Link
                             <span className="ml-2 font-normal text-purple-600 normal-case bg-purple-50 px-1.5 py-0.5 rounded">Max: ${Math.min(paymentBalance, Number(selectedInvoice.amount) - Number(selectedInvoice.paidAmount)).toFixed(2)}</span>
                        </label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-medium text-lg">$</span>
                            <input
                                type="number"
                                min="0.01"
                                step="0.01"
                                max={Math.min(paymentBalance, Number(selectedInvoice.amount) - Number(selectedInvoice.paidAmount))}
                                value={linkAmount} 
                                onChange={(e) => setLinkAmount(parseFloat(e.target.value))}
                                className="w-full pl-0 pr-4 py-2 bg-gray-50 border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all text-xl font-bold text-gray-900 placeholder-gray-300 outline-none"
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
