"use client";

import { createContext, useContext, useEffect, useState } from "react";

interface User {
  id: number;
  email: string;
  name: string;
  role: "admin" | "accountant" | "staff";
  canUploadDocuments: boolean;
  canRenameDocuments: boolean;
  canDeleteDocuments: boolean;
}

interface AuthContextType {
  token: string | null;
  isAuthenticated: boolean;
  user: User | null;
  isAdmin: boolean;
  canUpload: boolean;
  canRename: boolean;
  canDelete: boolean;
  hasPermission: (permission: string) => boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  token: null,
  isAuthenticated: false,
  user: null,
  isAdmin: false,
  canUpload: false,
  canRename: false,
  canDelete: false,
  hasPermission: () => false,
  logout: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    // Get token from localStorage on mount
    const storedToken = localStorage.getItem("token");
    setToken(storedToken);

    // Set cookie for server-side requests
    if (storedToken) {
      document.cookie = `token=${storedToken}; path=/; max-age=${
        60 * 60 * 24 * 7
      }; samesite=lax`;

      // Fetch user data
      fetch("/api/auth-check")
        .then((res) => res.json())
        .then((data) => {
          if (data.user) {
            setUser(data.user);
          }
        })
        .catch((err) => console.error("Error fetching user:", err));
    }
  }, []);

  const logout = () => {
    localStorage.removeItem("token");
    document.cookie = "token=; path=/; max-age=0";
    setToken(null);
    setUser(null);
    window.location.href = "/login";
  };

  const isAdmin = user?.role === "admin";

  // Permission helpers
  const canUpload = isAdmin || (user?.canUploadDocuments ?? false);
  const canRename = isAdmin || (user?.canRenameDocuments ?? false);
  const canDelete = isAdmin || (user?.canDeleteDocuments ?? false);

  const hasPermission = (permission: string): boolean => {
    if (isAdmin) return true;

    switch (permission) {
      case "documents.upload":
        return user?.canUploadDocuments ?? false;
      case "documents.rename":
        return user?.canRenameDocuments ?? false;
      case "documents.delete":
        return user?.canDeleteDocuments ?? false;
      default:
        return false;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        token,
        isAuthenticated: !!token,
        user,
        isAdmin,
        canUpload,
        canRename,
        canDelete,
        hasPermission,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
