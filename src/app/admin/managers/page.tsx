'use client';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { adminApi } from '@/lib/api/admin';
import { PageHeader } from '@/components/ui/PageHeader';
import { formatDate } from '@/lib/utils';
import toast from 'react-hot-toast';
import { useI18n } from '@/lib/i18n';

export default function ManagersPage() {
  const { token } = useAdminAuth();
  const qc = useQueryClient();
  const { t } = useI18n();
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ username: '', password: '', role: 'manager' });
  const [linkModal, setLinkModal] = useState<{ managerId: string; name: string } | null>(null);
  const [selectedHotels, setSelectedHotels] = useState<string[]>([]);

  const { data: managers, isLoading } = useQuery({
    queryKey: ['admin-managers'],
    queryFn: () => adminApi.listManagers(token!),
    enabled: !!token,
  });

  const { data: hotels } = useQuery({
    queryKey: ['admin-hotels'],
    queryFn: () => adminApi.listHotels(token!),
    enabled: !!token,
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      await adminApi.createManager(token!, form);
      qc.invalidateQueries({ queryKey: ['admin-managers'] });
      setShowCreate(false);
      setForm({ username: '', password: '', role: 'manager' });
      toast.success(t('adminManagers.created'));
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? t('adminManagers.failedCreate');
      toast.error(msg);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(t('adminManagers.deleteConfirm', { name }))) return;
    try {
      await adminApi.deleteManager(token!, id);
      qc.invalidateQueries({ queryKey: ['admin-managers'] });
      toast.success(t('adminManagers.deleted'));
    } catch { toast.error(t('adminManagers.deleteFailed')); }
  };

  const handleLinkHotels = async () => {
    if (!linkModal) return;
    try {
      await adminApi.linkManagerHotels(token!, linkModal.managerId, selectedHotels);
      qc.invalidateQueries({ queryKey: ['admin-managers'] });
      setLinkModal(null);
      toast.success(t('adminManagers.hotelAccessUpdated'));
    } catch { toast.error(t('adminManagers.updateFailed')); }
  };

  const openLinkModal = (m: { id: string; username: string; hotels: Array<{ id: string }> }) => {
    setLinkModal({ managerId: m.id, name: m.username });
    setSelectedHotels(m.hotels.map(h => h.id));
  };

  return (
    <div className="p-6 max-w-[900px] animate-fade-in">
      <PageHeader
        title={t('adminManagers.title')}
        subtitle={t('adminManagers.subtitle')}
        actions={
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-600 font-display"
            style={{ background: 'rgba(244,63,94,0.12)', color: '#F43F5E', border: '1px solid rgba(244,63,94,0.2)' }}>
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            {t('adminManagers.newManager')}
          </button>
        }
      />

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div className="card w-full max-w-[420px] mx-4 p-6 animate-slide-up">
            <h2 className="font-display font-700 text-white mb-5">{t('adminManagers.createManager')}</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <Field label={t('adminManagers.username')} value={form.username} onChange={v => setForm(f => ({ ...f, username: v }))} placeholder="gm_kyiv" required />
              <Field label={t('adminManagers.password')} value={form.password} onChange={v => setForm(f => ({ ...f, password: v }))} placeholder="••••••••" type="password" required />
              <div>
                <label className="block text-xs font-600 uppercase tracking-widest text-ink-300 mb-2 font-display">{t('adminManagers.roleLabel')}</label>
                <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowCreate(false)}
                  className="flex-1 h-10 rounded-lg text-sm font-600 font-display text-ink-300"
                  style={{ background: 'rgba(255,255,255,0.05)' }}>{t('adminManagers.cancel')}</button>
                <button type="submit" disabled={creating}
                  className="flex-1 h-10 rounded-lg text-sm font-600 font-display text-white"
                  style={{ background: creating ? 'rgba(244,63,94,0.4)' : 'linear-gradient(135deg, #F43F5E, #FF6B8A)' }}>
                  {creating ? t('adminManagers.creating') : t('adminManagers.create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Link hotels modal */}
      {linkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div className="card w-full max-w-[420px] mx-4 p-6 animate-slide-up">
            <h2 className="font-display font-700 text-white mb-1">{t('adminManagers.hotelAccess')}</h2>
            <p className="text-xs text-ink-400 mb-4">{linkModal.name}</p>
            <div className="space-y-2 mb-4 max-h-60 overflow-y-auto">
              {hotels?.map(h => (
                <label key={h.id} className="flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors"
                  style={{ background: selectedHotels.includes(h.id) ? 'rgba(244,63,94,0.08)' : 'rgba(255,255,255,0.03)' }}>
                  <input type="checkbox" checked={selectedHotels.includes(h.id)}
                    onChange={e => setSelectedHotels(prev => e.target.checked ? [...prev, h.id] : prev.filter(id => id !== h.id))}
                    className="accent-rose" />
                  <span className="text-sm text-white">{h.name}</span>
                </label>
              ))}
              {!hotels?.length && <p className="text-sm text-ink-500 text-center py-4">{t('adminManagers.noHotels')}</p>}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setLinkModal(null)}
                className="flex-1 h-10 rounded-lg text-sm font-600 font-display text-ink-300"
                style={{ background: 'rgba(255,255,255,0.05)' }}>{t('adminManagers.cancel')}</button>
              <button onClick={handleLinkHotels}
                className="flex-1 h-10 rounded-lg text-sm font-600 font-display text-white"
                style={{ background: 'linear-gradient(135deg, #F43F5E, #FF6B8A)' }}>{t('adminManagers.save')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Managers list */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="card h-[72px] shimmer" />)}
        </div>
      ) : !managers?.length ? (
        <div className="card flex items-center justify-center h-40 text-ink-500 text-sm">{t('adminManagers.noManagers')}</div>
      ) : (
        <div className="card overflow-hidden">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('adminManagers.usernameCol')}</th>
                <th>{t('adminManagers.roleCol')}</th>
                <th>{t('adminManagers.hotelsCol')}</th>
                <th>{t('adminManagers.createdCol')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {managers.map(m => (
                <tr key={m.id}>
                  <td>
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-700 shrink-0"
                        style={{ background: 'rgba(244,63,94,0.1)', color: '#F43F5E', fontFamily: 'var(--font-syne)' }}>
                        {m.username[0]?.toUpperCase()}
                      </div>
                      <span className="font-600 text-white">{m.username}</span>
                    </div>
                  </td>
                  <td>
                    <span className="badge capitalize" style={{ color: m.role === 'admin' ? '#F43F5E' : '#94A3B8', background: m.role === 'admin' ? 'rgba(244,63,94,0.1)' : 'rgba(148,163,184,0.1)' }}>
                      {m.role}
                    </span>
                  </td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      {m.hotels?.slice(0, 3).map(h => (
                        <span key={h.id} className="text-xs px-2 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.06)', color: '#94A3B8' }}>{h.name}</span>
                      ))}
                      {m.hotels?.length > 3 && <span className="text-xs text-ink-500">+{m.hotels.length - 3}</span>}
                      {!m.hotels?.length && <span className="text-xs text-ink-500">{t('adminManagers.noHotels')}</span>}
                    </div>
                  </td>
                  <td className="text-ink-400 num text-xs">{formatDate(m.createdAt)}</td>
                  <td>
                    <div className="flex gap-2">
                      <button onClick={() => openLinkModal(m)}
                        className="text-xs text-gold hover:text-gold-dim transition-colors">{t('adminManagers.hotels')}</button>
                      <button onClick={() => handleDelete(m.id, m.username)}
                        className="text-ink-500 hover:text-rose transition-colors ml-1">
                        <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, placeholder, required, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; required?: boolean; type?: string }) {
  return (
    <div>
      <label className="block text-xs font-600 uppercase tracking-widest text-ink-300 mb-2 font-display">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} required={required} />
    </div>
  );
}
