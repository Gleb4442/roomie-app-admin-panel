'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { dashboardApi } from '@/lib/api/dashboard';
import { DashboardAuthProvider, useDashboardAuth } from '@/contexts/DashboardAuthContext';
import toast from 'react-hot-toast';

function LoginForm() {
  const router = useRouter();
  const { login, isAuthenticated, manager } = useDashboardAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // Redirect if already logged in
  if (isAuthenticated && manager?.hotels[0]) {
    router.replace(`/dashboard/${manager.hotels[0].id}`);
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;
    setLoading(true);
    try {
      const data = await dashboardApi.login(username, password);
      login(data.token, data.manager);
      toast.success(`Welcome, ${data.manager.username}`);
      if (data.manager.hotels.length > 0) {
        router.push(`/dashboard/${data.manager.hotels[0].id}`);
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Login failed';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center relative overflow-hidden">
      {/* Background grid */}
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />
      {/* Radial glow */}
      <div className="absolute inset-0 bg-gradient-radial from-[rgba(240,165,0,0.04)] via-transparent to-transparent"
        style={{ background: 'radial-gradient(ellipse at 50% 40%, rgba(240,165,0,0.06) 0%, transparent 60%)' }}
      />

      <div className="relative z-10 w-full max-w-[400px] px-6">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 mb-6">
            <div className="w-8 h-8 rounded-lg bg-gold-gradient flex items-center justify-center shadow-gold-glow">
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24">
                <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke="#0D1117" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <polyline points="9,22 9,12 15,12 15,22" stroke="#0D1117" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <span className="font-display text-xl font-700 text-white tracking-tight">HotelMol</span>
          </div>
          <h1 className="font-display text-2xl font-700 text-white mb-2">Hotel Dashboard</h1>
          <p className="text-ink-300 text-sm">Sign in to manage your property</p>
        </div>

        {/* Card */}
        <div className="card p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-600 uppercase tracking-widest text-ink-300 mb-2 font-display">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="gm_kyiv"
                autoComplete="username"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-600 uppercase tracking-widest text-ink-300 mb-2 font-display">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 h-11 rounded-lg font-display font-600 text-sm tracking-wide transition-all duration-200"
              style={{
                background: loading ? 'rgba(240,165,0,0.4)' : 'linear-gradient(135deg, #F0A500 0%, #FFD166 100%)',
                color: '#0D1117',
                boxShadow: loading ? 'none' : '0 0 20px rgba(240,165,0,0.2)',
              }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Signing in...
                </span>
              ) : 'Sign In'}
            </button>
          </form>
        </div>

        {/* Admin link */}
        <p className="text-center mt-6 text-xs text-ink-400">
          HotelMol team?{' '}
          <a href="/admin/login" className="text-gold hover:text-gold-dim transition-colors">
            Admin Panel →
          </a>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <DashboardAuthProvider>
      <LoginForm />
    </DashboardAuthProvider>
  );
}
