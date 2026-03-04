'use client';
import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DashboardAuthProvider, useDashboardAuth } from '@/contexts/DashboardAuthContext';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});

const NAV = [
  { href: '', label: 'Overview', icon: OverviewIcon },
  { href: '/guests', label: 'Guests', icon: GuestsIcon },
  { href: '/orders', label: 'Orders', icon: OrdersIcon },
  { href: '/services', label: 'Services', icon: ServicesIcon },
  { href: '/qr', label: 'QR Codes', icon: QRIcon },
  { href: '/stats', label: 'Statistics', icon: StatsIcon },
  { href: '/sms', label: 'SMS Logs', icon: SMSIcon },
  { href: '/housekeeping', label: 'Housekeeping', icon: HousekeepingIcon },
  { href: '/staff', label: 'Staff', icon: StaffIcon },
  { href: '/templates', label: 'Templates', icon: TemplatesIcon },
  { href: '/tasks', label: 'TMS Tasks', icon: TasksIcon },
];

function Sidebar({ hotelId }: { hotelId: string }) {
  const { manager, activeHotel, setActiveHotel, logout } = useDashboardAuth();
  const pathname = usePathname();
  const base = `/dashboard/${hotelId}`;

  return (
    <aside className="w-[220px] shrink-0 h-screen sticky top-0 flex flex-col border-r" style={{ borderColor: 'rgba(255,255,255,0.06)', background: '#0F141A' }}>
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 h-16 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0" style={{ background: 'linear-gradient(135deg, #F0A500, #FFD166)', boxShadow: '0 0 12px rgba(240,165,0,0.2)' }}>
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24">
            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke="#0D1117" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            <polyline points="9,22 9,12 15,12 15,22" stroke="#0D1117" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <span className="font-display font-700 text-sm text-white">HotelMol</span>
      </div>

      {/* Hotel picker */}
      {manager && manager.hotels.length > 1 && (
        <div className="px-3 py-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          <select
            value={activeHotel?.id ?? hotelId}
            onChange={e => {
              const h = manager.hotels.find(x => x.id === e.target.value);
              if (h) setActiveHotel(h);
            }}
            className="w-full text-xs"
            style={{ background: '#1C2230', padding: '7px 10px', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '7px' }}
          >
            {manager.hotels.map(h => (
              <option key={h.id} value={h.id}>{h.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Active hotel label */}
      <div className="px-5 py-3">
        <p className="text-xs font-600 uppercase tracking-widest text-ink-400 font-display mb-0.5">Property</p>
        <p className="text-sm font-600 text-white truncate">{activeHotel?.name ?? 'Loading...'}</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
        {NAV.map(({ href, label, icon: Icon }) => {
          const to = base + href;
          const isActive = href === '' ? pathname === base || pathname === base + '/' : pathname.startsWith(to);
          return (
            <Link
              key={href}
              href={to}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150"
              style={{
                color: isActive ? '#F0A500' : '#94A3B8',
                background: isActive ? 'rgba(240,165,0,0.08)' : 'transparent',
                fontWeight: isActive ? 600 : 400,
              }}
            >
              <Icon active={isActive} />
              {label}
              {label === 'Orders' && (
                <span className="ml-auto">
                  <LiveDot />
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-3 mb-3">
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-700 font-display shrink-0"
            style={{ background: 'rgba(240,165,0,0.15)', color: '#F0A500' }}>
            {manager?.username[0]?.toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-600 text-white truncate">{manager?.username}</p>
            <p className="text-xs text-ink-400">{manager?.role}</p>
          </div>
        </div>
        <button onClick={logout} className="w-full text-xs text-ink-400 hover:text-rose transition-colors py-1.5 flex items-center gap-1.5">
          <svg width="13" height="13" fill="none" viewBox="0 0 24 24">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Sign out
        </button>
      </div>
    </aside>
  );
}

function LiveDot() {
  return (
    <span className="flex items-center gap-1">
      <span className="w-1.5 h-1.5 rounded-full bg-teal live-dot" />
    </span>
  );
}

function DashboardLayoutInner({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useDashboardAuth();
  const router = useRouter();
  const pathname = usePathname();
  // Extract hotelId from /dashboard/[hotelId]/...
  const hotelId = pathname.split('/')[2] ?? '';

  useEffect(() => {
    if (!isAuthenticated) router.replace('/login');
  }, [isAuthenticated, router]);

  if (!isAuthenticated) return null;

  return (
    <div className="flex min-h-screen bg-canvas">
      <Sidebar hotelId={hotelId} />
      <main className="flex-1 min-w-0 overflow-auto">
        {children}
      </main>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardAuthProvider>
      <QueryClientProvider client={queryClient}>
        <DashboardLayoutInner>{children}</DashboardLayoutInner>
      </QueryClientProvider>
    </DashboardAuthProvider>
  );
}

// Icons
function OverviewIcon({ active }: { active: boolean }) {
  return (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke={active ? '#F0A500' : '#64748B'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
    </svg>
  );
}
function GuestsIcon({ active }: { active: boolean }) {
  return (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke={active ? '#F0A500' : '#64748B'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
    </svg>
  );
}
function OrdersIcon({ active }: { active: boolean }) {
  return (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke={active ? '#F0A500' : '#64748B'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/>
    </svg>
  );
}
function ServicesIcon({ active }: { active: boolean }) {
  return (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke={active ? '#F0A500' : '#64748B'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/>
    </svg>
  );
}
function QRIcon({ active }: { active: boolean }) {
  return (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke={active ? '#F0A500' : '#64748B'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="5" height="5"/><rect x="16" y="3" width="5" height="5"/><rect x="3" y="16" width="5" height="5"/><path d="M21 16h-3v3M21 21h-3M16 16v5M11 3v5M3 11h5M11 11h2v2M13 13v2h2M15 11h5M11 16h2M11 21v-2"/>
    </svg>
  );
}
function StatsIcon({ active }: { active: boolean }) {
  return (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke={active ? '#F0A500' : '#64748B'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
    </svg>
  );
}
function SMSIcon({ active }: { active: boolean }) {
  return (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke={active ? '#F0A500' : '#64748B'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
    </svg>
  );
}
function StaffIcon({ active }: { active: boolean }) {
  return (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke={active ? '#F0A500' : '#64748B'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
    </svg>
  );
}
function TemplatesIcon({ active }: { active: boolean }) {
  return (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke={active ? '#F0A500' : '#64748B'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
    </svg>
  );
}
function TasksIcon({ active }: { active: boolean }) {
  return (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke={active ? '#F0A500' : '#64748B'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
    </svg>
  );
}
function HousekeepingIcon({ active }: { active: boolean }) {
  return (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke={active ? '#F0A500' : '#64748B'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/>
    </svg>
  );
}
