'use client';

import { useRef } from 'react';
import Modal from '../invoices/Modal';
import LucideIcon from '../LucideIcon';

interface ViewPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  payment: {
    id: number;
    amount: number;
    method: {
      id: number;
      name: string;
      icon: string | null;
      color: string;
    };
    paymentDate: string;
    notes: string | null;
    createdAt: string;
    invoice: {
      id: number;
      invoiceNumber: string;
      clientName: string;
      amount: number;
    } | null;
  } | null;
}

export default function ViewPaymentModal({ isOpen, onClose, payment }: ViewPaymentModalProps) {
  const receiptRef = useRef<HTMLDivElement>(null);

  if (!payment) return null;

  const handleDownloadPDF = async () => {
    const { generatePaymentReceiptPDF } = await import('../../lib/payment-receipt');
    generatePaymentReceiptPDF({
      id: payment.id,
      amount: payment.amount,
      date: payment.paymentDate,
      notes: payment.notes,
      method: payment.method,
      invoice: payment.invoice ? {
        invoiceNumber: payment.invoice.invoiceNumber,
        clientName: payment.invoice.clientName,
        amount: payment.invoice.amount,
        paidAmount: payment.amount, // current payment is the latest
      } : null,
    });
  };

  const handleShareImage = async () => {
    if (!receiptRef.current) return;
    const { shareElementAsImage } = await import('../../lib/image-export');
    await shareElementAsImage(
      receiptRef.current,
      `receipt-PAY-${String(payment.id).padStart(5, '0')}.png`,
      `Payment Receipt #${payment.id}`
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const methodColor = payment.method?.color || '#6B7280';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Payment Details" headerColor="purple" maxWidth="lg">
      <div className="space-y-6">
        <div ref={receiptRef}>
        {/* Payment Summary */}
        <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl p-6 border border-purple-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Payment Amount</p>
              <p className="text-3xl font-bold text-gray-900">${payment.amount.toFixed(2)}</p>
            </div>
            <div className="text-5xl rounded-full p-4 flex items-center justify-center" style={{ backgroundColor: `${methodColor}15`, color: methodColor }}>
              <LucideIcon name={payment.method?.icon} fallback={payment.method?.name || '?'} size={40} />
            </div>
          </div>
        </div>

        {/* Payment Method */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-600 mb-1">Payment Method</p>
            <p className="text-lg font-semibold text-gray-900">{payment.method?.name || 'Unknown'}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-600 mb-1">Payment Date</p>
            <p className="text-lg font-semibold text-gray-900">{formatDate(payment.paymentDate)}</p>
          </div>
        </div>

        {/* Invoice Information */}
        {payment.invoice ? (
          <div className="border border-gray-200 rounded-lg p-5">
            <h4 className="text-sm font-medium text-gray-600 mb-3 flex items-center">
              <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Associated Invoice
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Invoice Number:</span>
                <span className="font-medium text-gray-900">{payment.invoice.invoiceNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Client Name:</span>
                <span className="font-medium text-gray-900">{payment.invoice.clientName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Invoice Amount:</span>
                <span className="font-medium text-gray-900">${payment.invoice.amount.toFixed(2)}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="border border-gray-200 rounded-lg p-5 bg-gray-50">
            <p className="text-sm text-gray-600 flex items-center">
              <svg className="w-5 h-5 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              No invoice associated with this payment (standalone payment)
            </p>
          </div>
        )}

        {/* Notes */}
        {payment.notes && (
          <div className="border border-gray-200 rounded-lg p-5">
            <h4 className="text-sm font-medium text-gray-600 mb-2 flex items-center">
              <svg className="w-5 h-5 mr-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
              </svg>
              Notes
            </h4>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{payment.notes}</p>
          </div>
        )}

        {/* Metadata */}
        <div className="pt-4 border-t border-gray-200">
          <p className="text-xs text-gray-500">
            Payment ID: #{payment.id} • Recorded on {formatDate(payment.createdAt)}
          </p>
        </div>
        </div>{/* end receiptRef */}

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-200">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadPDF}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              PDF
            </button>
            <button
              type="button"
              onClick={handleShareImage}
              className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
              Share
            </button>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 bg-gray-600 text-white rounded-lg font-medium hover:bg-gray-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}
