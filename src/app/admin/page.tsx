'use client';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { adminApi } from '@/lib/api/admin';
import { PageHeader } from '@/components/ui/PageHeader';
import { formatDate } from '@/lib/utils';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { useI18n } from '@/lib/i18n';

export default function AdminHotelsPage() {
  const { token } = useAdminAuth();
  const qc = useQueryClient();
  const { t } = useI18n();
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', slug: '', location: '', timezone: 'UTC' });

  const { data: hotels, isLoading } = useQuery({
    queryKey: ['admin-hotels'],
    queryFn: () => adminApi.listHotels(token!),
    enabled: !!token,
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      await adminApi.createHotel(token!, form);
      qc.invalidateQueries({ queryKey: ['admin-hotels'] });
      setShowCreate(false);
      setForm({ name: '', slug: '', location: '', timezone: 'UTC' });
      toast.success(t('adminHotels.created'));
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? t('adminHotels.failedCreate');
      toast.error(msg);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string, hotelName: string) => {
    if (!confirm(t('adminHotels.deleteConfirm', { name: hotelName }))) return;
    try {
      await adminApi.deleteHotel(token!, id);
      qc.invalidateQueries({ queryKey: ['admin-hotels'] });
      toast.success(t('adminHotels.deleted'));
    } catch {
      toast.error(t('adminHotels.failedDelete'));
    }
  };

  return (
    <div className="p-6 max-w-[1100px] animate-fade-in">
      <PageHeader
        title={t('adminHotels.title')}
        subtitle={t('adminHotels.properties', { n: hotels?.length ?? 0 })}
        actions={
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-600 font-display transition-all"
            style={{ background: 'rgba(244,63,94,0.12)', color: '#F43F5E', border: '1px solid rgba(244,63,94,0.2)' }}>
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            {t('adminHotels.newHotel')}
          </button>
        }
      />

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div className="card w-full max-w-[440px] mx-4 p-6 animate-slide-up">
            <h2 className="font-display font-700 text-white mb-5">{t('adminHotels.createHotel')}</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <Field label={t('adminHotels.hotelName')} value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} placeholder="Grand Hotel Kyiv" required />
              <Field label={t('adminHotels.slug')} value={form.slug} onChange={v => setForm(f => ({ ...f, slug: v }))} placeholder="grand-kyiv" required />
              <Field label={t('adminHotels.location')} value={form.location} onChange={v => setForm(f => ({ ...f, location: v }))} placeholder="Kyiv, Ukraine" />
              <div>
                <label className="block text-xs font-600 uppercase tracking-widest text-ink-300 mb-2 font-display">{t('adminHotels.timezone')}</label>
                <select value={form.timezone} onChange={e => setForm(f => ({ ...f, timezone: e.target.value }))}>
                  {['UTC', 'Europe/Kyiv', 'Europe/Berlin', 'Europe/London', 'America/New_York', 'Asia/Dubai'].map(tz => (
                    <option key={tz} value={tz}>{tz}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowCreate(false)}
                  className="flex-1 h-10 rounded-lg text-sm font-600 font-display text-ink-300 transition-colors"
                  style={{ background: 'rgba(255,255,255,0.05)' }}>
                  {t('adminHotels.cancel')}
                </button>
                <button type="submit" disabled={creating}
                  className="flex-1 h-10 rounded-lg text-sm font-600 font-display text-white transition-all"
                  style={{ background: creating ? 'rgba(244,63,94,0.4)' : 'linear-gradient(135deg, #F43F5E, #FF6B8A)', boxShadow: creating ? 'none' : '0 0 20px rgba(244,63,94,0.2)' }}>
                  {creating ? t('adminHotels.creating') : t('adminHotels.create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Hotels list */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="card h-[72px] shimmer" />)}
        </div>
      ) : !hotels?.length ? (
        <div className="card flex items-center justify-center h-40 text-ink-500 text-sm">{t('adminHotels.noHotels')}</div>
      ) : (
        <div className="space-y-2">
          {hotels.map(hotel => (
            <div key={hotel.id} className="card p-4 flex items-center gap-4 card-interactive">
              {/* Icon */}
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: 'rgba(244,63,94,0.08)' }}>
                <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#F43F5E" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/>
                </svg>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-600 text-white text-sm">{hotel.name}</h3>
                  <span className="text-xs text-ink-500 num">/{hotel.slug}</span>
                </div>
                <div className="flex items-center gap-3 mt-0.5">
                  {hotel.location && <span className="text-xs text-ink-400">{hotel.location}</span>}
                  <span className="text-xs text-ink-500">{t('adminHotels.createdAt', { date: formatDate(hotel.createdAt) })}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <Link href={`/admin/hotels/${hotel.id}`}
                  className="px-3 py-1.5 rounded-lg text-xs font-600 font-display transition-all"
                  style={{ background: 'rgba(255,255,255,0.05)', color: '#94A3B8' }}>
                  {t('adminHotels.configure')}
                </Link>
                <button onClick={() => handleDelete(hotel.id, hotel.name)}
                  className="px-2 py-1.5 rounded-lg text-xs transition-colors"
                  style={{ color: '#475569' }}
                  title="Delete hotel">
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, placeholder, required }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; required?: boolean }) {
  return (
    <div>
      <label className="block text-xs font-600 uppercase tracking-widest text-ink-300 mb-2 font-display">{label}</label>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} required={required} />
    </div>
  );
}
