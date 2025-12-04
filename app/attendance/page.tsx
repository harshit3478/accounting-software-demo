"use client";

import { useEffect, useState } from "react";
import Navigation from "../../components/Navigation";
import Link from "next/link";
import { generateAttendancePDF } from "../../lib/attendance-pdf-export";

export default function AttendancePage() {
  const [status, setStatus] = useState<string | null>(null);
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportStartDate, setExportStartDate] = useState("");
  const [exportEndDate, setExportEndDate] = useState("");
  const [exporting, setExporting] = useState(false);

  async function fetchStatus() {
    const res = await fetch("/api/attendance/status");
    if (res.ok) {
      const data = await res.json();
      setStatus(data.status);
    }
  }

  async function fetchHistory() {
    setLoading(true);
    try {
      const res = await fetch("/api/attendance/history?range=monthly&months=3");
      if (res.ok) {
        const data = await res.json();
        setEntries(data.entries || []);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchStatus();
    fetchHistory();
  }, []);

  async function doCheckIn() {
    setCheckingIn(true);
    try {
      const res = await fetch("/api/attendance/checkin", { method: "POST" });
      if (res.ok) {
        await fetchStatus();
        await fetchHistory();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Failed to check in");
      }
    } catch (err) {
      console.error(err);
      alert("Error performing check in");
    } finally {
      setCheckingIn(false);
    }
  }

  async function doCheckOut() {
    setCheckingOut(true);
    try {
      const res = await fetch("/api/attendance/checkout", { method: "POST" });
      if (res.ok) {
        await fetchStatus();
        await fetchHistory();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Failed to check out");
      }
    } catch (err) {
      console.error(err);
      alert("Error performing check out");
    } finally {
      setCheckingOut(false);
    }
  }

  async function handleExportPDF() {
    if (!exportStartDate || !exportEndDate) {
      alert("Please select both start and end dates");
      return;
    }

    setExporting(true);
    try {
      const url = `/api/attendance/export-pdf?startDate=${exportStartDate}&endDate=${exportEndDate}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        generateAttendancePDF(data.data);
        setShowExportModal(false);
        setExportStartDate("");
        setExportEndDate("");
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Failed to export attendance");
      }
    } catch (err) {
      console.error(err);
      alert("Error exporting attendance");
    } finally {
      setExporting(false);
    }
  }

  function setQuickRange(preset: string) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let start = new Date(today);
    const end = new Date(today);

    switch (preset) {
      case "thisMonth": {
        start = new Date(today.getFullYear(), today.getMonth(), 1);
        break;
      }
      case "lastMonth": {
        start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        end.setDate(0); // Last day of previous month
        break;
      }
      case "last3Months": {
        start.setMonth(today.getMonth() - 3);
        break;
      }
    }

    setExportStartDate(start.toISOString().split("T")[0]);
    setExportEndDate(end.toISOString().split("T")[0]);
  }

  return (
    <div className="bg-gray-50 hero-pattern min-h-screen">
      <Navigation />
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-4">My Attendance</h1>

        <div className="mb-4">
          <p className="text-sm text-gray-700">
            Current status: <strong>{status || "Loading..."}</strong>
          </p>
        </div>

        <div className="flex gap-3 mb-6 flex-wrap">
          <button
            onClick={doCheckIn}
            disabled={checkingIn}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:bg-gray-400"
          >
            {checkingIn ? "Checking In..." : "Check In"}
          </button>
          <button
            onClick={doCheckOut}
            disabled={checkingOut}
            className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 disabled:bg-gray-400"
          >
            {checkingOut ? "Checking Out..." : "Check Out"}
          </button>
          <button
            onClick={() => setShowExportModal(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 flex items-center gap-2"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            Export as PDF
          </button>
        </div>

        <div className="bg-white rounded shadow p-4">
          <h2 className="font-semibold mb-2">Recent Entries</h2>
          {loading ? (
            <p className="text-sm text-gray-500">Loading...</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500">
                  <th>Date</th>
                  <th>Check In</th>
                  <th>Check Out</th>
                  <th>Total Hours</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e: any) => (
                  <tr key={e.id} className="border-t">
                    <td className="py-2">
                      {new Date(e.date).toLocaleDateString()}
                    </td>
                    <td className="py-2">
                      {e.checkIn
                        ? new Date(e.checkIn).toLocaleTimeString()
                        : "-"}
                    </td>
                    <td className="py-2">
                      {e.checkOut
                        ? new Date(e.checkOut).toLocaleTimeString()
                        : "-"}
                    </td>
                    <td className="py-2">{e.totalHours ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="mt-6">
          <Link
            href="/attendance/regularization"
            className="inline-flex items-center px-3 py-2 bg-indigo-600 text-white text-sm font-medium rounded hover:bg-indigo-700"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 mr-2"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7V3m8 4V3M3 11h18M5 21h14a2 2 0 002-2V7H3v12a2 2 0 002 2z"
              />
            </svg>
            My Regularization Requests
          </Link>
        </div>
      </div>

      {/* Export PDF Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full">
            <h2 className="text-xl font-bold mb-4">Export Attendance as PDF</h2>
            
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-3">
                Select quick range or choose custom dates:
              </p>
              <div className="flex flex-wrap gap-2 mb-4">
                <button
                  onClick={() => setQuickRange("thisMonth")}
                  className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded"
                >
                  This Month
                </button>
                <button
                  onClick={() => setQuickRange("lastMonth")}
                  className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded"
                >
                  Last Month
                </button>
                <button
                  onClick={() => setQuickRange("last3Months")}
                  className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded"
                >
                  Last 3 Months
                </button>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={exportStartDate}
                onChange={(e) => setExportStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End Date
              </label>
              <input
                type="date"
                value={exportEndDate}
                onChange={(e) => setExportEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowExportModal(false);
                  setExportStartDate("");
                  setExportEndDate("");
                }}
                disabled={exporting}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleExportPDF}
                disabled={exporting || !exportStartDate || !exportEndDate}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {exporting ? "Exporting..." : "Export PDF"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
