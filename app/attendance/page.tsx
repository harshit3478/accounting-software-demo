"use client";

import { useEffect, useState } from "react";
import Navigation from "../../components/Navigation";
import Link from "next/link";

export default function AttendancePage() {
  const [status, setStatus] = useState<string | null>(null);
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);

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

        <div className="flex gap-3 mb-6">
          <button
            onClick={doCheckIn}
            className="bg-green-600 text-white px-4 py-2 rounded"
          >
            Check In
          </button>
          <button
            onClick={doCheckOut}
            className="bg-red-600 text-white px-4 py-2 rounded"
          >
            Check Out
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
    </div>
  );
}
