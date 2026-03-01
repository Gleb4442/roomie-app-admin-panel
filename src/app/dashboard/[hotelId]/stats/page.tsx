'use client';
import { use, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useDashboardAuth } from '@/contexts/DashboardAuthContext';
import { dashboardApi } from '@/lib/api/dashboard';
import { PageHeader } from '@/components/ui/PageHeader';
import { formatCurrency } from '@/lib/utils';
import { format, subDays, startOfMonth } from 'date-fns';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';

const PRESET_RANGES = [
  { label: '7 days', days: 7 },
  { label: '30 days', days: 30 },
  { label: 'This month', days: 0 },
];

const COLORS = ['#F0A500', '#10B981', '#3B82F6', '#A855F7', '#F43F5E'];

export default function StatsPage({ params }: { params: Promise<{ hotelId: string }> }) {
  const { hotelId } = use(params);
  const { token } = useDashboardAuth();
  const today = format(new Date(), 'yyyy-MM-dd');
  const [from, setFrom] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [to] = useState(today);
  const [preset, setPreset] = useState(0);

  const { data, isLoading } = useQuery({
    queryKey: ['stats', hotelId, from, to],
    queryFn: () => dashboardApi.getStats(hotelId, token!, { from, to }),
    enabled: !!token,
  });

  const applyPreset = (idx: number) => {
    setPreset(idx);
    const p = PRESET_RANGES[idx];
    if (p.days === 0) {
      setFrom(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
    } else {
      setFrom(format(subDays(new Date(), p.days - 1), 'yyyy-MM-dd'));
    }
  };

  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ color: string; name: string; value: number }>; label?: string }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="card px-3 py-2 text-xs" style={{ minWidth: 120 }}>
        <p className="text-ink-400 mb-1">{label}</p>
        {payload.map((p, i) => (
          <p key={i} className="num font-600" style={{ color: p.color }}>{p.name}: {p.value}</p>
        ))}
      </div>
    );
  };

  return (
    <div className="p-6 max-w-[1200px] animate-fade-in">
      <PageHeader
        title="Statistics"
        subtitle={`${from} — ${to}`}
        actions={
          <div className="flex gap-1.5">
            {PRESET_RANGES.map((p, i) => (
              <button key={i} onClick={() => applyPreset(i)}
                className="px-3 py-1.5 rounded-lg text-xs font-600 font-display transition-all"
                style={{
                  background: preset === i ? 'rgba(240,165,0,0.12)' : 'rgba(255,255,255,0.04)',
                  color: preset === i ? '#F0A500' : '#64748B',
                  border: `1px solid ${preset === i ? 'rgba(240,165,0,0.2)' : 'transparent'}`,
                }}>
                {p.label}
              </button>
            ))}
          </div>
        }
      />

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="card h-[220px] shimmer" />)}
        </div>
      ) : !data ? null : (
        <div className="space-y-4">
          {/* Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {[
              { label: 'Total Orders', value: data.orders.totalCount, color: '#F0A500' },
              { label: 'Revenue', value: formatCurrency(data.orders.totalRevenue), color: '#10B981' },
              { label: 'Avg. Check', value: formatCurrency(data.orders.averageCheck), color: '#3B82F6' },
              { label: 'Unique Guests', value: data.appOpens.totalUnique, color: '#A855F7' },
              { label: 'QR Scans', value: data.qrScans.total, color: '#F43F5E' },
            ].map(s => (
              <div key={s.label} className="card p-4">
                <p className="text-xs text-ink-400 font-display font-600 uppercase tracking-widest mb-1">{s.label}</p>
                <p className="num text-xl font-700" style={{ color: s.color, fontFamily: 'var(--font-jetbrains)' }}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Orders + Revenue chart */}
          <div className="card p-5">
            <h3 className="font-display font-700 text-sm text-white mb-5">Orders & Revenue</h3>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={data.orders.daily} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#F0A500" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#F0A500" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="cntGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="date" tick={{ fill: '#475569', fontSize: 10 }} tickFormatter={d => d.slice(5)} />
                <YAxis tick={{ fill: '#475569', fontSize: 10 }} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="revenue" stroke="#F0A500" fill="url(#revGrad)" strokeWidth={1.5} name="Revenue ($)" />
                <Area type="monotone" dataKey="count" stroke="#10B981" fill="url(#cntGrad)" strokeWidth={1.5} name="Orders" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* App Opens */}
            <div className="card p-5">
              <h3 className="font-display font-700 text-sm text-white mb-5">App Opens</h3>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={data.appOpens.daily} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="date" tick={{ fill: '#475569', fontSize: 10 }} tickFormatter={d => d.slice(5)} />
                  <YAxis tick={{ fill: '#475569', fontSize: 10 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="uniqueGuests" fill="rgba(168,85,247,0.7)" name="Unique guests" radius={[3,3,0,0]} />
                  <Bar dataKey="totalOpens" fill="rgba(99,102,241,0.4)" name="Total opens" radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Top items */}
            {data.orders.topItems?.length > 0 && (
              <div className="card p-5">
                <h3 className="font-display font-700 text-sm text-white mb-4">Top Menu Items</h3>
                <div className="space-y-2.5">
                  {data.orders.topItems.slice(0, 6).map((item, i) => {
                    const max = data.orders.topItems[0].count;
                    return (
                      <div key={i} className="flex items-center gap-3">
                        <span className="num text-xs w-4 text-ink-500">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-white truncate">{item.name}</span>
                            <span className="num text-xs text-ink-400 ml-2">{item.count}x</span>
                          </div>
                          <div className="h-1 rounded-full bg-white/5">
                            <div className="h-1 rounded-full transition-all" style={{ width: `${(item.count / max) * 100}%`, background: COLORS[i % COLORS.length] }} />
                          </div>
                        </div>
                        <span className="num text-xs text-ink-400 w-16 text-right">{formatCurrency(item.revenue)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* SMS stats */}
            <div className="card p-5">
              <h3 className="font-display font-700 text-sm text-white mb-4">SMS Delivery</h3>
              <div className="flex items-center gap-6">
                <div style={{ width: 120, height: 120 }}>
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={[
                        { name: 'Delivered', value: data.sms.delivered },
                        { name: 'Failed', value: data.sms.failed },
                        { name: 'Other', value: Math.max(0, data.sms.total - data.sms.delivered - data.sms.failed) },
                      ]} cx="50%" cy="50%" innerRadius={35} outerRadius={55} dataKey="value" strokeWidth={0}>
                        <Cell fill="#10B981" />
                        <Cell fill="#F43F5E" />
                        <Cell fill="#334155" />
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-2">
                  {[
                    { label: 'Total Sent', value: data.sms.total, color: '#94A3B8' },
                    { label: 'Delivered', value: data.sms.delivered, color: '#10B981' },
                    { label: 'Failed', value: data.sms.failed, color: '#F43F5E' },
                  ].map(s => (
                    <div key={s.label} className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ background: s.color }} />
                      <span className="text-xs text-ink-400">{s.label}</span>
                      <span className="num text-sm font-700 ml-auto" style={{ color: s.color }}>{s.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Guest journey */}
            <div className="card p-5">
              <h3 className="font-display font-700 text-sm text-white mb-4">Guest Journey</h3>
              <div className="space-y-3">
                {[
                  { label: 'Pre-Arrival', value: data.guestJourney.preArrival, color: '#F0A500' },
                  { label: 'In Stay', value: data.guestJourney.inStay, color: '#10B981' },
                  { label: 'Post Stay', value: data.guestJourney.postStay, color: '#A855F7' },
                ].map(s => {
                  const total = data.guestJourney.totalGuestsInPeriod || 1;
                  return (
                    <div key={s.label}>
                      <div className="flex justify-between text-xs mb-1.5">
                        <span className="text-ink-400">{s.label}</span>
                        <span className="num" style={{ color: s.color }}>{s.value}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-white/5">
                        <div className="h-1.5 rounded-full" style={{ width: `${(s.value / total) * 100}%`, background: s.color }} />
                      </div>
                    </div>
                  );
                })}
                <div className="pt-2 border-t mt-3" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                  <div className="flex justify-between text-xs">
                    <span className="text-ink-400">Pre-checkin conversion</span>
                    <span className="num font-700 text-teal">{data.guestJourney.preCheckinConversion}%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
