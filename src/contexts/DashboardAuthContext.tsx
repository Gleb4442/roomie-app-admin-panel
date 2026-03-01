'use client';
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { AuthState, DashboardManager, Hotel } from '@/types/dashboard';

interface DashboardAuthContextValue {
  token: string | null;
  manager: DashboardManager | null;
  activeHotel: Hotel | null;
  setActiveHotel: (h: Hotel) => void;
  login: (token: string, manager: DashboardManager) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

const DashboardAuthContext = createContext<DashboardAuthContextValue | null>(null);

const STORAGE_KEY = 'hm_dashboard_auth';

export function DashboardAuthProvider({ children }: { children: React.ReactNode }) {
  const [auth, setAuth] = useState<AuthState | null>(null);
  const [activeHotel, setActiveHotelState] = useState<Hotel | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: AuthState = JSON.parse(raw);
        setAuth(parsed);
        const activeHotelId = localStorage.getItem('hm_active_hotel');
        if (activeHotelId) {
          const hotel = parsed.manager.hotels.find(h => h.id === activeHotelId);
          if (hotel) setActiveHotelState(hotel);
          else if (parsed.manager.hotels.length > 0) setActiveHotelState(parsed.manager.hotels[0]);
        } else if (parsed.manager.hotels.length > 0) {
          setActiveHotelState(parsed.manager.hotels[0]);
        }
      }
    } catch { /* ignore */ }
    setHydrated(true);
  }, []);

  const login = useCallback((token: string, manager: DashboardManager) => {
    const state: AuthState = { token, manager };
    setAuth(state);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    if (manager.hotels.length > 0) {
      setActiveHotelState(manager.hotels[0]);
      localStorage.setItem('hm_active_hotel', manager.hotels[0].id);
    }
  }, []);

  const logout = useCallback(() => {
    setAuth(null);
    setActiveHotelState(null);
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem('hm_active_hotel');
  }, []);

  const setActiveHotel = useCallback((h: Hotel) => {
    setActiveHotelState(h);
    localStorage.setItem('hm_active_hotel', h.id);
  }, []);

  if (!hydrated) return null;

  return (
    <DashboardAuthContext.Provider
      value={{
        token: auth?.token ?? null,
        manager: auth?.manager ?? null,
        activeHotel,
        setActiveHotel,
        login,
        logout,
        isAuthenticated: !!auth?.token,
      }}
    >
      {children}
    </DashboardAuthContext.Provider>
  );
}

export function useDashboardAuth() {
  const ctx = useContext(DashboardAuthContext);
  if (!ctx) throw new Error('useDashboardAuth must be inside DashboardAuthProvider');
  return ctx;
}
