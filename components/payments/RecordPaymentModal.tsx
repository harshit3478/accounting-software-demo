'use client';

import { useState, useEffect } from 'react';
import Modal from '../invoices/Modal';

interface RecordPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface Invoice {
  id: number;
  invoiceNumber: string;
  clientName: string;
  amount: number;
  paidAmount: number;
  status: string;
}

export default function RecordPaymentModal({ isOpen, onClose, onSuccess }: RecordPaymentModalProps) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payment, setPayment] = useState({
    amount: '',
    method: 'cash' as 'cash' | 'zelle' | 'quickbooks' | 'layaway',
    paymentDate: new Date().toISOString().split('T')[0],
    notes: '',
    invoiceId: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      fetchInvoices();
      // Reset form when modal opens
      setPayment({
        amount: '',
        method: 'cash',
        paymentDate: new Date().toISOString().split('T')[0],
        notes: '',
        invoiceId: '',
      });
      setError('');
    }
  }, [isOpen]);

  const fetchInvoices = async () => {
    try {
      const res = await fetch('/api/invoices');
      if (res.ok) {
        const data = await res.json();
        // Only show unpaid or partially paid invoices
        const unpaidInvoices = data.filter((inv: Invoice) => 
          inv.status !== 'paid' && inv.paidAmount < inv.amount
        );
        setInvoices(unpaidInvoices);
      }
    } catch (error) {
      console.error('Failed to fetch invoices:', error);
    }
  };

  const handleSubmit = async () => {
    if (!payment.amount || parseFloat(payment.amount) <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    const amount = parseFloat(payment.amount);
    const selectedInvoice = invoices.find(inv => inv.id === parseInt(payment.invoiceId));
    
    if (selectedInvoice) {
      const remaining = selectedInvoice.amount - selectedInvoice.paidAmount;
      if (amount > remaining) {
        setError(`Payment amount cannot exceed remaining balance of $${remaining.toFixed(2)}`);
        return;
      }
    }

    setIsSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          method: payment.method,
          paymentDate: payment.paymentDate,
          notes: payment.notes || null,
          invoiceId: payment.invoiceId ? parseInt(payment.invoiceId) : null,
        }),
      });

      if (res.ok) {
        onSuccess();
        onClose();
      } else {
        const errorData = await res.json();
        setError(errorData.error || 'Failed to record payment');
      }
    } catch (error) {
      console.error('Failed to record payment:', error);
      setError('Failed to record payment. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAmountBlur = () => {
    if (payment.amount) {
      const value = parseFloat(payment.amount);
      if (!isNaN(value)) {
        setPayment({ ...payment, amount: value.toFixed(2) });
      }
    }
  };

  const selectedInvoice = invoices.find(inv => inv.id === parseInt(payment.invoiceId));
  const remainingAmount = selectedInvoice ? selectedInvoice.amount - selectedInvoice.paidAmount : 0;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Record New Payment" headerColor="blue">
      <div className="space-y-6">
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start">
            <svg className="w-5 h-5 text-red-500 mr-2 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Invoice Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Invoice (Optional)
          </label>
          <select
            value={payment.invoiceId}
            onChange={(e) => setPayment({ ...payment, invoiceId: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">No invoice (standalone payment)</option>
            {invoices.map((invoice) => (
              <option key={invoice.id} value={invoice.id}>
                {invoice.invoiceNumber} - {invoice.clientName} 
                (Remaining: ${(invoice.amount - invoice.paidAmount).toFixed(2)})
              </option>
            ))}
          </select>
          {selectedInvoice && (
            <p className="text-sm text-gray-600 mt-1">
              Invoice total: ${selectedInvoice.amount.toFixed(2)} | 
              Paid: ${selectedInvoice.paidAmount.toFixed(2)} | 
              <span className="font-medium text-blue-600">
                Remaining: ${remainingAmount.toFixed(2)}
              </span>
            </p>
          )}
        </div>

        {/* Amount */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Payment Amount <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <span className="absolute left-4 top-2.5 text-gray-500 font-medium">$</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={payment.amount}
              onChange={(e) => setPayment({ ...payment, amount: e.target.value })}
              onBlur={handleAmountBlur}
              className="w-full border border-gray-300 rounded-lg pl-8 pr-4 py-2.5 text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="0.00"
              required
            />
          </div>
          {selectedInvoice && parseFloat(payment.amount) > remainingAmount && (
            <p className="text-sm text-amber-600 mt-1 flex items-center">
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Amount exceeds remaining balance
            </p>
          )}
        </div>

        {/* Payment Method */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Payment Method <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-2 gap-3">
            {[
              { value: 'cash', label: 'Cash', icon: '💵' },
              { value: 'zelle', label: 'Zelle', icon: '📱' },
              { value: 'quickbooks', label: 'QuickBooks', icon: '💳' },
              { value: 'layaway', label: 'Layaway', icon: '⏰' },
            ].map((method) => (
              <button
                key={method.value}
                type="button"
                onClick={() => setPayment({ ...payment, method: method.value as any })}
                className={`p-3 rounded-lg border-2 transition-all ${
                  payment.method === method.value
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-300 hover:border-gray-400 text-gray-700'
                }`}
              >
                <span className="text-2xl mr-2">{method.icon}</span>
                <span className="font-medium">{method.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Payment Date */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Payment Date <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={payment.paymentDate}
            onChange={(e) => setPayment({ ...payment, paymentDate: e.target.value })}
            max={new Date().toISOString().split('T')[0]}
            className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            required
          />
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Notes (Optional)
          </label>
          <textarea
            value={payment.notes}
            onChange={(e) => setPayment({ ...payment, notes: e.target.value })}
            rows={3}
            className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Add any additional notes about this payment..."
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center"
          >
            {isSubmitting ? (
              <>
                <svg className="animate-spin h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Recording...
              </>
            ) : (
              <>
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                </svg>
                Record Payment
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}
