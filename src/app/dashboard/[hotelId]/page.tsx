'use client';
import { use } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useDashboardAuth } from '@/contexts/DashboardAuthContext';
import { dashboardApi } from '@/lib/api/dashboard';
import { StatCard } from '@/components/ui/StatCard';
import { PageHeader } from '@/components/ui/PageHeader';
import { OrderStatusBadge, StageBadge } from '@/components/ui/StageBadge';
import { formatCurrency, formatTimeAgo } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';

function SkeletonCard() {
  return <div className="card p-5 h-[120px] shimmer" />;
}

export default function OverviewPage({ params }: { params: Promise<{ hotelId: string }> }) {
  const { hotelId } = use(params);
  const { token } = useDashboardAuth();
  const { t } = useI18n();

  const { data, isLoading, error } = useQuery({
    queryKey: ['overview', hotelId],
    queryFn: () => dashboardApi.getOverview(hotelId, token!),
    enabled: !!token,
    refetchInterval: 45_000,
  });

  if (error) return (
    <div className="p-6">
      <div className="card p-6 border-rose/20 text-rose text-sm">{t('overview.failedToLoad')}</div>
    </div>
  );

  return (
    <div className="p-6 max-w-[1200px] animate-fade-in">
      <PageHeader
        title={t('overview.title')}
        subtitle={t('overview.subtitle')}
        actions={
          <div className="flex items-center gap-2 text-xs text-ink-400">
            <span className="w-2 h-2 rounded-full bg-teal live-dot" />
            {t('overview.liveRefresh')}
          </div>
        }
      />

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
        ) : (
          <>
            <StatCard
              label={t('overview.guestsToday')}
              value={data?.todayGuests ?? 0}
              sub={t('overview.newCheckIns')}
              accent="gold"
              icon={<GuestIcon />}
            />
            <StatCard
              label={t('overview.orders')}
              value={data?.todayOrders ?? 0}
              sub={t('overview.roomService')}
              accent="teal"
              icon={<OrderIcon />}
            />
            <StatCard
              label={t('overview.revenue')}
              value={formatCurrency(data?.todayRevenue ?? 0)}
              sub={t('overview.today')}
              accent="blue"
              icon={<RevenueIcon />}
            />
            <StatCard
              label={t('overview.qrScans')}
              value={data?.todayQRScans ?? 0}
              sub={t('overview.smsSent', { n: data?.todaySMS ?? 0 })}
              accent="rose"
              icon={<QRScanIcon />}
            />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Orders */}
        <div className="card">
          <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
            <h2 className="font-display font-700 text-sm text-white">{t('overview.recentOrders')}</h2>
            <a href={`/dashboard/${hotelId}/orders`} className="text-xs text-gold hover:text-gold-dim transition-colors">{t('overview.viewAll')}</a>
          </div>
          <div>
            {isLoading ? (
              <div className="p-5 space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-12 shimmer rounded-lg" />
                ))}
              </div>
            ) : !data?.recentOrders?.length ? (
              <EmptyState message={t('overview.noOrdersToday')} />
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t('overview.room')}</th>
                    <th>{t('overview.guest')}</th>
                    <th>{t('overview.items')}</th>
                    <th>{t('overview.status')}</th>
                    <th className="text-right">{t('overview.amount')}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentOrders.map(order => (
                    <tr key={order.id}>
                      <td>
                        <span className="num font-600 text-white">#{order.roomNumber}</span>
                      </td>
                      <td className="text-ink-200 max-w-[120px] truncate">{order.guestName}</td>
                      <td className="text-ink-400 text-xs max-w-[140px] truncate">{order.items}</td>
                      <td><OrderStatusBadge status={order.status} /></td>
                      <td className="text-right num text-white font-600">{formatCurrency(order.totalAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Recent Stage Changes */}
        <div className="card">
          <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
            <h2 className="font-display font-700 text-sm text-white">{t('overview.guestJourneyUpdates')}</h2>
            <a href={`/dashboard/${hotelId}/guests`} className="text-xs text-gold hover:text-gold-dim transition-colors">{t('overview.viewAll')}</a>
          </div>
          <div>
            {isLoading ? (
              <div className="p-5 space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-10 shimmer rounded-lg" />
                ))}
              </div>
            ) : !data?.recentGuestChanges?.length ? (
              <EmptyState message={t('overview.noStageChangesToday')} />
            ) : (
              <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                {data.recentGuestChanges.map((change, i) => (
                  <div key={i} className="px-5 py-3.5 flex items-center gap-3 hover:bg-white/[0.01] transition-colors">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-700 font-display"
                      style={{ background: 'rgba(240,165,0,0.1)', color: '#F0A500' }}>
                      {change.guestName[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-white font-600 truncate">{change.guestName}</span>
                        {change.roomNumber && (
                          <span className="text-xs text-ink-400 num">{t('common.rm')} {change.roomNumber}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <StageBadge stage={change.fromStage} />
                        <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="#64748B" strokeWidth="2">
                          <path d="M5 12h14M12 5l7 7-7 7"/>
                        </svg>
                        <StageBadge stage={change.toStage} />
                      </div>
                    </div>
                    <span className="text-xs text-ink-500 shrink-0">{formatTimeAgo(change.changedAt)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center h-32 text-ink-500 text-sm">{message}</div>
  );
}

function GuestIcon() {
  return (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
    </svg>
  );
}
function OrderIcon() {
  return (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/>
    </svg>
  );
}
function RevenueIcon() {
  return (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
    </svg>
  );
}
function QRScanIcon() {
  return (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
    </svg>
  );
}
