'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Eye, Edit2, Trash2, X, ArrowUpDown } from 'lucide-react';
import ConfirmModal from '../ConfirmModal';

interface CustomerStats {
  totalRevenue: number;
  totalPaid: number;
  totalOutstanding: number;
  lastActivityDate: string | null;
  healthScore: 'green' | 'yellow' | 'red';
}

interface CustomerDetail {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  createdAt: string;
  _count: { invoices: number };
  stats: CustomerStats;
}

interface CustomerFull extends CustomerDetail {
  invoices: {
    id: number;
    invoiceNumber: string;
    clientName: string;
    amount: number;
    paidAmount: number;
    status: string;
    dueDate: string;
    createdAt: string;
  }[];
  stats: CustomerStats & {
    invoiceCount: number;
    aging: { current: number; days30: number; days60: number; days90: number };
  };
}

interface CustomersTabProps {
  showSuccess: (msg: string) => void;
  showError: (msg: string) => void;
}

const SORT_OPTIONS = [
  { value: 'revenue', label: 'Revenue (High to Low)' },
  { value: 'name', label: 'Name (A-Z)' },
  { value: 'outstanding', label: 'Outstanding (High to Low)' },
  { value: 'invoiceCount', label: 'Invoice Count' },
  { value: 'lastActivity', label: 'Last Activity' },
];

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

function HealthBadge({ score }: { score: 'green' | 'yellow' | 'red' }) {
  const styles = {
    green: 'bg-green-100 text-green-800',
    yellow: 'bg-yellow-100 text-yellow-800',
    red: 'bg-red-100 text-red-800',
  };
  const labels = { green: 'Good', yellow: 'At Risk', red: 'Critical' };
  return (
    <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${styles[score]}`}>
      {labels[score]}
    </span>
  );
}

export default function CustomersTab({ showSuccess, showError }: CustomersTabProps) {
  const [customers, setCustomers] = useState<CustomerDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('revenue');
  const [showTopOnly, setShowTopOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Modal states
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<CustomerDetail | null>(null);
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', address: '', notes: '' });
  const [formSaving, setFormSaving] = useState(false);

  const [viewingCustomer, setViewingCustomer] = useState<CustomerFull | null>(null);
  const [viewLoading, setViewLoading] = useState(false);

  const [deleteConfirm, setDeleteConfirm] = useState<{ id: number; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '50',
        sortBy,
      });
      if (search) params.set('search', search);
      if (showTopOnly) params.set('top', '10');

      const res = await fetch(`/api/customers?${params}`);
      if (res.ok) {
        const data = await res.json();
        setCustomers(data.customers);
        setTotalPages(data.pagination.totalPages);
      }
    } finally {
      setLoading(false);
    }
  }, [page, search, sortBy, showTopOnly]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  // Debounced search
  const [searchInput, setSearchInput] = useState('');
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const openCreateModal = () => {
    setEditingCustomer(null);
    setFormData({ name: '', email: '', phone: '', address: '', notes: '' });
    setShowFormModal(true);
  };

  const openEditModal = (c: CustomerDetail) => {
    setEditingCustomer(c);
    setFormData({
      name: c.name,
      email: c.email || '',
      phone: c.phone || '',
      address: c.address || '',
      notes: c.notes || '',
    });
    setShowFormModal(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;
    setFormSaving(true);
    try {
      const url = editingCustomer ? `/api/customers/${editingCustomer.id}` : '/api/customers';
      const method = editingCustomer ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        showSuccess(editingCustomer ? 'Customer updated' : 'Customer created');
        setShowFormModal(false);
        fetchCustomers();
      } else {
        const data = await res.json();
        showError(data.error || 'Failed to save customer');
      }
    } finally {
      setFormSaving(false);
    }
  };

  const viewCustomer = async (id: number) => {
    setViewLoading(true);
    setViewingCustomer(null);
    try {
      const res = await fetch(`/api/customers/${id}`);
      if (res.ok) {
        const data = await res.json();
        setViewingCustomer(data);
      } else {
        showError('Failed to load customer details');
      }
    } finally {
      setViewLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/customers/${deleteConfirm.id}`, { method: 'DELETE' });
      if (res.ok) {
        showSuccess('Customer deleted');
        setDeleteConfirm(null);
        fetchCustomers();
      } else {
        const data = await res.json();
        showError(data.error || 'Failed to delete customer');
      }
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-1">Clients</h2>
          <p className="text-gray-600 text-sm">Manage your clients and view business metrics</p>
        </div>
        <button
          onClick={openCreateModal}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center text-sm"
        >
          <Plus size={16} className="mr-1.5" />
          New Client
        </button>
      </div>

      {/* Search & Sort Controls */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by name, email, or phone..."
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div className="flex gap-2">
          <select
            value={sortBy}
            onChange={(e) => { setSortBy(e.target.value); setPage(1); }}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 focus:ring-2 focus:ring-blue-500"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <button
            onClick={() => { setShowTopOnly(!showTopOnly); setPage(1); }}
            className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
              showTopOnly
                ? 'bg-blue-50 text-blue-700 border-blue-200'
                : 'text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
          >
            Top 10
          </button>
        </div>
      </div>

      {/* Customer List Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-600">Loading clients...</span>
          </div>
        ) : customers.length === 0 ? (
          <div className="py-12 text-center text-gray-500">
            {search ? 'No clients found matching your search.' : 'No clients yet. Create your first client to get started.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  {sortBy === 'revenue' && (
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-10">#</th>
                  )}
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Client</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Health</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Invoices</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Revenue</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Outstanding</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Last Activity</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {customers.map((c, index) => (
                  <tr key={c.id} className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50 transition duration-150`}>
                    {sortBy === 'revenue' && (
                      <td className="px-4 py-3 text-gray-400 font-medium">#{index + 1 + (page - 1) * 50}</td>
                    )}
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{c.name}</div>
                      {(c.email || c.phone) && (
                        <div className="text-xs text-gray-500">
                          {c.email}{c.email && c.phone ? ' · ' : ''}{c.phone}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <HealthBadge score={c.stats.healthScore} />
                    </td>
                    <td className="px-4 py-3 text-right text-gray-900">{c._count.invoices}</td>
                    <td className="px-4 py-3 text-right text-gray-900 font-medium">
                      {formatCurrency(c.stats.totalRevenue)}
                    </td>
                    <td className={`px-4 py-3 text-right font-medium ${c.stats.totalOutstanding > 0 ? 'text-red-600' : 'text-gray-900'}`}>
                      {formatCurrency(c.stats.totalOutstanding)}
                    </td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                      {c.stats.lastActivityDate
                        ? new Date(c.stats.lastActivityDate).toLocaleDateString()
                        : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => viewCustomer(c.id)}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                          title="View details"
                        >
                          <Eye size={15} />
                        </button>
                        <button
                          onClick={() => openEditModal(c)}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                          title="Edit"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          onClick={() => setDeleteConfirm({ id: c.id, name: c.name })}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                          title="Delete"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && !showTopOnly && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50"
          >
            Previous
          </button>
          <span className="text-sm text-gray-600">Page {page} of {totalPages}</span>
          <button
            onClick={() => setPage(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50"
          >
            Next
          </button>
        </div>
      )}

      {/* Create/Edit Customer Modal */}
      {showFormModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="absolute inset-0 bg-black/50" onClick={() => !formSaving && setShowFormModal(false)} />
          <div className="relative bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-800">
                {editingCustomer ? 'Edit Client' : 'New Client'}
              </h2>
              <button onClick={() => setShowFormModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
            </div>
            <div className="p-6">
              <form onSubmit={handleFormSubmit}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Client name"
                      required
                      className="w-full border text-gray-900 border-gray-300 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="client@example.com"
                        className="w-full border text-gray-900 border-gray-300 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                      <input
                        type="text"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        placeholder="Phone number"
                        className="w-full border text-gray-900 border-gray-300 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                    <textarea
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      placeholder="Full address"
                      rows={2}
                      className="w-full border text-gray-900 border-gray-300 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                    <textarea
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="Internal notes about this client"
                      rows={2}
                      className="w-full border text-gray-900 border-gray-300 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-6">
                  <button
                    type="submit"
                    disabled={formSaving}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-2.5 rounded-lg transition duration-200 disabled:opacity-50"
                  >
                    {formSaving ? 'Saving...' : editingCustomer ? 'Update Client' : 'Create Client'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowFormModal(false)}
                    disabled={formSaving}
                    className="bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium px-6 py-2.5 rounded-lg transition duration-200"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Customer Detail Modal */}
      {(viewingCustomer || viewLoading) && (
        <div className="fixed inset-0 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="absolute inset-0 bg-black/50" onClick={() => { setViewingCustomer(null); setViewLoading(false); }} />
          <div className="relative bg-white rounded-lg shadow-xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            {viewLoading && !viewingCustomer ? (
              <div className="p-12 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-3 text-gray-600">Loading...</span>
              </div>
            ) : viewingCustomer && (
              <>
                <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-800">{viewingCustomer.name}</h2>
                    <div className="flex items-center gap-2 mt-1">
                      <HealthBadge score={viewingCustomer.stats.healthScore} />
                      {viewingCustomer.email && <span className="text-xs text-gray-500">{viewingCustomer.email}</span>}
                      {viewingCustomer.phone && <span className="text-xs text-gray-500">· {viewingCustomer.phone}</span>}
                    </div>
                  </div>
                  <button onClick={() => setViewingCustomer(null)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
                </div>

                <div className="p-6">
                  {/* Contact Info */}
                  {(viewingCustomer.address || viewingCustomer.notes) && (
                    <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                      {viewingCustomer.address && (
                        <div className="mb-2">
                          <span className="text-xs font-semibold text-gray-500 uppercase">Address</span>
                          <p className="text-sm text-gray-900 mt-0.5">{viewingCustomer.address}</p>
                        </div>
                      )}
                      {viewingCustomer.notes && (
                        <div>
                          <span className="text-xs font-semibold text-gray-500 uppercase">Notes</span>
                          <p className="text-sm text-gray-900 mt-0.5">{viewingCustomer.notes}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Financial Summary Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                    <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                      <p className="text-xs text-blue-600 font-semibold uppercase">Revenue</p>
                      <p className="text-lg font-bold text-blue-900 mt-1">{formatCurrency(viewingCustomer.stats.totalRevenue)}</p>
                    </div>
                    <div className="bg-green-50 rounded-lg p-3 border border-green-100">
                      <p className="text-xs text-green-600 font-semibold uppercase">Paid</p>
                      <p className="text-lg font-bold text-green-900 mt-1">{formatCurrency(viewingCustomer.stats.totalPaid)}</p>
                    </div>
                    <div className={`rounded-lg p-3 border ${viewingCustomer.stats.totalOutstanding > 0 ? 'bg-red-50 border-red-100' : 'bg-gray-50 border-gray-200'}`}>
                      <p className={`text-xs font-semibold uppercase ${viewingCustomer.stats.totalOutstanding > 0 ? 'text-red-600' : 'text-gray-600'}`}>Outstanding</p>
                      <p className={`text-lg font-bold mt-1 ${viewingCustomer.stats.totalOutstanding > 0 ? 'text-red-900' : 'text-gray-900'}`}>
                        {formatCurrency(viewingCustomer.stats.totalOutstanding)}
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                      <p className="text-xs text-gray-600 font-semibold uppercase">Invoices</p>
                      <p className="text-lg font-bold text-gray-900 mt-1">{viewingCustomer.stats.invoiceCount}</p>
                    </div>
                  </div>

                  {/* Aging Breakdown */}
                  {viewingCustomer.stats.totalOutstanding > 0 && (
                    <div className="mb-6">
                      <h3 className="text-sm font-semibold text-gray-700 mb-2">Aging Breakdown</h3>
                      <div className="grid grid-cols-4 gap-2">
                        {[
                          { label: 'Current', value: viewingCustomer.stats.aging.current, color: 'text-gray-700' },
                          { label: '31-60 days', value: viewingCustomer.stats.aging.days30, color: 'text-yellow-700' },
                          { label: '61-90 days', value: viewingCustomer.stats.aging.days60, color: 'text-orange-700' },
                          { label: '90+ days', value: viewingCustomer.stats.aging.days90, color: 'text-red-700' },
                        ].map((bucket) => (
                          <div key={bucket.label} className="bg-gray-50 rounded p-2 text-center border border-gray-200">
                            <p className="text-xs text-gray-500">{bucket.label}</p>
                            <p className={`text-sm font-semibold mt-0.5 ${bucket.color}`}>
                              {formatCurrency(bucket.value)}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Invoice History */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">Invoice History</h3>
                    {viewingCustomer.invoices.length === 0 ? (
                      <p className="text-sm text-gray-500 py-4 text-center">No invoices found.</p>
                    ) : (
                      <div className="overflow-x-auto border border-gray-200 rounded-lg">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-gray-50 border-b border-gray-200">
                              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Invoice #</th>
                              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Date</th>
                              <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600">Amount</th>
                              <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600">Paid</th>
                              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {viewingCustomer.invoices.map((inv) => (
                              <tr key={inv.id} className="hover:bg-gray-50">
                                <td className="px-3 py-2 text-blue-600 font-medium">{inv.invoiceNumber}</td>
                                <td className="px-3 py-2 text-gray-600 whitespace-nowrap">
                                  {new Date(inv.createdAt).toLocaleDateString()}
                                </td>
                                <td className="px-3 py-2 text-right text-gray-900">{formatCurrency(Number(inv.amount))}</td>
                                <td className="px-3 py-2 text-right text-gray-900">{formatCurrency(Number(inv.paidAmount))}</td>
                                <td className="px-3 py-2">
                                  <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                                    inv.status === 'paid' ? 'bg-green-100 text-green-800' :
                                    inv.status === 'overdue' ? 'bg-red-100 text-red-800' :
                                    inv.status === 'partial' ? 'bg-yellow-100 text-yellow-800' :
                                    'bg-gray-100 text-gray-800'
                                  }`}>
                                    {inv.status}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Last Activity */}
                  {viewingCustomer.stats.lastActivityDate && (
                    <p className="text-xs text-gray-400 mt-4">
                      Last activity: {new Date(viewingCustomer.stats.lastActivityDate).toLocaleDateString()}
                      {' · '}Client since: {new Date(viewingCustomer.createdAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <ConfirmModal
        isOpen={!!deleteConfirm}
        title="Delete Client"
        message={`Are you sure you want to delete "${deleteConfirm?.name}"? Their invoices will be preserved but unlinked from this client.`}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={handleDelete}
        onCancel={() => setDeleteConfirm(null)}
        isLoading={deleting}
        danger={true}
      />
    </div>
  );
}
