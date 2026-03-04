'use client';
import { use, useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useDashboardAuth } from '@/contexts/DashboardAuthContext';
import { dashboardApi } from '@/lib/api/dashboard';
import { PageHeader } from '@/components/ui/PageHeader';
import { OrderStatusBadge } from '@/components/ui/StageBadge';
import { Pagination } from '@/components/ui/Pagination';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import type { Order, OrderSSEEvent } from '@/types/dashboard';
import toast from 'react-hot-toast';
import { useI18n } from '@/lib/i18n';

const STATUS_FILTERS = [
  { value: 'all', key: 'orders.all' },
  { value: 'active', key: 'orders.active' },
  { value: 'completed', key: 'orders.completed' },
];

export default function OrdersPage({ params }: { params: Promise<{ hotelId: string }> }) {
  const { hotelId } = use(params);
  const { token } = useDashboardAuth();
  const { t } = useI18n();
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('active');
  const [page, setPage] = useState(1);
  const LIMIT = 20;
  const esRef = useRef<EventSource | null>(null);
  const [liveConnected, setLiveConnected] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['orders', hotelId, statusFilter, page],
    queryFn: () => dashboardApi.getOrders(hotelId, token!, { status: statusFilter, page, limit: LIMIT }),
    enabled: !!token,
    refetchInterval: 15_000,
  });

  // SSE connection
  const connectSSE = useCallback(() => {
    if (!token) return;
    if (esRef.current) esRef.current.close();
    const url = dashboardApi.getOrdersStreamUrl(hotelId, token);
    const es = new EventSource(url);
    esRef.current = es;

    es.onopen = () => setLiveConnected(true);

    es.onmessage = (e) => {
      if (!e.data || e.data === 'ping') return;
      try {
        const event: OrderSSEEvent = JSON.parse(e.data);
        if (event.type === 'order_created') {
          toast.success(t('orders.newOrder', { room: event.order.roomNumber }), { icon: '🛎️' });
          qc.invalidateQueries({ queryKey: ['orders', hotelId] });
        } else if (event.type === 'order_status_changed') {
          qc.invalidateQueries({ queryKey: ['orders', hotelId] });
        } else if (event.type === 'order_completed') {
          qc.invalidateQueries({ queryKey: ['orders', hotelId] });
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

  return (
    <div className="p-6 max-w-[1200px] animate-fade-in">
      <PageHeader
        title={t('orders.title')}
        subtitle={t('orders.subtitle')}
        actions={
          <div className="flex items-center gap-2 text-xs">
            <span className={`w-2 h-2 rounded-full ${liveConnected ? 'bg-teal live-dot' : 'bg-rose'}`} />
            <span className="text-ink-400">{liveConnected ? t('orders.live') : t('orders.reconnecting')}</span>
          </div>
        }
      />

      {/* Status filter */}
      <div className="flex gap-1.5 mb-5">
        {STATUS_FILTERS.map(f => (
          <button
            key={f.value}
            onClick={() => { setStatusFilter(f.value); setPage(1); }}
            className="px-3 py-1.5 rounded-lg text-xs font-600 font-display transition-all"
            style={{
              background: statusFilter === f.value ? 'rgba(240,165,0,0.12)' : 'rgba(255,255,255,0.04)',
              color: statusFilter === f.value ? '#F0A500' : '#64748B',
              border: `1px solid ${statusFilter === f.value ? 'rgba(240,165,0,0.2)' : 'transparent'}`,
            }}
          >
            {t(f.key)}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-12 shimmer rounded-lg" />)}
          </div>
        ) : !data?.orders?.length ? (
          <div className="flex items-center justify-center h-40 text-ink-500 text-sm">{t('orders.noOrders')}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('orders.orderNum')}</th>
                  <th>{t('orders.room')}</th>
                  <th>{t('orders.guest')}</th>
                  <th>{t('orders.items')}</th>
                  <th>{t('orders.total')}</th>
                  <th>{t('orders.status')}</th>
                  <th>{t('orders.time')}</th>
                </tr>
              </thead>
              <tbody>
                {data.orders.map(order => (
                  <OrderRow key={order.id} order={order} />
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

function OrderRow({ order }: { order: Order }) {
  return (
    <tr>
      <td>
        <span className="num font-600 text-gold">{order.orderNumber}</span>
      </td>
      <td>
        <span className="num font-600 text-white">#{order.roomNumber}</span>
      </td>
      <td className="text-ink-200">{order.guestName}</td>
      <td>
        <div className="text-xs text-ink-400 max-w-[200px]">
          {order.items.map(i => `${i.name} x${i.quantity}`).join(', ')}
        </div>
      </td>
      <td>
        <span className="num font-600 text-white">{formatCurrency(order.totalAmount)}</span>
      </td>
      <td>
        <OrderStatusBadge status={order.status} />
      </td>
      <td className="text-ink-400 num text-xs">{formatDateTime(order.createdAt)}</td>
    </tr>
  );
}
