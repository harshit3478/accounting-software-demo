'use client';

import { useState, useEffect } from 'react';
import Modal from './Modal';

interface Invoice {
  id: number;
  invoiceNumber: string;
  clientName: string;
  amount: number;
  paidAmount: number;
}

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  invoice: Invoice | null;
}

export default function PaymentModal({ isOpen, onClose, onSuccess, invoice }: PaymentModalProps) {
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'zelle' | 'quickbooks' | 'layaway'>('cash');
  const [paymentDate, setPaymentDate] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [isRecording, setIsRecording] = useState(false);

  useEffect(() => {
    if (invoice && isOpen) {
      const remainingBalance = invoice.amount - invoice.paidAmount;
      setPaymentAmount(remainingBalance);
      setPaymentDate(new Date().toISOString().split('T')[0]);
      setPaymentMethod('cash');
      setPaymentNotes('');
    }
  }, [invoice, isOpen]);

  const handleRecordPayment = async () => {
    if (!invoice || paymentAmount <= 0) {
      return { success: false, error: 'Please enter a valid payment amount' };
    }

    const remainingBalance = invoice.amount - invoice.paidAmount;
    
    setIsRecording(true);
    try {
      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceId: invoice.id,
          amount: paymentAmount,
          method: paymentMethod,
          date: paymentDate,
          notes: paymentNotes,
        }),
      });

      if (res.ok) {
        onSuccess();
        onClose();
        return { success: true };
      } else {
        const error = await res.json();
        return { success: false, error: error.error || 'Failed to record payment' };
      }
    } catch (error) {
      console.error('Failed to record payment:', error);
      return { success: false, error: 'Failed to record payment' };
    } finally {
      setIsRecording(false);
    }
  };

  if (!invoice) return null;

  const remainingBalance = invoice.amount - invoice.paidAmount;

  const footer = (
    <div className="flex justify-end space-x-4">
      <button
        onClick={onClose}
        className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-100 transition-colors"
        disabled={isRecording}
      >
        Cancel
      </button>
      <button
        onClick={handleRecordPayment}
        disabled={isRecording || paymentAmount <= 0}
        className="px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors disabled:bg-green-400 disabled:cursor-not-allowed flex items-center"
      >
        {isRecording ? (
          <>
            <svg className="animate-spin h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Recording Payment...
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
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Record Payment"
      footer={footer}
      maxWidth="2xl"
      headerColor="green"
    >
      <div className="space-y-6">
        {/* Invoice Summary */}
        <div className="bg-gradient-to-r from-green-50 to-green-100 p-6 rounded-xl border border-green-200">
          <div className="mb-4">
            <p className="text-sm text-gray-600">Recording payment for</p>
            <p className="text-lg font-semibold text-gray-900">
              {invoice.invoiceNumber} - {invoice.clientName}
            </p>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Total Amount:</span>
              <span className="font-semibold text-gray-900">${invoice.amount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Already Paid:</span>
              <span className="font-semibold text-gray-900">${invoice.paidAmount.toFixed(2)}</span>
            </div>
            <div className="border-t border-green-300 pt-2 flex justify-between">
              <span className="font-semibold text-gray-900">Remaining Balance:</span>
              <span className="text-xl font-bold text-green-700">
                ${remainingBalance.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Payment Form */}
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Payment Amount <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-gray-500 font-medium">$</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={paymentAmount || ''}
                  onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                  onBlur={(e) => {
                    const val = parseFloat(e.target.value);
                    if (!isNaN(val)) {
                      setPaymentAmount(parseFloat(val.toFixed(2)));
                    }
                  }}
                  className="w-full pl-8 pr-4 py-2 border border-gray-300 text-gray-900 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  placeholder="0.00"
                />
              </div>
              <button
                onClick={() => setPaymentAmount(remainingBalance)}
                className="text-xs text-green-600 hover:text-green-700 mt-1 font-medium"
              >
                Pay full balance
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Payment Method <span className="text-red-500">*</span>
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as any)}
                className="w-full px-4 py-2 border border-gray-300 text-gray-900 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              >
                <option value="cash">Cash</option>
                <option value="zelle">Zelle</option>
                <option value="quickbooks">QuickBooks (Credit Card)</option>
                <option value="layaway">Layaway Payment</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Payment Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 text-gray-900 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes (Optional)
            </label>
            <textarea
              value={paymentNotes}
              onChange={(e) => setPaymentNotes(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 text-gray-900 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              rows={3}
              placeholder="Add any notes about this payment..."
            />
          </div>

          {/* Payment Preview */}
          {paymentAmount > 0 && (
            <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
              <div className="flex items-start">
                <svg className="w-5 h-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                <div className="text-sm flex-1">
                  <p className="font-medium text-blue-900">Payment Preview</p>
                  <p className="text-blue-700 mt-1">
                    Recording ${paymentAmount.toFixed(2)} via {paymentMethod.charAt(0).toUpperCase() + paymentMethod.slice(1)}
                  </p>
                  {paymentAmount >= remainingBalance && (
                    <p className="text-green-700 font-medium mt-2 flex items-center">
                      <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      This will mark the invoice as paid
                    </p>
                  )}
                  {paymentAmount > 0 && paymentAmount < remainingBalance && (
                    <p className="text-amber-700 font-medium mt-2 flex items-center">
                      <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      Remaining balance: ${(remainingBalance - paymentAmount).toFixed(2)}
                    </p>
                  )}
                  {paymentAmount > remainingBalance && (
                    <p className="text-red-700 font-medium mt-2 flex items-center">
                      <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                      Overpayment: ${(paymentAmount - remainingBalance).toFixed(2)}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

export { PaymentModal };
