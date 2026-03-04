'use client';
import { use, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useDashboardAuth } from '@/contexts/DashboardAuthContext';
import { dashboardApi } from '@/lib/api/dashboard';
import { PageHeader } from '@/components/ui/PageHeader';
import { Pagination } from '@/components/ui/Pagination';
import { formatDateTime } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';

const SMS_STATUSES = [
  { value: '', key: 'sms.all' },
  { value: 'sent', key: 'sms.sent' },
  { value: 'failed', key: 'sms.failed' },
  { value: 'queued', key: 'sms.queued' },
];

export default function SMSLogsPage({ params }: { params: Promise<{ hotelId: string }> }) {
  const { hotelId } = use(params);
  const { token } = useDashboardAuth();
  const { t } = useI18n();
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const LIMIT = 20;

  const { data, isLoading } = useQuery({
    queryKey: ['sms-logs', hotelId, status, page],
    queryFn: () => dashboardApi.getSmsLogs(hotelId, token!, { status: status || undefined, page, limit: LIMIT }),
    enabled: !!token,
    refetchInterval: 30_000,
  });

  const failedCount = data?.logs?.filter(l => l.status === 'failed').length ?? 0;

  return (
    <div className="p-6 max-w-[1200px] animate-fade-in">
      <PageHeader
        title={t('sms.title')}
        subtitle={t('sms.subtitle')}
      />

      {/* Status filter */}
      <div className="flex gap-1.5 mb-5">
        {SMS_STATUSES.map(s => (
          <button
            key={s.value}
            onClick={() => { setStatus(s.value); setPage(1); }}
            className="px-3 py-1.5 rounded-lg text-xs font-600 font-display transition-all"
            style={{
              background: status === s.value ? 'rgba(240,165,0,0.12)' : 'rgba(255,255,255,0.04)',
              color: status === s.value ? '#F0A500' : '#64748B',
              border: `1px solid ${status === s.value ? 'rgba(240,165,0,0.2)' : 'transparent'}`,
            }}
          >
            {t(s.key)}
            {s.value === 'failed' && failedCount > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-700" style={{ background: 'rgba(244,63,94,0.2)', color: '#F43F5E' }}>
                {failedCount}
              </span>
            )}
          </button>
        ))}
        <div className="ml-auto text-xs text-ink-400 self-center">
          {t('sms.total')}: <span className="num text-white">{data?.total ?? 0}</span>
        </div>
      </div>

      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-10 shimmer rounded-lg" />)}
          </div>
        ) : !data?.logs?.length ? (
          <div className="flex items-center justify-center h-40 text-ink-500 text-sm">{t('sms.noLogs')}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('sms.phone')}</th>
                  <th>{t('sms.template')}</th>
                  <th>{t('sms.provider')}</th>
                  <th>{t('sms.status')}</th>
                  <th>{t('sms.error')}</th>
                  <th>{t('sms.sentAt')}</th>
                </tr>
              </thead>
              <tbody>
                {data.logs.map(log => (
                  <tr key={log.id}>
                    <td className="num text-white">{log.phone}</td>
                    <td>
                      <span className="text-xs px-2 py-1 rounded" style={{ background: 'rgba(255,255,255,0.06)', color: '#94A3B8' }}>
                        {log.template}
                      </span>
                    </td>
                    <td className="text-ink-400 capitalize">{log.provider}</td>
                    <td>
                      <StatusPill status={log.status} />
                    </td>
                    <td>
                      {log.errorMsg
                        ? <span className="text-rose text-xs max-w-[200px] truncate block" title={log.errorMsg}>{log.errorMsg}</span>
                        : <span className="text-ink-600">—</span>}
                    </td>
                    <td className="text-ink-400 num text-xs">{log.sentAt ? formatDateTime(log.sentAt) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {data && data.totalPages > 1 && (
          <div className="px-5 pb-4">
            <Pagination page={data.page} totalPages={data.totalPages} total={data.total} limit={LIMIT} onPage={setPage} />
          </div>
        )}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { color: string; bg: string }> = {
    sent: { color: '#10B981', bg: 'rgba(16,185,129,0.12)' },
    failed: { color: '#F43F5E', bg: 'rgba(244,63,94,0.12)' },
    queued: { color: '#F0A500', bg: 'rgba(240,165,0,0.12)' },
  };
  const s = map[status] ?? { color: '#94A3B8', bg: 'rgba(148,163,184,0.12)' };
  return (
    <span className="badge capitalize" style={{ color: s.color, background: s.bg }}>
      {status}
    </span>
  );
}
