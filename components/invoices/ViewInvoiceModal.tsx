'use client';

import { useState, useEffect, useRef } from 'react';
import LucideIcon from '../LucideIcon';
import Modal from './Modal';
import { InvoiceItem } from './types';

interface Payment {
  id: number;
  amount: number;
  method: {
    id: number;
    name: string;
    icon: string | null;
    color: string;
  } | string;
  date: string;
  notes: string | null;
  createdAt: string;
  createdBy?: string;
  type?: 'direct' | 'matched';
  matchId?: number;
}

interface LayawayInstallment {
  id: number;
  dueDate: string;
  amount: number;
  label: string;
  isPaid: boolean;
  paidDate?: string | null;
  paidAmount?: number | null;
}

interface LayawayPlan {
  id: number;
  months: number;
  paymentFrequency: string;
  downPayment: number;
  isCancelled: boolean;
  notes?: string | null;
  installments: LayawayInstallment[];
}

interface Invoice {
  id: number;
  invoiceNumber: string;
  clientName: string;
  items: InvoiceItem[] | null;
  subtotal: number;
  tax: number;
  discount: number;
  amount: number;
  paidAmount: number;
  dueDate: string;
  status: 'paid' | 'pending' | 'overdue' | 'partial' | 'inactive';
  isLayaway: boolean;
  createdAt: string;
  description?: string | null;
  shipmentId?: string | null;
  trackingNumber?: string | null;
  externalInvoiceNumber?: string | null;
  customer?: { id: number; name: string; email?: string | null; phone?: string | null } | null;
  layawayPlan?: LayawayPlan | null;
}

interface ViewInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: Invoice | null;
}

export default function ViewInvoiceModal({ isOpen, onClose, invoice }: ViewInvoiceModalProps) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isLoadingPayments, setIsLoadingPayments] = useState(false);
  const [updatingInstallment, setUpdatingInstallment] = useState<number | null>(null);
  const [localInstallments, setLocalInstallments] = useState<LayawayInstallment[]>([]);
  const invoiceRef = useRef<HTMLDivElement>(null);

  const handlePrintPDF = async () => {
    if (!invoice) return;
    const { generateSingleInvoicePDF } = await import('../../lib/pdf-export');
    generateSingleInvoicePDF({
      ...invoice,
      payments: payments.map(p => ({
        amount: p.amount,
        paymentDate: p.date || p.createdAt,
        method: typeof p.method === 'object' ? p.method : { name: String(p.method) },
      })),
    } as any, "print");
  };

  const handleDownloadJPG = async () => {
    if (!invoiceRef.current) return;
    const { exportElementAsJPEG } = await import('../../lib/image-export');
    await exportElementAsJPEG(
      invoiceRef.current,
      `invoice-${invoice?.invoiceNumber}.jpg`
    );
  };

  useEffect(() => {
    if (isOpen && invoice) {
      fetchPayments();
      if (invoice.layawayPlan?.installments) {
        setLocalInstallments(invoice.layawayPlan.installments);
      }
    }
  }, [isOpen, invoice]);

  const toggleInstallmentPaid = async (installment: LayawayInstallment) => {
    if (!invoice) return;
    setUpdatingInstallment(installment.id);
    try {
      const newIsPaid = !installment.isPaid;
      const res = await fetch(`/api/invoices/${invoice.id}/layaway-plan`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          installments: [{
            id: installment.id,
            isPaid: newIsPaid,
            paidDate: newIsPaid ? new Date().toISOString() : null,
            paidAmount: newIsPaid ? installment.amount : null,
          }],
        }),
      });
      if (res.ok) {
        setLocalInstallments(prev =>
          prev.map(inst =>
            inst.id === installment.id
              ? {
                  ...inst,
                  isPaid: newIsPaid,
                  paidDate: newIsPaid ? new Date().toISOString() : null,
                  paidAmount: newIsPaid ? installment.amount : null,
                }
              : inst
          )
        );
      }
    } catch (error) {
      console.error('Failed to update installment:', error);
    } finally {
      setUpdatingInstallment(null);
    }
  };

  const fetchPayments = async () => {
    if (!invoice) return;
    
    setIsLoadingPayments(true);
    try {
      const res = await fetch(`/api/invoices/${invoice.id}/payments`);
      if (res.ok) {
        const data = await res.json();
        setPayments(data);
      }
    } catch (error) {
      console.error('Failed to fetch payments:', error);
    } finally {
      setIsLoadingPayments(false);
    }
  };

  if (!invoice) return null;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const getStatusBadgeClass = (status: string) => {
    const classes = {
      paid: 'bg-green-100 text-green-800',
      pending: 'bg-amber-100 text-amber-800',
      overdue: 'bg-red-100 text-red-800',
      partial: 'bg-blue-100 text-blue-800',
      inactive: 'bg-gray-200 text-gray-600',
    };
    return classes[status as keyof typeof classes] || 'bg-gray-100 text-gray-800';
  };

  const getPaymentMethodInfo = (method: Payment['method']) => {
    if (typeof method === 'object' && method !== null) {
      return { name: method.name, icon: method.icon, color: method.color };
    }
    // Fallback for legacy string method
    return { name: String(method), icon: null, color: '#6B7280' };
  };

  const getPaymentMethodIcon = (method: Payment['method']) => {
    const info = getPaymentMethodInfo(method);
    if (info.icon) {
      return <LucideIcon name={info.icon} fallback={info.name} size={20} />;
    }
    return (
      <svg className="w-5 h-5" style={{ color: info.color }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
      </svg>
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Invoice ${invoice.invoiceNumber}`}
      maxWidth="5xl"
      headerColor="gray"
    >
      <div className="space-y-6">
        {/* Export buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrintPDF}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Print PDF
          </button>
          <button
            onClick={handleDownloadJPG}
            className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download JPG
          </button>
        </div>

        <div ref={invoiceRef}>
        {/* Invoice Header */}
        <div className="bg-gradient-to-r from-gray-50 to-gray-100 p-6 rounded-xl border border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Client Name</p>
              <p className="text-lg font-semibold text-gray-900">{invoice.clientName}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Status</p>
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusBadgeClass(invoice.status)}`}>
                {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
              </span>
              {invoice.isLayaway && (
                <span className="ml-2 inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-purple-100 text-purple-800">
                  Layaway
                </span>
              )}
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Due Date</p>
              <p className="text-lg font-semibold text-gray-900">{formatDate(invoice.dueDate)}</p>
              {new Date(invoice.dueDate) < new Date() && invoice.status !== 'paid' && (
                <p className="text-xs text-red-600 mt-1">Overdue</p>
              )}
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-gray-300 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Created On</p>
              <p className="text-sm text-gray-700">{formatDate(invoice.createdAt)}</p>
            </div>
            {invoice.externalInvoiceNumber && (
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">External Invoice #</p>
                <p className="text-sm font-mono text-gray-700">{invoice.externalInvoiceNumber}</p>
              </div>
            )}
            {invoice.customer?.phone && (
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Phone</p>
                <p className="text-sm text-gray-700">{invoice.customer.phone}</p>
              </div>
            )}
          </div>
          
          {(invoice.shipmentId || invoice.trackingNumber) && (
             <div className="mt-4 pt-4 border-t border-gray-300">
               <h5 className="text-sm font-medium text-gray-900 mb-2">Shipment Details</h5>
               <div className="grid grid-cols-2 gap-4">
                 {invoice.shipmentId && (
                   <div>
                     <p className="text-xs text-gray-500 uppercase">Shipment ID</p>
                     <p className="text-sm font-mono text-gray-700">{invoice.shipmentId}</p>
                   </div>
                 )}
                 {invoice.trackingNumber && (
                   <div>
                     <p className="text-xs text-gray-500 uppercase">Tracking Number</p>
                     <p className="text-sm font-mono text-gray-700">{invoice.trackingNumber}</p>
                   </div>
                 )}
               </div>
             </div>
          )}
        </div>

        {/* Invoice Items */}
        {invoice.items && invoice.items.length > 0 && (
          <div>
            <h4 className="text-lg font-semibold text-gray-900 mb-4">Invoice Items</h4>
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Item</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">Quantity</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">Price</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {invoice.items.map((item, index) => (
                    <tr key={index} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-sm text-gray-900">{item.name}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-right">{item.quantity}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-right">{formatCurrency(item.price)}</td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 text-right">
                        {formatCurrency(item.quantity * item.price)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Financial Summary */}
        <div className="bg-blue-50 p-6 rounded-xl border border-blue-200">
          <h4 className="text-lg font-semibold text-gray-900 mb-4">Financial Summary</h4>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Subtotal:</span>
              <span className="font-medium text-gray-900">{formatCurrency(invoice.subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Tax:</span>
              <span className="font-medium text-gray-900">{formatCurrency(invoice.tax)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Discount:</span>
              <span className="font-medium text-red-600">-{formatCurrency(invoice.discount)}</span>
            </div>
            <div className="border-t border-blue-300 pt-3 flex justify-between">
              <span className="text-lg font-semibold text-gray-900">Total Amount:</span>
              <span className="text-lg font-bold text-blue-600">{formatCurrency(invoice.amount)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Amount Paid:</span>
              <span className="font-medium text-green-600">{formatCurrency(invoice.paidAmount)}</span>
            </div>
            {invoice.amount - invoice.paidAmount > 0 && (
              <div className="flex justify-between pt-2 border-t border-blue-200">
                <span className="text-base font-semibold text-gray-900">Remaining Balance:</span>
                <span className="text-base font-bold text-red-600">
                  {formatCurrency(invoice.amount - invoice.paidAmount)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Layaway Schedule */}
        {invoice.isLayaway && invoice.layawayPlan && (
          <div className="bg-purple-50 p-6 rounded-xl border border-purple-200">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-semibold text-gray-900">Layaway Schedule</h4>
              {invoice.layawayPlan.isCancelled && (
                <span className="px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">Cancelled</span>
              )}
            </div>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div>
                <p className="text-xs text-gray-500 uppercase">Duration</p>
                <p className="text-sm font-medium text-gray-900">{invoice.layawayPlan.months} month(s)</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase">Frequency</p>
                <p className="text-sm font-medium text-gray-900 capitalize">{invoice.layawayPlan.paymentFrequency}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase">Down Payment</p>
                <p className="text-sm font-medium text-gray-900">{formatCurrency(invoice.layawayPlan.downPayment)}</p>
              </div>
            </div>
            {invoice.layawayPlan.notes && (
              <p className="text-sm text-gray-600 italic mb-4">"{invoice.layawayPlan.notes}"</p>
            )}
            {invoice.layawayPlan.installments.length > 0 && (
              <div className="border border-purple-200 rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="bg-purple-100 border-b border-purple-200">
                      <th className="px-4 py-2 text-left text-xs font-semibold text-purple-800 uppercase">Label</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold text-purple-800 uppercase">Due Date</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold text-purple-800 uppercase">Amount</th>
                      <th className="px-4 py-2 text-center text-xs font-semibold text-purple-800 uppercase">Status</th>
                      <th className="px-4 py-2 text-center text-xs font-semibold text-purple-800 uppercase w-[80px]">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-purple-100">
                    {localInstallments.map((inst) => (
                      <tr key={inst.id} className={inst.isPaid ? 'bg-green-50/50' : ''}>
                        <td className="px-4 py-2 text-sm text-gray-900">{inst.label}</td>
                        <td className="px-4 py-2 text-sm text-gray-900 text-right">{formatDate(inst.dueDate)}</td>
                        <td className="px-4 py-2 text-sm text-gray-900 text-right">{formatCurrency(inst.amount)}</td>
                        <td className="px-4 py-2 text-center">
                          {inst.isPaid ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                              Paid {inst.paidDate ? `on ${new Date(inst.paidDate).toLocaleDateString()}` : ''}
                            </span>
                          ) : (
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                              new Date(inst.dueDate) < new Date() ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
                            }`}>
                              {new Date(inst.dueDate) < new Date() ? 'Overdue' : 'Pending'}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-center">
                          <button
                            onClick={() => toggleInstallmentPaid(inst)}
                            disabled={updatingInstallment === inst.id || invoice.layawayPlan!.isCancelled}
                            className={`text-xs px-2.5 py-1 rounded font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                              inst.isPaid
                                ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                : 'bg-green-600 text-white hover:bg-green-700'
                            }`}
                            title={inst.isPaid ? 'Mark as unpaid' : 'Mark as paid'}
                          >
                            {updatingInstallment === inst.id ? (
                              <svg className="animate-spin h-3.5 w-3.5 mx-auto" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                              </svg>
                            ) : inst.isPaid ? 'Undo' : 'Mark Paid'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Payment History */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-lg font-semibold text-gray-900">Payment History</h4>
            {isLoadingPayments && (
              <div className="flex items-center text-sm text-gray-500">
                <svg className="animate-spin h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Loading...
              </div>
            )}
          </div>

          {payments.length > 0 ? (
            <div className="space-y-3">
              {payments.map((payment) => (
                <div
                  key={payment.id}
                  className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3">
                      <div className="p-2 bg-gray-50 rounded-lg">
                        {getPaymentMethodIcon(payment.method)}
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-semibold text-gray-900">{formatCurrency(payment.amount)}</span>
                          <span className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded">
                            {getPaymentMethodInfo(payment.method).name}
                          </span>
                          {payment.type === 'matched' && (
                            <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded font-medium">
                              Matched Payment
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mt-1">
                          {formatDate(payment.date)}
                        </p>
                        {payment.createdBy && (
                          <p className="text-xs text-gray-500 mt-1">
                            Recorded by: {payment.createdBy}
                          </p>
                        )}
                        {payment.notes && (
                          <p className="text-sm text-gray-500 mt-2 italic">"{payment.notes}"</p>
                        )}
                      </div>
                    </div>
                    <span className="text-xs text-gray-400">
                      Recorded: {new Date(payment.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
              <svg className="w-12 h-12 text-gray-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              <p className="text-gray-600 font-medium">No payments recorded yet</p>
              <p className="text-sm text-gray-500 mt-1">Payments will appear here once recorded</p>
            </div>
          )}
        </div>
        </div>{/* end invoiceRef */}
      </div>
    </Modal>
  );
}
