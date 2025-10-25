'use client';

import { useState } from 'react';
import Modal from './Modal';
import PreviewInvoiceModal from './PreviewInvoiceModal';
import InvoiceItemsEditor from './InvoiceItemsEditor';
import InvoiceSummary from './InvoiceSummary';
import { InvoiceItem } from './types';

interface CreateInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onError?: (message: string) => void;
}

export default function CreateInvoiceModal({ isOpen, onClose, onSuccess, onError }: CreateInvoiceModalProps) {
  const [clientName, setClientName] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [items, setItems] = useState<InvoiceItem[]>([{ name: '', quantity: 1, price: 0 }]);
  const [tax, setTax] = useState(0);
  const [taxType, setTaxType] = useState<'fixed' | 'percentage'>('fixed');
  const [discount, setDiscount] = useState(0);
  const [discountType, setDiscountType] = useState<'fixed' | 'percentage'>('fixed');
  const [isLayaway, setIsLayaway] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [dateError, setDateError] = useState('');

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

  const resetForm = () => {
    setClientName('');
    setDueDate('');
    setItems([{ name: '', quantity: 1, price: 0 }]);
    setTax(0);
    setTaxType('fixed');
    setDiscount(0);
    setDiscountType('fixed');
    setIsLayaway(false);
    setDateError('');
  };

  const handleCreateInvoice = async () => {
    if (!clientName.trim() || !dueDate) {
      onError?.('Please fill in all required fields');
      return;
    }

    if (!validateDate(dueDate)) {
      return;
    }

    if (items.length === 0 || items.some(item => !item.name.trim() || item.price <= 0)) {
      onError?.('Please add at least one valid item');
      return;
    }

    // Show preview instead of creating directly
    setShowPreview(true);
  };

  const handleConfirmCreate = async () => {
    setIsCreating(true);
    try {
      const subtotal = calculateSubtotal();
      
      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName,
          dueDate,
          items,
          subtotal,
          tax: calculateTaxAmount(),
          discount: calculateDiscountAmount(),
          isLayaway,
        }),
      });

      if (res.ok) {
        resetForm();
        setShowPreview(false);
        onClose();
        onSuccess();
      } else {
        const error = await res.json();
        onError?.(error.error || 'Failed to create invoice');
      }
    } catch (error) {
      console.error('Failed to create invoice:', error);
      onError?.('Failed to create invoice');
    } finally {
      setIsCreating(false);
    }
  };

  const handleClose = () => {
    if (!isCreating) {
      resetForm();
      onClose();
    }
  };

  const footer = (
    <div className="flex justify-end space-x-4">
      <button
        onClick={handleClose}
        className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-100 transition-colors"
        disabled={isCreating}
      >
        Cancel
      </button>
      <button
        onClick={handleCreateInvoice}
        disabled={isCreating}
        className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:bg-blue-400 disabled:cursor-not-allowed flex items-center"
      >
        {isCreating ? (
          <>
            <svg className="animate-spin h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Creating...
          </>
        ) : (
          'Preview & Create'
        )}
      </button>
    </div>
  );

  return (
    <>
      <Modal
        isOpen={isOpen && !showPreview}
        onClose={handleClose}
        title="Create New Invoice"
        footer={footer}
        maxWidth="4xl"
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
                  id="isLayaway"
                  checked={isLayaway}
                  onChange={(e) => setIsLayaway(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 mr-2"
                />
                <label htmlFor="isLayaway" className="text-sm font-medium text-gray-700">
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

      <PreviewInvoiceModal
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
        onConfirm={handleConfirmCreate}
        clientName={clientName}
        dueDate={dueDate}
        items={items}
        subtotal={calculateSubtotal()}
        tax={tax}
        taxType={taxType}
        discount={discount}
        discountType={discountType}
        total={calculateTotal()}
        isLayaway={isLayaway}
        isSubmitting={isCreating}
      />
    </>
  );
}
