'use client';

import { useState, useEffect } from 'react';
import { FiCheck, FiX, FiPlus, FiEdit2, FiTrash2 } from 'react-icons/fi';
import LucideIcon from '../LucideIcon';
import IconPicker from './IconPicker';

interface PaymentMethodType {
  id: number;
  name: string;
  icon: string | null;
  color: string;
  isActive: boolean;
  isSystem: boolean;
  sortOrder: number;
}

interface PaymentMethodsTabProps {
  showSuccess: (msg: string) => void;
  showError: (msg: string) => void;
}

export default function PaymentMethodsTab({ showSuccess, showError }: PaymentMethodsTabProps) {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodType[]>([]);
  const [pmLoading, setPmLoading] = useState(true);
  const [showAddPM, setShowAddPM] = useState(false);
  const [editingPM, setEditingPM] = useState<PaymentMethodType | null>(null);
  const [pmForm, setPmForm] = useState({ name: '', icon: '', color: '#6B7280' });
  const [pmSaving, setPmSaving] = useState(false);

  useEffect(() => {
    fetchPaymentMethods();
  }, []);

  const fetchPaymentMethods = async () => {
    setPmLoading(true);
    try {
      const res = await fetch('/api/payment-methods?all=true');
      if (res.ok) {
        const data = await res.json();
        setPaymentMethods(data);
      }
    } catch (error) {
      console.error('Failed to fetch payment methods:', error);
    } finally {
      setPmLoading(false);
    }
  };

  const handleAddPM = async () => {
    if (!pmForm.name.trim()) return;
    setPmSaving(true);
    try {
      const res = await fetch('/api/payment-methods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pmForm),
      });
      if (res.ok) {
        showSuccess(`Payment method "${pmForm.name}" created`);
        setShowAddPM(false);
        setPmForm({ name: '', icon: '', color: '#6B7280' });
        fetchPaymentMethods();
      } else {
        const err = await res.json();
        showError(err.error || 'Failed to create payment method');
      }
    } catch {
      showError('Failed to create payment method');
    } finally {
      setPmSaving(false);
    }
  };

  const handleUpdatePM = async () => {
    if (!editingPM) return;
    setPmSaving(true);
    try {
      const res = await fetch('/api/payment-methods', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingPM.id, ...pmForm }),
      });
      if (res.ok) {
        showSuccess('Payment method updated');
        setEditingPM(null);
        setPmForm({ name: '', icon: '', color: '#6B7280' });
        fetchPaymentMethods();
      } else {
        const err = await res.json();
        showError(err.error || 'Failed to update payment method');
      }
    } catch {
      showError('Failed to update payment method');
    } finally {
      setPmSaving(false);
    }
  };

  const handleDeletePM = async (pm: PaymentMethodType) => {
    if (!confirm(`Delete "${pm.name}"? If it has existing payments, it will be deactivated instead.`)) return;
    try {
      const res = await fetch('/api/payment-methods', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: pm.id }),
      });
      if (res.ok) {
        const data = await res.json();
        showSuccess(data.message);
        fetchPaymentMethods();
      } else {
        const err = await res.json();
        showError(err.error || 'Failed to delete payment method');
      }
    } catch {
      showError('Failed to delete payment method');
    }
  };

  const handleTogglePM = async (pm: PaymentMethodType) => {
    try {
      const res = await fetch('/api/payment-methods', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: pm.id, isActive: !pm.isActive }),
      });
      if (res.ok) {
        showSuccess(`${pm.name} ${pm.isActive ? 'deactivated' : 'activated'}`);
        fetchPaymentMethods();
      } else {
        const err = await res.json();
        showError(err.error);
      }
    } catch {
      showError('Failed to update payment method');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-1">Payment Methods</h2>
          <p className="text-gray-600 text-sm">Manage available payment methods for recording payments</p>
        </div>
        <button
          onClick={() => {
            setPmForm({ name: '', icon: '', color: '#6B7280' });
            setShowAddPM(true);
            setEditingPM(null);
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center text-sm"
        >
          <FiPlus className="mr-1.5" />
          Add Method
        </button>
      </div>

      {/* Add/Edit Form */}
      {(showAddPM || editingPM) && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
          <h3 className="font-medium text-gray-900 mb-3">
            {editingPM ? `Edit "${editingPM.name}"` : 'Add Payment Method'}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Name *</label>
              <input
                type="text"
                value={pmForm.name}
                onChange={(e) => setPmForm({ ...pmForm, name: e.target.value })}
                placeholder="e.g. Bank of America"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900"
                disabled={editingPM?.isSystem}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Icon</label>
              <IconPicker
                value={pmForm.icon}
                onChange={(icon) => setPmForm({ ...pmForm, icon })}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Color</label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={pmForm.color}
                  onChange={(e) => setPmForm({ ...pmForm, color: e.target.value })}
                  className="h-[38px] w-12 border border-gray-300 rounded cursor-pointer"
                />
                <input
                  type="text"
                  value={pmForm.color}
                  onChange={(e) => setPmForm({ ...pmForm, color: e.target.value })}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900"
                />
              </div>
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={editingPM ? handleUpdatePM : handleAddPM}
              disabled={pmSaving || !pmForm.name.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm disabled:opacity-50"
            >
              {pmSaving ? 'Saving...' : editingPM ? 'Update' : 'Create'}
            </button>
            <button
              onClick={() => { setShowAddPM(false); setEditingPM(null); }}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Methods List */}
      {pmLoading ? (
        <div className="flex items-center justify-center py-6">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div className="space-y-2">
          {paymentMethods.map((pm) => (
            <div
              key={pm.id}
              className={`flex items-center justify-between p-3 rounded-lg border ${
                pm.isActive ? 'border-gray-200 bg-white' : 'border-gray-100 bg-gray-50 opacity-60'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded-md flex items-center justify-center"
                  style={{ backgroundColor: `${pm.color}20`, color: pm.color }}
                >
                  <LucideIcon name={pm.icon} fallback={pm.name} size={16} />
                </div>
                <span className="font-medium text-gray-900">{pm.name}</span>
                {pm.isSystem && (
                  <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full">System</span>
                )}
                {!pm.isActive && (
                  <span className="text-xs px-2 py-0.5 bg-red-50 text-red-500 rounded-full">Inactive</span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    setEditingPM(pm);
                    setPmForm({ name: pm.name, icon: pm.icon || '', color: pm.color });
                    setShowAddPM(false);
                  }}
                  className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                  title="Edit"
                >
                  <FiEdit2 size={14} />
                </button>
                {!pm.isSystem && (
                  <>
                    <button
                      onClick={() => handleTogglePM(pm)}
                      className={`p-1.5 rounded text-xs ${
                        pm.isActive
                          ? 'text-gray-400 hover:text-amber-600 hover:bg-amber-50'
                          : 'text-green-500 hover:text-green-700 hover:bg-green-50'
                      }`}
                      title={pm.isActive ? 'Deactivate' : 'Activate'}
                    >
                      {pm.isActive ? <FiX size={14} /> : <FiCheck size={14} />}
                    </button>
                    <button
                      onClick={() => handleDeletePM(pm)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                      title="Delete"
                    >
                      <FiTrash2 size={14} />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
