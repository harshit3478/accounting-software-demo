"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { SettingsPermission } from "./permissions";
import {
  clearClientAuthSession,
  forceLogoutAndRedirect,
  installApiAuthInterceptor,
  syncAuthCookie,
} from "./auth-session";

interface User {
  id: number;
  email: string;
  name: string;
  avatarUrl?: string | null;
  displayName?: string;
  role: "admin" | "accountant" | "staff";
  canUploadDocuments: boolean;
  canRenameDocuments: boolean;
  canDeleteDocuments: boolean;
  canUploadCheques: boolean;
  canApproveCheques: boolean;
  settingsPermissions?: Partial<Record<SettingsPermission, boolean>>;
  isSuperAdmin?: boolean;
}

interface AuthContextType {
  token: string | null;
  isAuthenticated: boolean;
  user: User | null;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  canUpload: boolean;
  canRename: boolean;
  canDelete: boolean;
  canUploadCheques: boolean;
  canApproveCheques: boolean;
  hasPermission: (permission: string) => boolean;
  hasSettingPermission: (setting: SettingsPermission) => boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  token: null,
  isAuthenticated: false,
  user: null,
  isAdmin: false,
  isSuperAdmin: false,
  canUpload: false,
  canRename: false,
  canDelete: false,
  canUploadCheques: false,
  canApproveCheques: false,
  hasPermission: () => false,
  hasSettingPermission: () => false,
  logout: () => {},
});

function isAuthPage(pathname: string) {
  return (
    pathname === "/login" ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/reset-password")
  );
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [sessionChecked, setSessionChecked] = useState(false);

  installApiAuthInterceptor();

  useEffect(() => {
    const storedToken = localStorage.getItem("token");
    setToken(storedToken);

    if (storedToken) {
      syncAuthCookie(storedToken);
    }

    if (isAuthPage(window.location.pathname)) {
      setSessionChecked(true);
      return;
    }

    fetch("/api/auth-check")
      .then(async (res) => {
        const data = await res.json();
        return { ok: res.ok, status: res.status, data };
      })
      .then((result) => {
        if (result.ok && result.data?.authenticated && result.data.user) {
          setUser(result.data.user);
          const storedToken = localStorage.getItem("token");
          if (storedToken) {
            syncAuthCookie(storedToken);
          }
          return;
        }

        if (result.status === 401) {
          forceLogoutAndRedirect();
          return;
        }

        clearClientAuthSession();
        setToken(null);
        setUser(null);
        window.location.replace("/login");
      })
      .catch((err) => {
        console.error("Error fetching user:", err);
        forceLogoutAndRedirect();
      })
      .finally(() => {
        setSessionChecked(true);
      });
  }, []);

  const logout = () => {
    clearClientAuthSession();
    setToken(null);
    setUser(null);
    forceLogoutAndRedirect();
  };

  const isAdmin = user?.role === "admin";
  const isSuperAdmin = user?.isSuperAdmin === true;

  const canUpload = user?.canUploadDocuments ?? false;
  const canRename = user?.canRenameDocuments ?? false;
  const canDelete = user?.canDeleteDocuments ?? false;
  const canUploadCheques = user?.canUploadCheques ?? false;
  const canApproveCheques = user?.canApproveCheques ?? false;

  const hasPermission = (permission: string): boolean => {
    if (isSuperAdmin) return true;

    switch (permission) {
      case "documents.upload":
        return user?.canUploadDocuments ?? false;
      case "documents.rename":
        return user?.canRenameDocuments ?? false;
      case "documents.delete":
        return user?.canDeleteDocuments ?? false;
      case "chequeVault.upload":
        return user?.canUploadCheques ?? false;
      case "chequeVault.approve":
        return user?.canApproveCheques ?? false;
      default:
        if (permission.startsWith("settings.")) {
          const setting = permission.replace(
            "settings.",
            "",
          ) as SettingsPermission;
          return user?.settingsPermissions?.[setting] ?? false;
        }
        return false;
    }
  };

  const hasSettingPermission = (setting: SettingsPermission): boolean =>
    hasPermission(`settings.${setting}`);

  return (
    <AuthContext.Provider
      value={{
        token,
        isAuthenticated: sessionChecked ? !!user || !!token : !!token,
        user,
        isAdmin,
        isSuperAdmin,
        canUpload,
        canRename,
        canDelete,
        canUploadCheques,
        canApproveCheques,
        hasPermission,
        hasSettingPermission,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
