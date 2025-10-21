'use client';

import { useState, useEffect } from 'react';
import Modal from './Modal';
import InvoiceItemsEditor from './InvoiceItemsEditor';
import InvoiceSummary from './InvoiceSummary';
import { InvoiceItem } from './types';

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
  status: 'paid' | 'pending' | 'overdue' | 'partial';
  isLayaway: boolean;
  createdAt: string;
}

interface EditInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  invoice: Invoice | null;
}

export default function EditInvoiceModal({ isOpen, onClose, onSuccess, invoice }: EditInvoiceModalProps) {
  const [clientName, setClientName] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [items, setItems] = useState<InvoiceItem[]>([{ name: '', quantity: 1, price: 0 }]);
  const [tax, setTax] = useState(0);
  const [taxType, setTaxType] = useState<'fixed' | 'percentage'>('fixed');
  const [discount, setDiscount] = useState(0);
  const [discountType, setDiscountType] = useState<'fixed' | 'percentage'>('fixed');
  const [isLayaway, setIsLayaway] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [dateError, setDateError] = useState('');

  useEffect(() => {
    if (invoice && isOpen) {
      setClientName(invoice.clientName);
      setDueDate(invoice.dueDate);
      setItems(invoice.items || [{ name: '', quantity: 1, price: 0 }]);
      setTax(invoice.tax);
      setTaxType('fixed'); // Default to fixed, adjust based on your needs
      setDiscount(invoice.discount);
      setDiscountType('fixed');
      setIsLayaway(invoice.isLayaway);
      setDateError('');
    }
  }, [invoice, isOpen]);

  const calculateSubtotal = () => {
    return items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
  };

  const calculateTaxAmount = () => {
    const subtotal = calculateSubtotal();
    return taxType === 'percentage' ? (subtotal * tax) / 100 : tax;
  };

  const calculateDiscountAmount = () => {
    const subtotal = calculateSubtotal();
    return discountType === 'percentage' ? (subtotal * discount) / 100 : discount;
  };

  const calculateTotal = () => {
    return calculateSubtotal() + calculateTaxAmount() - calculateDiscountAmount();
  };

  const validateDate = (selectedDate: string) => {
    if (!selectedDate) {
      setDateError('');
      return true;
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selected = new Date(selectedDate);
    selected.setHours(0, 0, 0, 0);

    if (selected < today) {
      setDateError('Due date cannot be in the past');
      return false;
    }
    setDateError('');
    return true;
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = e.target.value;
    setDueDate(newDate);
    validateDate(newDate);
  };

  const handleUpdateInvoice = async () => {
    if (!invoice || !clientName.trim() || !dueDate) {
      return { success: false, error: 'Please fill in all required fields' };
    }

    if (!validateDate(dueDate)) {
      return { success: false, error: 'Invalid due date' };
    }

    if (items.length === 0 || items.some(item => !item.name.trim() || item.price <= 0)) {
      return { success: false, error: 'Please add at least one valid item' };
    }

    setIsUpdating(true);
    try {
      const subtotal = calculateSubtotal();
      
      const res = await fetch(`/api/invoices/${invoice.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName,
          items,
          subtotal,
          tax: calculateTaxAmount(),
          discount: calculateDiscountAmount(),
          dueDate,
          isLayaway,
        }),
      });

      if (res.ok) {
        onSuccess();
        onClose();
        return { success: true };
      } else {
        const error = await res.json();
        return { success: false, error: error.error || 'Failed to update invoice' };
      }
    } catch (error) {
      console.error('Failed to update invoice:', error);
      return { success: false, error: 'Failed to update invoice' };
    } finally {
      setIsUpdating(false);
    }
  };

  const footer = (
    <div className="flex justify-end space-x-4">
      <button
        onClick={onClose}
        className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-100 transition-colors"
        disabled={isUpdating}
      >
        Cancel
      </button>
      <button
        onClick={handleUpdateInvoice}
        disabled={isUpdating}
        className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:bg-blue-400 disabled:cursor-not-allowed flex items-center"
      >
        {isUpdating ? (
          <>
            <svg className="animate-spin h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Updating...
          </>
        ) : (
          'Update Invoice'
        )}
      </button>
    </div>
  );

  if (!invoice) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Edit Invoice ${invoice.invoiceNumber}`}
      footer={footer}
      maxWidth="4xl"
      headerColor="blue"
    >
      <div className="space-y-6">
        {/* Client Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Client Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 text-gray-900 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter client name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Due Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={handleDateChange}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 ${
                dateError ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {dateError && <p className="text-red-500 text-sm mt-1">{dateError}</p>}
          </div>
        </div>

        {/* Items Section */}
        <InvoiceItemsEditor items={items} onChange={setItems} />

        {/* Calculations */}
        <div className="border-t border-gray-200 pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              {/* Tax Section */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Tax
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setTaxType('fixed')}
                      className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                        taxType === 'fixed'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      $
                    </button>
                    <button
                      type="button"
                      onClick={() => setTaxType('percentage')}
                      className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                        taxType === 'percentage'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      %
                    </button>
                  </div>
                </div>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={tax || ''}
                  onChange={(e) => setTax(parseFloat(e.target.value) || 0)}
                  onBlur={(e) => {
                    const val = parseFloat(e.target.value);
                    if (!isNaN(val)) {
                      setTax(parseFloat(val.toFixed(2)));
                    }
                  }}
                  className="w-full px-4 py-2 border border-gray-300 text-gray-900 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="0.00"
                />
              </div>

              {/* Discount Section */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Discount
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setDiscountType('fixed')}
                      className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                        discountType === 'fixed'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      $
                    </button>
                    <button
                      type="button"
                      onClick={() => setDiscountType('percentage')}
                      className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                        discountType === 'percentage'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      %
                    </button>
                  </div>
                </div>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={discount || ''}
                  onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                  onBlur={(e) => {
                    const val = parseFloat(e.target.value);
                    if (!isNaN(val)) {
                      setDiscount(parseFloat(val.toFixed(2)));
                    }
                  }}
                  className="w-full px-4 py-2 border border-gray-300 text-gray-900 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="0.00"
                />
              </div>

              {/* Layaway Checkbox */}
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="editIsLayaway"
                  checked={isLayaway}
                  onChange={(e) => setIsLayaway(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 mr-2"
                />
                <label htmlFor="editIsLayaway" className="text-sm font-medium text-gray-700">
                  Mark as Layaway (Installment Payment Plan)
                </label>
              </div>
            </div>

            <InvoiceSummary
              subtotal={calculateSubtotal()}
              tax={tax}
              taxType={taxType}
              discount={discount}
              discountType={discountType}
              total={calculateTotal()}
            />
          </div>
        </div>
      </div>
    </Modal>
  );
}

// Export the handler for external use
export { EditInvoiceModal };
