'use client';

import { useEffect, useState } from 'react';

interface RequestItem {
  id: number;
  userId: number;
  forDate: string;
  type: string;
  requestedCheckIn?: string;
  requestedCheckOut?: string;
  reason?: string;
  status: string;
  reviewedBy?: number;
  createdAt: string;
  user?: { id: number; name?: string; email?: string };
}

interface RegularizationsTabProps {
  showSuccess: (msg: string) => void;
  showError: (msg: string) => void;
}

export default function RegularizationsTab({ showSuccess, showError }: RegularizationsTabProps) {
  const [items, setItems] = useState<RequestItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  useEffect(() => {
    fetchItems();
  }, []);

  async function fetchItems() {
    setLoading(true);
    try {
      const res = await fetch('/api/attendance/admin/regularization/list');
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
      }
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(id: number, status: string) {
    setUpdatingId(id);
    try {
      const res = await fetch(`/api/attendance/admin/regularization/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        showSuccess(`Request ${status}`);
        await fetchItems();
      } else {
        const data = await res.json();
        showError(data.error || 'Failed to update');
      }
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-1">Regularization Requests</h2>
        <p className="text-gray-600 text-sm">Review and manage employee regularization requests</p>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-600">Loading requests...</span>
          </div>
        ) : (
          <div>
            <table className="w-full text-sm table-fixed">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-[15%]">User</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-[8%]">Date</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-[6%]">Type</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-[8%]">Req. In</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-[8%]">Req. Out</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-[30%]">Reason</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-[10%]">Status</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-[15%]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {items.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                      No regularization requests found.
                    </td>
                  </tr>
                )}
                {items.map((it, index) => (
                  <tr key={it.id} className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50 transition duration-150`}>
                    <td className="px-3 py-3">
                      <div className="font-medium text-gray-900 text-xs break-words">{it.user?.name || `User ${it.userId}`}</div>
                      <div className="text-xs text-gray-500 break-words">{it.user?.email}</div>
                    </td>
                    <td className="px-3 py-3 text-gray-900 text-xs">
                      {new Date(it.forDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
                    </td>
                    <td className="px-3 py-3 capitalize text-gray-900 text-xs">{it.type}</td>
                    <td className="px-3 py-3 text-gray-700 text-xs">
                      {it.requestedCheckIn ? new Date(it.requestedCheckIn).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '-'}
                    </td>
                    <td className="px-3 py-3 text-gray-700 text-xs">
                      {it.requestedCheckOut ? new Date(it.requestedCheckOut).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '-'}
                    </td>
                    <td className="px-3 py-3 text-gray-600 text-xs break-words">
                      {it.reason || '-'}
                    </td>
                    <td className="px-3 py-3">
                      <span className={`px-2 py-1 rounded text-xs font-semibold inline-block ${
                        it.status === 'pending'
                          ? 'bg-yellow-100 text-yellow-800'
                          : it.status === 'approved'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {it.status}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-col gap-1.5">
                        {it.status === 'pending' ? (
                          <>
                            <button
                              disabled={updatingId !== null}
                              onClick={() => updateStatus(it.id, 'approved')}
                              className="bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded text-xs disabled:opacity-50 w-full"
                            >
                              {updatingId === it.id ? '...' : 'Approve'}
                            </button>
                            <button
                              disabled={updatingId !== null}
                              onClick={() => updateStatus(it.id, 'rejected')}
                              className="bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded text-xs disabled:opacity-50 w-full"
                            >
                              {updatingId === it.id ? '...' : 'Reject'}
                            </button>
                          </>
                        ) : (
                          <button
                            disabled={updatingId !== null}
                            onClick={() => updateStatus(it.id, 'pending')}
                            className="bg-gray-600 hover:bg-gray-700 text-white px-2 py-1 rounded text-xs disabled:opacity-50 w-full"
                          >
                            {updatingId === it.id ? '...' : 'Review'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
