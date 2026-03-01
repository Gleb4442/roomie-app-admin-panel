'use client';
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { AdminAuthState } from '@/types/admin';

interface AdminAuthContextValue {
  token: string | null;
  username: string | null;
  login: (token: string, username: string) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

const STORAGE_KEY = 'hm_admin_auth';

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [auth, setAuth] = useState<AdminAuthState | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setAuth(JSON.parse(raw));
    } catch { /* ignore */ }
    setHydrated(true);
  }, []);

  const login = useCallback((token: string, username: string) => {
    const state: AdminAuthState = { token, username };
    setAuth(state);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, []);

  const logout = useCallback(() => {
    setAuth(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  if (!hydrated) return null;

  return (
    <AdminAuthContext.Provider
      value={{
        token: auth?.token ?? null,
        username: auth?.username ?? null,
        login,
        logout,
        isAuthenticated: !!auth?.token,
      }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error('useAdminAuth must be inside AdminAuthProvider');
  return ctx;
}
