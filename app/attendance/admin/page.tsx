"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Navigation from "../../../components/Navigation";
import AttendanceFilters, {
  DateRange,
} from "../../../components/attendance/AttendanceFilters";
import { generateAttendancePDF } from "../../../lib/attendance-pdf-export";

interface User {
  id: number;
  name?: string;
  email?: string;
  role?: string;
  createdAt?: string;
}

function AttendanceAdminContent() {
  const params = useSearchParams();
  const userId = params?.get("userId");
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [loadingUser, setLoadingUser] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange | null>(null);
  const [currentPreset, setCurrentPreset] = useState<string>("thisMonth");

  // Export states
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportStartDate, setExportStartDate] = useState("");
  const [exportEndDate, setExportEndDate] = useState("");
  const [exporting, setExporting] = useState(false);

  const WORKING_HOURS = parseFloat(process.env.NEXT_PUBLIC_WORKING_HOURS_PER_DAY || "8");

  useEffect(() => {
    if (userId) {
      fetchUserDetails(userId);
      // Initialize with default "This Month" filter
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const defaultRange = {
        start: start.toISOString().split("T")[0],
        end: today.toISOString().split("T")[0],
      };
      setDateRange(defaultRange);
      fetchForUser(userId, defaultRange);
    }
  }, [userId]);

  async function fetchForUser(id: string, range?: DateRange | null) {
    setLoading(true);
    try {
      let url = `/api/attendance/admin/user/${id}`;
      if (range?.start && range?.end) {
        url += `?startDate=${range.start}&endDate=${range.end}`;
      }
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setEntries(data.entries || []);
      }
    } finally {
      setLoading(false);
    }
  }

  async function fetchUserDetails(id: string) {
    setLoadingUser(true);
    try {
      const res = await fetch(`/api/users`);
      if (res.ok) {
        const data = await res.json();
        // endpoint returns an array of users
        const found = (data || []).find(
          (u: any) => String(u.id) === String(id)
        );
        if (found) {
          setUser(found);
        } else {
          setUser(null);
        }
      }
    } catch (err) {
      setUser(null);
    } finally {
      setLoadingUser(false);
    }
  }

  function handleFilterChange(range: DateRange | null, preset: string) {
    setDateRange(range);
    setCurrentPreset(preset);
    if (userId && range) {
      fetchForUser(userId, range);
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

  async function handleExportPDF() {
    if (!exportStartDate || !exportEndDate || !userId) {
      alert("Please select both start and end dates");
      return;
    }

    setExporting(true);
    try {
      const url = `/api/attendance/admin/export-pdf?userId=${userId}&startDate=${exportStartDate}&endDate=${exportEndDate}`;
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

  return (
    <div className="bg-gray-50 hero-pattern min-h-screen">
      <Navigation />
      <div className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-4">Attendance (Admin)</h1>
        {!userId ? (
          <p className="text-sm text-gray-600">
            Select a user from User Management to view attendance.
          </p>
        ) : (
          <div>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">
                  {loadingUser ? "User" : user?.name || `User ID: ${userId}`}
                </h2>
                {!loadingUser && user && (
                  <p className="text-sm text-gray-600">
                    {user.email} • {user.role}
                  </p>
                )}
              </div>
              <div>
                <button
                  onClick={() => setShowExportModal(true)}
                  className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 flex items-center gap-2 text-sm"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4"
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
                  Export History
                </button>
              </div>
            </div>

            <AttendanceFilters onFilterChange={handleFilterChange} />

            {loading ? (
              <div className="flex items-center gap-3">
                <svg
                  className="animate-spin h-5 w-5 text-blue-600"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                <span className="text-gray-600">Loading attendance...</span>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-left text-xs text-gray-500">
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Check In</th>
                      <th className="px-4 py-3">Check Out</th>
                      <th className="px-4 py-3">Total Hours</th>
                      <th className="px-4 py-3">Overtime</th>
                      <th className="px-4 py-3">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.length === 0 && (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-4 py-6 text-center text-gray-500"
                        >
                          No attendance records found for this user.
                        </td>
                      </tr>
                    )}
                    {entries.map((e: any) => {
                      // compute total hours if not provided
                      let total = e.totalHours;
                      if (
                        (total === null || total === undefined) &&
                        e.checkIn &&
                        e.checkOut
                      ) {
                        try {
                          const ci = new Date(e.checkIn).getTime();
                          const co = new Date(e.checkOut).getTime();
                          const hrs =
                            Math.round(((co - ci) / (1000 * 60 * 60)) * 100) /
                            100;
                          total = isFinite(hrs) ? hrs : "-";
                        } catch (err) {
                          total = "-";
                        }
                      }

                      let overtime = "-";
                      const numTotal = parseFloat(total);
                      if (!isNaN(numTotal) && numTotal > WORKING_HOURS) {
                        overtime = (numTotal - WORKING_HOURS).toFixed(2);
                      }

                      return (
                        <tr key={e.id} className="border-t hover:bg-gray-50">
                          <td className="px-4 py-3">
                            {new Date(e.date).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3">
                            {e.checkIn
                              ? new Date(e.checkIn).toLocaleTimeString()
                              : "-"}
                          </td>
                          <td className="px-4 py-3">
                            {e.checkOut
                              ? new Date(e.checkOut).toLocaleTimeString()
                              : "-"}
                          </td>
                          <td className="px-4 py-3 font-medium">
                            {total ?? "-"}
                          </td>
                          <td className="px-4 py-3 text-orange-600 font-medium">
                            {overtime}
                          </td>
                          <td className="px-4 py-3 text-gray-500">
                            {e.notes || "-"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
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

export default function AttendanceAdminPage() {
  return (
    <Suspense fallback={
      <div className="bg-gray-50 hero-pattern min-h-screen">
        <Navigation />
        <div className="max-w-5xl mx-auto px-4 py-8">
          <h1 className="text-2xl font-bold mb-4">Attendance (Admin)</h1>
          <p className="text-sm text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <AttendanceAdminContent />
    </Suspense>
  );
}
