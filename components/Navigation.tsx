"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "../lib/AuthContext";
import { useEffect, useRef, useState } from "react";
import UserAvatar from "./UserAvatar";
import { formatUserDisplayName } from "../lib/user-display";

export default function Navigation() {
  const pathname = usePathname();
  const { logout, isAdmin, user } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const navItems = [
    { href: "/", label: "Dashboard", active: pathname === "/" },
    { href: "/invoices", label: "Invoices", active: pathname === "/invoices" },
    { href: "/payments", label: "Payments", active: pathname === "/payments" },
    {
      href: "/documents",
      label: "Documents",
      active: pathname === "/documents",
    },
    {
      href: "/cheque-vault",
      label: "Cheque Vault",
      active: pathname.startsWith("/cheque-vault"),
    },
  ];

  if (user && (user.role === "staff" || user.role === "accountant")) {
    navItems.push({
      href: "/attendance",
      label: "Attendance",
      active: pathname === "/attendance",
    });
  }

  const isSuperAdmin =
    user?.email === process.env.NEXT_PUBLIC_SUPERADMIN_EMAIL || user?.id === 1;

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
      } catch {
        // ignore
      }
    }
    fetchCount();
    return () => {
      mounted = false;
    };
  }, [isAdmin, isSuperAdmin]);

  useEffect(() => {
    if (!menuOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  const displayName = user
    ? formatUserDisplayName({ name: user.name, email: user.email })
    : "";

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
          <div className="flex items-center">
            {user && (
              <div className="relative" ref={menuRef}>
                <button
                  type="button"
                  onClick={() => setMenuOpen((open) => !open)}
                  className="rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  aria-expanded={menuOpen}
                  aria-haspopup="true"
                  aria-label="Account menu"
                >
                  <UserAvatar
                    src={user.avatarUrl}
                    name={user.name}
                    email={user.email}
                    size="md"
                  />
                </button>

                {menuOpen && (
                  <div className="absolute right-0 mt-2 w-56 rounded-lg border border-gray-200 bg-white py-2 shadow-lg z-50">
                    <div className="px-4 py-3 border-b border-gray-100">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {displayName}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {user.email}
                      </p>
                      <p className="text-xs text-gray-400 capitalize mt-0.5">
                        {user.role}
                      </p>
                    </div>
                    <Link
                      href="/settings?tab=profile"
                      onClick={() => setMenuOpen(false)}
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      My Profile
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        handleLogout();
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                    >
                      Logout
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
