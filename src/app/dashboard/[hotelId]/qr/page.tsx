'use client';
import { use, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDashboardAuth } from '@/contexts/DashboardAuthContext';
import { dashboardApi } from '@/lib/api/dashboard';
import { PageHeader } from '@/components/ui/PageHeader';
import { useI18n } from '@/lib/i18n';

const QR_TYPE_ICONS: Record<string, string> = {
  in_room: '🛏️',
  lobby: '🏨',
  restaurant: '🍽️',
  spa: '🧖',
  elevator: '🔼',
};

export default function QRPage({ params }: { params: Promise<{ hotelId: string }> }) {
  const { hotelId } = use(params);
  const { token } = useDashboardAuth();
  const { t } = useI18n();
  const queryClient = useQueryClient();

  const [showForm, setShowForm] = useState(false);
  const [roomNumber, setRoomNumber] = useState('');
  const [label, setLabel] = useState('');

  const { data: qrCodes, isLoading } = useQuery({
    queryKey: ['qr-codes', hotelId],
    queryFn: () => dashboardApi.getQRCodes(hotelId, token!),
    enabled: !!token,
  });

  const generateMutation = useMutation({
    mutationFn: () => dashboardApi.generateQR(hotelId, roomNumber, label || undefined, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['qr-codes', hotelId] });
      setRoomNumber('');
      setLabel('');
      setShowForm(false);
    },
  });

  const downloadAll = () => {
    if (!token) return;
    const url = dashboardApi.downloadAllQRZip(hotelId, token);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'qr-codes.zip';
    a.click();
  };

  const totalScans = qrCodes?.reduce((sum, qr) => sum + qr.scanCount, 0) ?? 0;
  const activeCount = qrCodes?.filter(qr => qr.isActive).length ?? 0;

  return (
    <div className="p-6 max-w-[1200px] animate-fade-in">
      <PageHeader
        title={t('qr.title')}
        subtitle={t('qr.subtitle', { active: activeCount, scans: totalScans })}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowForm(v => !v)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-600 font-display transition-all"
              style={{ background: 'rgba(240,165,0,0.15)', color: '#F0A500', border: '1px solid rgba(240,165,0,0.3)' }}
            >
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14M5 12h14"/>
              </svg>
              {t('qr.generate')}
            </button>
            {qrCodes?.length ? (
              <button
                onClick={downloadAll}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-600 font-display transition-all"
                style={{ background: 'rgba(240,165,0,0.08)', color: '#F0A500', border: '1px solid rgba(240,165,0,0.15)' }}
              >
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
                </svg>
                {t('qr.downloadAll')}
              </button>
            ) : null}
          </div>
        }
      />

      {/* Generate QR form */}
      {showForm && (
        <div className="card p-5 mb-6" style={{ border: '1px solid rgba(240,165,0,0.2)' }}>
          <p className="text-sm font-600 text-white mb-4">{t('qr.generateTitle')}</p>
          <div className="flex items-end gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-ink-400">{t('qr.roomNumber')} *</label>
              <input
                type="text"
                value={roomNumber}
                onChange={e => setRoomNumber(e.target.value)}
                placeholder="305"
                className="px-3 py-2 rounded-lg text-sm text-white bg-transparent border outline-none"
                style={{ borderColor: 'rgba(255,255,255,0.12)', width: 120 }}
              />
            </div>
            <div className="flex flex-col gap-1.5 flex-1">
              <label className="text-xs text-ink-400">{t('qr.labelOptional')}</label>
              <input
                type="text"
                value={label}
                onChange={e => setLabel(e.target.value)}
                placeholder={t('qr.labelPlaceholder')}
                className="px-3 py-2 rounded-lg text-sm text-white bg-transparent border outline-none"
                style={{ borderColor: 'rgba(255,255,255,0.12)' }}
              />
            </div>
            <button
              onClick={() => generateMutation.mutate()}
              disabled={!roomNumber || generateMutation.isPending}
              className="px-5 py-2 rounded-lg text-xs font-600 font-display transition-all disabled:opacity-50"
              style={{ background: '#F0A500', color: '#0D1117' }}
            >
              {generateMutation.isPending ? t('qr.generating') : t('qr.generateBtn')}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2 rounded-lg text-xs text-ink-400 transition-all hover:text-white"
            >
              {t('common.cancel')}
            </button>
          </div>
          {generateMutation.isError && (
            <p className="text-xs text-rose mt-3">{t('qr.generateError')}</p>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="card h-[200px] shimmer" />
          ))}
        </div>
      ) : !qrCodes?.length ? (
        <div className="card flex flex-col items-center justify-center h-40 gap-3 text-ink-500">
          <span className="text-sm">{t('qr.noQRCodes')}</span>
          <button
            onClick={() => setShowForm(true)}
            className="text-xs px-4 py-2 rounded-lg transition-all"
            style={{ background: 'rgba(240,165,0,0.12)', color: '#F0A500' }}
          >
            {t('qr.generateFirst')}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {qrCodes.map(qr => (
            <div key={qr.id} className="card p-4 card-interactive flex flex-col items-center text-center gap-3">
              {/* QR preview */}
              <div className="w-[100px] h-[100px] rounded-xl flex items-center justify-center text-4xl relative"
                style={{ background: 'rgba(255,255,255,0.06)' }}>
                {QR_TYPE_ICONS[qr.type] || '📱'}
                {!qr.isActive && (
                  <div className="absolute inset-0 rounded-xl flex items-center justify-center"
                    style={{ background: 'rgba(0,0,0,0.6)' }}>
                    <span className="text-xs text-rose font-600">{t('qr.inactive')}</span>
                  </div>
                )}
              </div>

              <div className="w-full">
                <p className="text-sm font-600 text-white truncate">{qr.label}</p>
                {qr.roomNumber && (
                  <p className="text-xs text-ink-400 num">{t('qr.room', { n: qr.roomNumber })}</p>
                )}
                <p className="text-xs text-ink-500 mt-1 capitalize">{qr.type.replace('_', ' ')}</p>
              </div>

              <div className="flex items-center gap-1 text-xs text-ink-400">
                <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                </svg>
                <span className="num">{qr.scanCount}</span> {t('qr.scans')}
              </div>

              {/* Download button */}
              {qr.isActive && (
                <a
                  href={dashboardApi.downloadQRPdf(hotelId, qr.id, token!)}
                  download={`qr-${qr.label}.pdf`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-1.5 rounded-lg text-xs font-600 font-display text-center transition-colors"
                  style={{ background: 'rgba(255,255,255,0.06)', color: '#94A3B8' }}
                  onClick={e => e.stopPropagation()}
                >
                  {t('qr.downloadPdf')}
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
