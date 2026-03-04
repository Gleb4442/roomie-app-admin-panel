'use client';
import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AdminAuthProvider, useAdminAuth } from '@/contexts/AdminAuthContext';
import { useI18n } from '@/lib/i18n';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});

function AdminSidebar() {
  const { username, logout } = useAdminAuth();
  const pathname = usePathname();
  const { t } = useI18n();

  const NAV = [
    { href: '/admin', label: t('nav.hotels'), exact: true, icon: HotelsIcon },
    { href: '/admin/managers', label: t('nav.managers'), icon: ManagersIcon },
    { href: '/admin/monitoring', label: t('nav.monitoring'), icon: MonitoringIcon },
  ];

  return (
    <aside className="w-[220px] shrink-0 h-screen sticky top-0 flex flex-col border-r"
      style={{ borderColor: 'rgba(244,63,94,0.08)', background: '#0F0F12' }}>
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 h-16 border-b" style={{ borderColor: 'rgba(244,63,94,0.08)' }}>
        <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
          style={{ background: 'linear-gradient(135deg, #F43F5E, #FF6B8A)', boxShadow: '0 0 12px rgba(244,63,94,0.2)' }}>
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <div>
          <span className="font-display font-700 text-sm text-white">HotelMol</span>
          <span className="block text-[10px] font-600 uppercase tracking-widest" style={{ color: '#F43F5E' }}>Admin</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {NAV.map(({ href, label, exact, icon: Icon }) => {
          const isActive = exact ? pathname === href : pathname.startsWith(href + '/') || pathname === href;
          return (
            <Link key={href} href={href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all"
              style={{
                color: isActive ? '#F43F5E' : '#94A3B8',
                background: isActive ? 'rgba(244,63,94,0.08)' : 'transparent',
                fontWeight: isActive ? 600 : 400,
              }}>
              <Icon active={isActive} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 border-t" style={{ borderColor: 'rgba(244,63,94,0.08)' }}>
        <div className="flex items-center gap-2.5 mb-2">
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-700 shrink-0"
            style={{ background: 'rgba(244,63,94,0.12)', color: '#F43F5E', fontFamily: 'var(--font-syne)' }}>
            {username?.[0]?.toUpperCase()}
          </div>
          <div>
            <p className="text-xs font-600 text-white">{username}</p>
            <p className="text-[10px] text-ink-500 uppercase tracking-widest">Admin</p>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <LanguageSwitcher accent="#F43F5E" />
          <button onClick={logout} className="text-xs text-ink-400 hover:text-rose transition-colors py-1 flex items-center gap-1.5">
            <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/>
            </svg>
            {t('nav.signOut')}
          </button>
        </div>
      </div>
    </aside>
  );
}

function AdminLayoutInner({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAdminAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated) router.replace('/admin/login');
  }, [isAuthenticated, router]);

  if (!isAuthenticated) return null;

  return (
    <div className="flex min-h-screen bg-canvas">
      <AdminSidebar />
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminAuthProvider>
      <QueryClientProvider client={queryClient}>
        <AdminLayoutInner>{children}</AdminLayoutInner>
      </QueryClientProvider>
    </AdminAuthProvider>
  );
}

function HotelsIcon({ active }: { active: boolean }) {
  return <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke={active ? '#F43F5E' : '#64748B'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/>
  </svg>;
}
function ManagersIcon({ active }: { active: boolean }) {
  return <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke={active ? '#F43F5E' : '#64748B'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
  </svg>;
}
function MonitoringIcon({ active }: { active: boolean }) {
  return <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke={active ? '#F43F5E' : '#64748B'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
  </svg>;
}
