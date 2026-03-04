'use client';
import { use, useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useDashboardAuth } from '@/contexts/DashboardAuthContext';
import { dashboardApi } from '@/lib/api/dashboard';
import { PageHeader } from '@/components/ui/PageHeader';
import { ServiceStatusBadge } from '@/components/ui/StageBadge';
import { Pagination } from '@/components/ui/Pagination';
import { formatCurrency, formatTimeAgo } from '@/lib/utils';
import type { ServiceRequest, ServiceRequestStatus } from '@/types/dashboard';
import toast from 'react-hot-toast';
import { useI18n } from '@/lib/i18n';

const STATUSES: { value: string; key: string }[] = [
  { value: '', key: 'services.all' },
  { value: 'pending', key: 'services.pending' },
  { value: 'accepted', key: 'services.accepted' },
  { value: 'in_progress', key: 'services.inProgress' },
  { value: 'completed', key: 'services.completed' },
  { value: 'rejected', key: 'services.rejected' },
];

const NEXT_STATUS: Record<ServiceRequestStatus, ServiceRequestStatus | null> = {
  pending: 'accepted',
  accepted: 'in_progress',
  in_progress: 'completed',
  completed: null,
  rejected: null,
};

const NEXT_LABEL_KEY: Record<string, string> = {
  pending: 'services.accept',
  accepted: 'services.start',
  in_progress: 'services.complete',
};

export default function ServicesPage({ params }: { params: Promise<{ hotelId: string }> }) {
  const { hotelId } = use(params);
  const { token } = useDashboardAuth();
  const { t } = useI18n();
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('pending');
  const [page, setPage] = useState(1);
  const LIMIT = 20;
  const esRef = useRef<EventSource | null>(null);
  const [liveConnected, setLiveConnected] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['service-requests', hotelId, statusFilter, page],
    queryFn: () => dashboardApi.getServiceRequests(hotelId, token!, { status: statusFilter || undefined, page, limit: LIMIT }),
    enabled: !!token,
    refetchInterval: 20_000,
  });

  const { data: stats } = useQuery({
    queryKey: ['service-stats', hotelId],
    queryFn: () => dashboardApi.getServiceStats(hotelId, token!),
    enabled: !!token,
    refetchInterval: 60_000,
  });

  const connectSSE = useCallback(() => {
    if (!token) return;
    if (esRef.current) esRef.current.close();
    const url = dashboardApi.getServiceRequestsStreamUrl(hotelId, token);
    const es = new EventSource(url);
    esRef.current = es;
    es.onopen = () => setLiveConnected(true);
    es.onmessage = (e) => {
      if (!e.data || e.data === 'ping') return;
      try {
        const event = JSON.parse(e.data);
        if (event.type === 'request_created') {
          toast.success(t('services.newRequest', { room: event.request?.roomNumber ?? '—' }), { icon: '🔔' });
          qc.invalidateQueries({ queryKey: ['service-requests', hotelId] });
          qc.invalidateQueries({ queryKey: ['service-stats', hotelId] });
        } else {
          qc.invalidateQueries({ queryKey: ['service-requests', hotelId] });
        }
      } catch { /* ignore */ }
    };
    es.onerror = () => {
      setLiveConnected(false);
      es.close();
      setTimeout(connectSSE, 5000);
    };
  }, [token, hotelId, qc, t]);

  useEffect(() => {
    connectSSE();
    return () => esRef.current?.close();
  }, [connectSSE]);

  const updateStatus = async (req: ServiceRequest, nextStatus: ServiceRequestStatus) => {
    try {
      await dashboardApi.updateServiceRequestStatus(hotelId, req.id, nextStatus, token!);
      qc.invalidateQueries({ queryKey: ['service-requests', hotelId] });
      qc.invalidateQueries({ queryKey: ['service-stats', hotelId] });
      toast.success(`Request marked as ${nextStatus}`);
    } catch {
      toast.error(t('services.failedUpdate'));
    }
  };

  return (
    <div className="p-6 max-w-[1200px] animate-fade-in">
      <PageHeader
        title={t('services.title')}
        subtitle={t('services.subtitle')}
        actions={
          <div className="flex items-center gap-2 text-xs">
            <span className={`w-2 h-2 rounded-full ${liveConnected ? 'bg-teal live-dot' : 'bg-rose'}`} />
            <span className="text-ink-400">{liveConnected ? t('services.live') : t('services.reconnecting')}</span>
          </div>
        }
      />

      {/* Quick stats */}
      {stats && (
        <div className="flex flex-wrap gap-3 mb-5">
          {[
            { label: t('services.pending'), value: stats.byStatus.pending ?? 0, color: '#F0A500' },
            { label: t('services.inProgress'), value: stats.byStatus.in_progress ?? 0, color: '#F59E0B' },
            { label: t('services.todayRevenue'), value: formatCurrency(stats.todayRevenue), color: '#10B981' },
            { label: t('services.avgCompletion'), value: `${Math.round(stats.averageCompletionMinutes ?? 0)}min`, color: '#3B82F6' },
          ].map(s => (
            <div key={s.label} className="card px-4 py-3 flex items-center gap-3">
              <span className="num font-700 text-lg" style={{ color: s.color, fontFamily: 'var(--font-jetbrains)' }}>{s.value}</span>
              <span className="text-xs text-ink-400">{s.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Status filter */}
      <div className="flex flex-wrap gap-1.5 mb-5">
        {STATUSES.map(s => (
          <button
            key={s.value}
            onClick={() => { setStatusFilter(s.value); setPage(1); }}
            className="px-3 py-1.5 rounded-lg text-xs font-600 font-display transition-all"
            style={{
              background: statusFilter === s.value ? 'rgba(240,165,0,0.12)' : 'rgba(255,255,255,0.04)',
              color: statusFilter === s.value ? '#F0A500' : '#64748B',
              border: `1px solid ${statusFilter === s.value ? 'rgba(240,165,0,0.2)' : 'transparent'}`,
            }}
          >
            {t(s.key)}
            {s.value === 'pending' && stats?.byStatus.pending ? (
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-700" style={{ background: 'rgba(240,165,0,0.2)', color: '#F0A500' }}>
                {stats.byStatus.pending}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {/* Requests list */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-14 shimmer rounded-lg" />)}
          </div>
        ) : !data?.requests?.length ? (
          <div className="flex items-center justify-center h-40 text-ink-500 text-sm">{t('services.noRequests')}</div>
        ) : (
          <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
            {data.requests.map(req => {
              const next = NEXT_STATUS[req.status];
              return (
                <div key={req.id} className="px-5 py-4 flex items-center gap-4 hover:bg-white/[0.01] transition-colors">
                  {/* Category icon */}
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center text-base shrink-0"
                    style={{ background: 'rgba(255,255,255,0.06)' }}>
                    {req.category?.icon || '🔔'}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-600 text-white">{req.category?.name || 'Request'}</span>
                      <span className="text-xs text-ink-400 num">Rm {req.roomNumber}</span>
                      {req.guest && (
                        <span className="text-xs text-ink-500">— {req.guest.firstName} {req.guest.lastName}</span>
                      )}
                    </div>
                    {req.comment && (
                      <p className="text-xs text-ink-400 truncate max-w-[300px]">{req.comment}</p>
                    )}
                    {req.items?.length > 0 && (
                      <p className="text-xs text-ink-500 mt-0.5">
                        {req.items.map(i => `${i.serviceItem?.name ?? i.serviceItemId} x${i.quantity}`).join(', ')}
                      </p>
                    )}
                  </div>

                  {/* Amount */}
                  {req.totalAmount > 0 && (
                    <span className="num text-sm font-600 text-white shrink-0">{formatCurrency(req.totalAmount)}</span>
                  )}

                  {/* Status */}
                  <ServiceStatusBadge status={req.status} />

                  {/* Time */}
                  <span className="text-xs text-ink-500 num shrink-0">{formatTimeAgo(req.createdAt)}</span>

                  {/* Action */}
                  {next && (
                    <button
                      onClick={() => updateStatus(req, next)}
                      className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-600 font-display transition-all"
                      style={{ background: 'rgba(16,185,129,0.1)', color: '#10B981', border: '1px solid rgba(16,185,129,0.2)' }}
                    >
                      {NEXT_LABEL_KEY[req.status] ? t(NEXT_LABEL_KEY[req.status]) : next}
                    </button>
                  )}
                  {req.status === 'pending' && (
                    <button
                      onClick={() => updateStatus(req, 'rejected')}
                      className="shrink-0 px-2 py-1.5 rounded-lg text-xs font-600 font-display transition-all"
                      style={{ background: 'rgba(244,63,94,0.08)', color: '#F43F5E' }}
                    >
                      ✕
                    </button>
                  )}
                </div>
              );
            })}
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
