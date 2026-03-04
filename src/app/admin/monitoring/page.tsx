'use client';
import { useQuery } from '@tanstack/react-query';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { adminApi } from '@/lib/api/admin';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { formatDateTime } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';

export default function MonitoringPage() {
  const { token } = useAdminAuth();
  const { t } = useI18n();

  const { data: overview, isLoading: loadingOverview } = useQuery({
    queryKey: ['admin-monitoring-overview'],
    queryFn: () => adminApi.getMonitoringOverview(token!),
    enabled: !!token,
    refetchInterval: 60_000,
  });

  const { data: smsErrors, isLoading: loadingErrors } = useQuery({
    queryKey: ['admin-sms-errors'],
    queryFn: () => adminApi.getSmsErrors(token!),
    enabled: !!token,
    refetchInterval: 60_000,
  });

  return (
    <div className="p-6 max-w-[1100px] animate-fade-in">
      <PageHeader
        title={t('monitoring.title')}
        subtitle={t('monitoring.subtitle')}
        actions={
          <div className="flex items-center gap-2 text-xs text-ink-400">
            <span className="w-2 h-2 rounded-full bg-teal live-dot" />
            {t('monitoring.autoRefresh')}
          </div>
        }
      />

      {/* Stats */}
      {loadingOverview ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="card h-[110px] shimmer" />)}
        </div>
      ) : overview && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard label={t('monitoring.totalHotels')} value={overview.totalHotels} sub={`${overview.activeHotels} ${t('monitoring.active')}`} accent="gold"
            icon={<svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/></svg>}
          />
          <StatCard label={t('monitoring.totalGuests')} value={overview.totalGuests} accent="teal"
            icon={<svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>}
          />
          <StatCard label={t('monitoring.smsDelivered')} value={overview.smsStats.sent} sub={`${overview.smsStats.failed} ${t('monitoring.failed')}`} accent="blue"
            icon={<svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>}
          />
          <StatCard
            label={t('monitoring.pmsSyncIssues')}
            value={overview.pmsSync.withErrors}
            sub={`${overview.pmsSync.active} ${t('monitoring.activeIntegrations')}`}
            accent={overview.pmsSync.withErrors > 0 ? 'rose' : 'teal'}
            icon={<svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><polyline points="23 20 23 14 17 14"/><path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15"/></svg>}
          />
        </div>
      )}

      {/* PMS sync errors */}
      {(overview?.pmsSync?.lastErrors?.length ?? 0) > 0 && (
        <div className="card mb-4">
          <div className="px-5 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
            <h2 className="font-display font-700 text-sm text-white">{t('monitoring.pmsSyncIssuesTitle')}</h2>
          </div>
          <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
            {overview?.pmsSync?.lastErrors?.map((err, i) => (
              <div key={i} className="px-5 py-3.5 flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-rose mt-1.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-600 text-white">{err.hotelName}</p>
                  <p className="text-xs text-rose mt-0.5 truncate">{err.error}</p>
                </div>
                <span className="text-xs text-ink-500 num shrink-0">{formatDateTime(err.at)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SMS Errors */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          <h2 className="font-display font-700 text-sm text-white">{t('monitoring.recentSmsFailures')}</h2>
          {overview && overview.smsStats.failed > 0 && (
            <span className="badge" style={{ color: '#F43F5E', background: 'rgba(244,63,94,0.12)' }}>
              {overview.smsStats.failed} {t('monitoring.failed')}
            </span>
          )}
        </div>

        {loadingErrors ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-10 shimmer rounded-lg" />)}
          </div>
        ) : !smsErrors?.length ? (
          <div className="flex items-center justify-center h-32">
            <div className="flex items-center gap-2 text-teal text-sm">
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              {t('monitoring.noSmsFailures')}
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('monitoring.hotel')}</th>
                  <th>{t('monitoring.phone')}</th>
                  <th>{t('monitoring.template')}</th>
                  <th>{t('monitoring.provider')}</th>
                  <th>{t('monitoring.error')}</th>
                  <th>{t('monitoring.time')}</th>
                </tr>
              </thead>
              <tbody>
                {smsErrors.map((err: { id: string; hotelName: string; phone: string; template: string; provider: string; errorMsg: string; createdAt: string }) => (
                  <tr key={err.id}>
                    <td className="text-white font-600">{err.hotelName}</td>
                    <td className="num text-ink-300">{err.phone}</td>
                    <td><span className="text-xs px-2 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.06)', color: '#94A3B8' }}>{err.template}</span></td>
                    <td className="text-ink-400 capitalize">{err.provider}</td>
                    <td className="text-rose text-xs max-w-[200px] truncate" title={err.errorMsg}>{err.errorMsg}</td>
                    <td className="text-ink-500 num text-xs">{formatDateTime(err.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
