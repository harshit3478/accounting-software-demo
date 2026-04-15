'use client';

import { useEffect, useState } from 'react';
import Modal from '../invoices/Modal';
import type { Payment } from '../../hooks/usePayments';

interface PaymentMethodType {
  id: number;
  name: string;
  icon: string | null;
  color: string;
  isActive: boolean;
  isSystem: boolean;
  sortOrder: number;
}

interface EditPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  payment: Payment | null;
}

interface InvoiceOption {
  id: number;
  invoiceNumber: string;
  clientName: string;
  amount: number;
  paidAmount: number;
}

export default function EditPaymentModal({ isOpen, onClose, onSuccess, payment }: EditPaymentModalProps) {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodType[]>([]);
  const [invoices, setInvoices] = useState<InvoiceOption[]>([]);
  const [amount, setAmount] = useState('');
  const [invoiceId, setInvoiceId] = useState('');
  const [methodId, setMethodId] = useState('');
  const [paymentDate, setPaymentDate] = useState('');
  const [notes, setNotes] = useState('');
  const [editReason, setEditReason] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;

    fetch('/api/payment-methods')
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        const activeMethods = (data || []).filter((m: PaymentMethodType) => m.isActive);
        setPaymentMethods(activeMethods);
      })
      .catch(() => {
        setPaymentMethods([]);
      });

    fetch('/api/invoices?status=all&limit=200&sortBy=date&sortDirection=desc')
      .then((res) => (res.ok ? res.json() : { invoices: [] }))
      .then((data) => {
        const rows = Array.isArray(data?.invoices) ? data.invoices : [];
        setInvoices(
          rows.map((inv: any) => ({
            id: inv.id,
            invoiceNumber: inv.invoiceNumber,
            clientName: inv.clientName,
            amount: Number(inv.amount),
            paidAmount: Number(inv.paidAmount),
          })),
        );
      })
      .catch(() => {
        setInvoices([]);
      });
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !payment) return;

    setAmount(String(payment.amount.toFixed(2)));
    setInvoiceId(payment.invoice?.id ? String(payment.invoice.id) : '');
    setMethodId(String(payment.methodId || payment.method?.id || ''));
    setPaymentDate(payment.paymentDate ? new Date(payment.paymentDate).toISOString().split('T')[0] : '');
    setNotes(payment.notes || '');
    setEditReason('');
    setError('');
  }, [isOpen, payment]);

  const handleSubmit = async () => {
    if (!payment) return;

    const numericAmount = parseFloat(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    if (!methodId) {
      setError('Please select a payment method');
      return;
    }

    if (!paymentDate) {
      setError('Please select payment date');
      return;
    }

    if (!editReason.trim()) {
      setError('Please provide a reason for this edit');
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      const normalizedInvoiceId = invoiceId ? parseInt(invoiceId, 10) : null;

      const res = await fetch(`/api/payments/${payment.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceId: normalizedInvoiceId,
          amount: numericAmount,
          methodId: parseInt(methodId, 10),
          paymentDate,
          notes: notes.trim() || null,
          editReason: editReason.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to update payment');
        return;
      }

      onSuccess();
      onClose();
    } catch (err) {
      console.error('Failed to update payment:', err);
      setError('Failed to update payment');
    } finally {
      setIsSaving(false);
    }
  };

  if (!payment) return null;

  const hasMatchedSplits = (payment.paymentMatches?.length || 0) > 0;
  const matchedInvoiceSummary = hasMatchedSplits
    ? payment.paymentMatches!
        .map((m) => `${m.invoice.invoiceNumber} (${m.invoice.clientName})`)
        .join(', ')
    : '';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Edit Payment #${payment.id}`} headerColor="blue">
      <div className="space-y-5">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">Invoice</label>
          {hasMatchedSplits ? (
            <>
              <div className="w-full rounded-lg border border-gray-300 bg-gray-100 px-4 py-2.5 text-gray-700">
                {matchedInvoiceSummary}
              </div>
              <p className="mt-1 text-xs text-amber-700">
                Invoice cannot be changed for matched payments. Unmatch and relink first.
              </p>
            </>
          ) : (
            <select
              value={invoiceId}
              onChange={(e) => setInvoiceId(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
            >
              <option value="">No invoice (standalone payment)</option>
              {invoices.map((inv) => (
                <option key={inv.id} value={inv.id}>
                  {inv.invoiceNumber} - {inv.clientName} (Remaining ${(inv.amount - inv.paidAmount).toFixed(2)})
                </option>
              ))}
            </select>
          )}
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Amount <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Payment Method <span className="text-red-500">*</span>
          </label>
          <select
            value={methodId}
            onChange={(e) => setMethodId(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select method</option>
            {paymentMethods.map((method) => (
              <option key={method.id} value={method.id}>
                {method.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Payment Date <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={paymentDate}
            onChange={(e) => setPaymentDate(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
            placeholder="Optional notes"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Reason for Edit <span className="text-red-500">*</span>
          </label>
          <textarea
            value={editReason}
            onChange={(e) => setEditReason(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
            placeholder="Explain why this payment is being changed"
            required
          />
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-gray-200 pt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="rounded-lg border border-gray-300 px-5 py-2.5 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSaving}
            className="rounded-lg bg-blue-600 px-5 py-2.5 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
