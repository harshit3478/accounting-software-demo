"use client";

import Navigation from "@/components/Navigation";
import { useEffect, useState } from "react";
// import Navigation from "../../components/Navigation";

export default function MyRegularizations() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [newRequest, setNewRequest] = useState({
    forDate: new Date().toISOString().slice(0, 10),
    type: "manual",
    requestedCheckIn: "",
    requestedCheckOut: "",
    reason: "",
  });

  useEffect(() => {
    fetchItems();
  }, []);

  async function fetchItems() {
    setLoading(true);
    try {
      const res = await fetch("/api/attendance/regularization/user");
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
      } else {
        // ignore or show error
      }
    } finally {
      setLoading(false);
    }
  }

  async function submitRequest(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const body: any = { ...newRequest };
      if (!body.requestedCheckIn) delete body.requestedCheckIn;
      if (!body.requestedCheckOut) delete body.requestedCheckOut;

      const res = await fetch("/api/attendance/regularization", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setNewRequest({
          forDate: new Date().toISOString().slice(0, 10),
          type: "manual",
          requestedCheckIn: "",
          requestedCheckOut: "",
          reason: "",
        });
        await fetchItems();
      } else {
        const d = await res.json();
        alert(d.error || "Failed");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="bg-gray-50 hero-pattern min-h-screen">
      <Navigation />
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-4">My Regularization Requests</h1>

        <div className="bg-white rounded shadow p-4 mb-6">
          <form
            onSubmit={submitRequest}
            className="grid grid-cols-1 md:grid-cols-2 gap-3"
          >
            <div>
              <label className="block text-sm text-gray-700 mb-1">
                For Date
              </label>
              <input
                type="date"
                value={newRequest.forDate}
                onChange={(e) =>
                  setNewRequest({ ...newRequest, forDate: e.target.value })
                }
                className="w-full border p-2 rounded"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Type</label>
              <select
                value={newRequest.type}
                onChange={(e) =>
                  setNewRequest({ ...newRequest, type: e.target.value })
                }
                className="w-full border p-2 rounded"
              >
                <option value="checkin">Log In</option>
                <option value="checkout">Log Out</option>
                <option value="both">Both</option>
                <option value="manual">Manual</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">
                Requested Log In (optional)
              </label>
              <input
                type="time"
                value={newRequest.requestedCheckIn}
                onChange={(e) =>
                  setNewRequest({
                    ...newRequest,
                    requestedCheckIn: e.target.value,
                  })
                }
                className="w-full border p-2 rounded"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">
                Requested Log Out (optional)
              </label>
              <input
                type="time"
                value={newRequest.requestedCheckOut}
                onChange={(e) =>
                  setNewRequest({
                    ...newRequest,
                    requestedCheckOut: e.target.value,
                  })
                }
                className="w-full border p-2 rounded"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm text-gray-700 mb-1">Reason</label>
              <textarea
                value={newRequest.reason}
                onChange={(e) =>
                  setNewRequest({ ...newRequest, reason: e.target.value })
                }
                className="w-full border p-2 rounded"
                rows={3}
              />
            </div>
            <div className="md:col-span-2 flex items-center gap-3">
              <button
                type="submit"
                disabled={submitting}
                className="bg-blue-600 text-white px-4 py-2 rounded"
              >
                {submitting ? "Sending..." : "Send Request"}
              </button>
              <button
                type="button"
                onClick={() =>
                  setNewRequest({
                    forDate: new Date().toISOString().slice(0, 10),
                    type: "manual",
                    requestedCheckIn: "",
                    requestedCheckOut: "",
                    reason: "",
                  })
                }
                className="bg-gray-200 px-4 py-2 rounded"
              >
                Reset
              </button>
            </div>
          </form>
        </div>

        <div className="bg-white rounded shadow p-4">
          <h2 className="font-semibold mb-2">My Requests</h2>
          {loading ? (
            <p>Loading...</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-gray-500">No requests found.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500">
                  <th className="px-4 py-2">Date</th>
                  <th className="px-4 py-2">Type</th>
                  <th className="px-4 py-2">Requested In</th>
                  <th className="px-4 py-2">Requested Out</th>
                  <th className="px-4 py-2">Reason</th>
                  <th className="px-4 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="px-4 py-2">
                      {new Date(r.forDate).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-2">{r.type}</td>
                    <td className="px-4 py-2">
                      {r.requestedCheckIn
                        ? new Date(r.requestedCheckIn).toLocaleTimeString()
                        : "-"}
                    </td>
                    <td className="px-4 py-2">
                      {r.requestedCheckOut
                        ? new Date(r.requestedCheckOut).toLocaleTimeString()
                        : "-"}
                    </td>
                    <td className="px-4 py-2 text-gray-600">
                      {r.reason || "-"}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`px-2 py-1 rounded text-xs font-semibold ${
                          r.status === "pending"
                            ? "bg-yellow-100 text-yellow-800"
                            : r.status === "approved"
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {r.status}
                      </span>
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
