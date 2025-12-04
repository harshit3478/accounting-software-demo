"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Navigation from "../../../components/Navigation";
import AttendanceFilters, {
  DateRange,
} from "../../../components/attendance/AttendanceFilters";

interface User {
  id: number;
  name?: string;
  email?: string;
  role?: string;
  createdAt?: string;
}

export default function AttendanceAdminPage() {
  const params = useSearchParams();
  const userId = params?.get("userId");
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [loadingUser, setLoadingUser] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange | null>(null);
  const [currentPreset, setCurrentPreset] = useState<string>("thisMonth");

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
                      <th className="px-4 py-3">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.length === 0 && (
                      <tr>
                        <td
                          colSpan={5}
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
    </div>
  );
}
