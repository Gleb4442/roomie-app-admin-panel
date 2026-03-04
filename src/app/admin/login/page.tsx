'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { adminApi } from '@/lib/api/admin';
import { AdminAuthProvider, useAdminAuth } from '@/contexts/AdminAuthContext';
import { useI18n } from '@/lib/i18n';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import toast from 'react-hot-toast';

function AdminLoginForm() {
  const router = useRouter();
  const { login, isAuthenticated } = useAdminAuth();
  const { t } = useI18n();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  if (isAuthenticated) {
    router.replace('/admin');
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await adminApi.login(username, password);
      login(data.token, data.username);
      toast.success(t('adminLogin.welcomeBack'));
      router.push('/admin');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? t('adminLogin.loginFailed');
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center relative overflow-hidden">
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage: 'linear-gradient(rgba(244,63,94,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(244,63,94,0.04) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 50% 40%, rgba(244,63,94,0.05) 0%, transparent 60%)' }} />

      <div className="absolute top-4 right-4">
        <LanguageSwitcher accent="#F43F5E" />
      </div>

      <div className="relative z-10 w-full max-w-[400px] px-6">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 mb-6">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #F43F5E, #FF6B8A)', boxShadow: '0 0 20px rgba(244,63,94,0.2)' }}>
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="#0D1117" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <span className="font-display text-xl font-700 text-white tracking-tight">Admin</span>
          </div>
          <h1 className="font-display text-2xl font-700 text-white mb-2">{t('adminLogin.title')}</h1>
          <p className="text-ink-300 text-sm">{t('adminLogin.subtitle')}</p>
        </div>

        <div className="card p-6" style={{ borderColor: 'rgba(244,63,94,0.1)' }}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-600 uppercase tracking-widest text-ink-300 mb-2 font-display">
                {t('login.username')}
              </label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="admin"
                autoComplete="username"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-600 uppercase tracking-widest text-ink-300 mb-2 font-display">
                {t('login.password')}
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
                background: loading ? 'rgba(244,63,94,0.4)' : 'linear-gradient(135deg, #F43F5E 0%, #FF6B8A 100%)',
                color: '#fff',
                boxShadow: loading ? 'none' : '0 0 20px rgba(244,63,94,0.2)',
              }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  {t('adminLogin.signingIn')}
                </span>
              ) : t('adminLogin.access')}
            </button>
          </form>
        </div>

        <p className="text-center mt-6 text-xs text-ink-400">
          <a href="/login" className="text-ink-300 hover:text-white transition-colors">{t('adminLogin.backToDashboard')}</a>
        </p>
      </div>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <AdminAuthProvider>
      <AdminLoginForm />
    </AdminAuthProvider>
  );
}
