"use client";

import { useEffect, useState } from "react";
import Navigation from "../../../../components/Navigation";

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

export default function RegularizationsAdminPage() {
  const [items, setItems] = useState<RequestItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  useEffect(() => {
    fetchItems();
  }, []);

  async function fetchItems() {
    setLoading(true);
    try {
      const res = await fetch("/api/attendance/admin/regularization/list");
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
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        await fetchItems();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to update");
      }
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="bg-gray-50 hero-pattern min-h-screen">
      <Navigation />
      <div className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-4">Regularization Requests</h1>
        <p className="text-sm text-gray-600 mb-6">
          All user submitted regularization requests. Approve or reject them
          from here.
        </p>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          {loading ? (
            <div className="p-6">Loading...</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-xs text-gray-500">
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Requested In</th>
                  <th className="px-4 py-3">Requested Out</th>
                  <th className="px-4 py-3">Reason</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 && (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-6 text-center text-gray-500"
                    >
                      No regularization requests found.
                    </td>
                  </tr>
                )}
                {items.map((it) => (
                  <tr key={it.id} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium">
                        {it.user?.name || `User ${it.userId}`}
                      </div>
                      <div className="text-xs text-gray-500">
                        {it.user?.email}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {new Date(it.forDate).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 capitalize">{it.type}</td>
                    <td className="px-4 py-3">
                      {it.requestedCheckIn
                        ? new Date(it.requestedCheckIn).toLocaleTimeString()
                        : "-"}
                    </td>
                    <td className="px-4 py-3">
                      {it.requestedCheckOut
                        ? new Date(it.requestedCheckOut).toLocaleTimeString()
                        : "-"}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {it.reason || "-"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-1 rounded text-xs font-semibold ${
                          it.status === "pending"
                            ? "bg-yellow-100 text-yellow-800"
                            : it.status === "approved"
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {it.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {it.status === "pending" ? (
                          <>
                            <button
                              disabled={updatingId !== null}
                              onClick={() => updateStatus(it.id, "approved")}
                              className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-xs disabled:opacity-50"
                            >
                              {updatingId === it.id ? "Updating..." : "Approve"}
                            </button>
                            <button
                              disabled={updatingId !== null}
                              onClick={() => updateStatus(it.id, "rejected")}
                              className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-xs disabled:opacity-50"
                            >
                              {updatingId === it.id ? "Updating..." : "Reject"}
                            </button>
                          </>
                        ) : (
                          <button
                            disabled={updatingId !== null}
                            onClick={() => updateStatus(it.id, "pending")}
                            className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-1 rounded text-xs disabled:opacity-50"
                          >
                            {updatingId === it.id ? "Updating..." : "Review"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
