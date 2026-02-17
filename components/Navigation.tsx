"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "../lib/AuthContext";
import { useEffect, useState } from "react";

export default function Navigation() {
  const pathname = usePathname();
  const { logout, isAdmin, user } = useAuth();

  // Check if user is superadmin (matches email from env)

  const navItems = [
    { href: "/", label: "Dashboard", active: pathname === "/" },
    { href: "/invoices", label: "Invoices", active: pathname === "/invoices" },
    { href: "/payments", label: "Payments", active: pathname === "/payments" },
    {
      href: "/documents",
      label: "Documents",
      active: pathname === "/documents",
    },
  ];

  // Attendance for regular users (staff/accountant) only
  if (user && (user.role === "staff" || user.role === "accountant")) {
    navItems.push({
      href: "/attendance",
      label: "Attendance",
      active: pathname === "/attendance",
    });
  }

  const isSuperAdmin =
    user?.email === process.env.NEXT_PUBLIC_SUPERADMIN_EMAIL || user?.id === 1;

  // Settings page (admin only) - combines User Management, Terms, Payment Methods, QuickBooks
  if (isAdmin || isSuperAdmin) {
    navItems.push({
      href: "/settings",
      label: "Settings",
      active: pathname === "/settings",
    });
  }

  const handleLogout = async () => {
    await fetch("/api/logout", { method: "POST" });
    logout();
  };

  const [pendingCount, setPendingCount] = useState<number>(0);

  useEffect(() => {
    let mounted = true;
    async function fetchCount() {
      try {
        if (!(isAdmin || isSuperAdmin)) return;
        const res = await fetch("/api/attendance/admin/regularization/count");
        if (!res.ok) return;
        const data = await res.json();
        if (mounted && data?.count >= 0) setPendingCount(data.count);
      } catch (e) {
        // ignore
      }
    }
    fetchCount();
    return () => {
      mounted = false;
    };
  }, [isAdmin, isSuperAdmin]);

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Link href="/" className="text-2xl font-bold text-gray-900">
                FinanceFlow
              </Link>
              <p className="text-xs text-gray-500">
                Accounting Management System
              </p>
            </div>
          </div>
          <div className="hidden md:block">
            <div className="ml-10 flex items-baseline space-x-4">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`nav-link px-3 py-2 rounded-md text-sm font-medium ${
                    item.active
                      ? "text-blue-600"
                      : "text-gray-700 hover:text-blue-600"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
          <div className="flex items-center space-x-4">
            {/* <button className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
              + New Invoice
            </button> */}
            {user && (
              <div className="flex items-center space-x-3">
               
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">
                    Welcome {user.name}!
                  </p>
                  <p className="text-xs text-gray-500 capitalize">
                    {user.role}
                  </p>
                </div>
                <button
                  onClick={handleLogout}
                  className="bg-gray-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors"
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
