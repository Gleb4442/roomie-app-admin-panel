'use client';
import { use } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useDashboardAuth } from '@/contexts/DashboardAuthContext';
import { dashboardApi, type TMSStats } from '@/lib/api/dashboard';
import { PageHeader } from '@/components/ui/PageHeader';
import {
  PieChart, Pie, Cell, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

const STATUS_COLOR: Record<string, string> = {
  NEW: '#64748B',
  ASSIGNED: '#3B82F6',
  IN_PROGRESS: '#F0A500',
  ON_HOLD: '#8B5CF6',
  COMPLETED: '#10B981',
  CLOSED: '#0EA5E9',
  CANCELLED: '#F43F5E',
};

const DEPT_COLOR: Record<string, string> = {
  HOUSEKEEPING: '#10B981',
  MAINTENANCE: '#3B82F6',
  FOOD_AND_BEVERAGE: '#F59E0B',
  FRONT_OFFICE: '#8B5CF6',
  SECURITY: '#F43F5E',
  MANAGEMENT: '#64748B',
};

const DEPT_SHORT: Record<string, string> = {
  HOUSEKEEPING: 'Housekeeping',
  MAINTENANCE: 'Maintenance',
  FOOD_AND_BEVERAGE: 'F&B',
  FRONT_OFFICE: 'Front Office',
  SECURITY: 'Security',
  MANAGEMENT: 'Management',
};

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="px-3 py-2 rounded-lg text-xs" style={{ background: '#1C2230', border: '1px solid rgba(255,255,255,0.1)' }}>
      <p className="text-ink-300 mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.fill || p.stroke || '#F0A500' }}>
          {p.name}: <span className="font-600">{p.value}</span>
        </p>
      ))}
    </div>
  );
}

function PieTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="px-3 py-2 rounded-lg text-xs" style={{ background: '#1C2230', border: '1px solid rgba(255,255,255,0.1)' }}>
      <p style={{ color: payload[0].payload.fill }}>{payload[0].name}</p>
      <p className="text-white font-600">{payload[0].value} tasks</p>
    </div>
  );
}

function StatCard({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs text-ink-400 font-display uppercase tracking-wider mb-1">{label}</p>
      <p className="text-2xl font-700 font-display" style={{ color: accent ?? '#F0A500' }}>{value}</p>
      {sub && <p className="text-xs text-ink-500 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function TMSTasksPage({ params }: { params: Promise<{ hotelId: string }> }) {
  const { hotelId } = use(params);
  const { token } = useDashboardAuth();

  const { data: stats, isLoading } = useQuery<TMSStats>({
    queryKey: ['tms-stats', hotelId],
    queryFn: () => dashboardApi.getTMSStats(hotelId, token!),
    enabled: !!token,
    refetchInterval: 60_000,
  });

  const totalTasks = stats?.totalTasks ?? 0;
  const activeTasks = (stats?.byStatus ?? [])
    .filter(s => ['NEW', 'ASSIGNED', 'IN_PROGRESS', 'ON_HOLD'].includes(s.status))
    .reduce((acc, s) => acc + s.count, 0);
  const completedTasks = (stats?.byStatus ?? [])
    .find(s => s.status === 'COMPLETED')?.count ?? 0;
  const slaLabel = stats?.slaCompliance !== null
    ? `${stats?.slaCompliance}%`
    : '—';

  const pieData = (stats?.byStatus ?? []).map(s => ({
    name: s.status.replace(/_/g, ' '),
    value: s.count,
    fill: STATUS_COLOR[s.status] ?? '#64748B',
  })).filter(d => d.value > 0);

  const barData = (stats?.byDepartment ?? []).map(d => ({
    name: DEPT_SHORT[d.department] ?? d.department,
    tasks: d.count,
    fill: DEPT_COLOR[d.department] ?? '#64748B',
  })).sort((a, b) => b.tasks - a.tasks);

  return (
    <div className="p-6 max-w-[1200px] animate-fade-in">
      <PageHeader
        title="TMS Analytics"
        subtitle="Task management statistics — last 30 days"
        actions={
          <span className="text-xs text-ink-400 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: '#10B981' }} />
            Auto-refreshes every minute
          </span>
        }
      />

      {isLoading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 shimmer rounded-xl" />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="h-60 shimmer rounded-xl" />
            <div className="h-60 shimmer rounded-xl" />
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {/* KPI cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Total Tasks" value={totalTasks} sub="last 30 days" />
            <StatCard label="Active" value={activeTasks} sub="in progress / assigned" accent="#3B82F6" />
            <StatCard label="Completed" value={completedTasks} sub="last 30 days" accent="#10B981" />
            <StatCard
              label="SLA Compliance"
              value={slaLabel}
              sub={stats?.slaTotal ? `${stats.slaTotal} tasks with SLA` : 'No SLA data'}
              accent={
                stats?.slaCompliance == null ? '#64748B' :
                stats.slaCompliance >= 80 ? '#10B981' :
                stats.slaCompliance >= 60 ? '#F59E0B' : '#F43F5E'
              }
            />
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Pie: by status */}
            <div className="card p-5">
              <h3 className="text-sm font-600 text-white mb-4">Tasks by Status</h3>
              {pieData.length === 0 ? (
                <div className="flex items-center justify-center h-44 text-ink-500 text-sm">No tasks in the last 30 days</div>
              ) : (
                <div className="flex items-center gap-4">
                  <ResponsiveContainer width={160} height={160}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={72}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {pieData.map((entry, i) => (
                          <Cell key={i} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip content={<PieTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-1.5 flex-1">
                    {pieData.map((d, i) => (
                      <div key={i} className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.fill }} />
                          <span className="text-xs text-ink-300">{d.name}</span>
                        </div>
                        <span className="text-xs font-600 text-white num">{d.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Bar: by department */}
            <div className="card p-5">
              <h3 className="text-sm font-600 text-white mb-4">Tasks by Department</h3>
              {barData.length === 0 ? (
                <div className="flex items-center justify-center h-44 text-ink-500 text-sm">No tasks in the last 30 days</div>
              ) : (
                <ResponsiveContainer width="100%" height={170}>
                  <BarChart data={barData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }} barSize={18}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                    <Bar dataKey="tasks" radius={[4, 4, 0, 0]}>
                      {barData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Status breakdown table */}
          <div className="card overflow-hidden">
            <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <h3 className="text-sm font-600 text-white">Status Breakdown</h3>
            </div>
            {stats?.byStatus && stats.byStatus.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Status</th>
                      <th>Count</th>
                      <th>Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.byStatus
                      .sort((a, b) => b.count - a.count)
                      .map(s => (
                        <tr key={s.status}>
                          <td>
                            <div className="flex items-center gap-2">
                              <span
                                className="w-2 h-2 rounded-full"
                                style={{ background: STATUS_COLOR[s.status] ?? '#64748B' }}
                              />
                              <span className="text-sm text-ink-200">{s.status.replace(/_/g, ' ')}</span>
                            </div>
                          </td>
                          <td>
                            <span className="num font-600 text-white">{s.count}</span>
                          </td>
                          <td>
                            <div className="flex items-center gap-3">
                              <div className="flex-1 h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.08)', maxWidth: 120 }}>
                                <div
                                  className="h-full rounded-full"
                                  style={{
                                    width: `${totalTasks > 0 ? (s.count / totalTasks * 100) : 0}%`,
                                    background: STATUS_COLOR[s.status] ?? '#64748B',
                                  }}
                                />
                              </div>
                              <span className="text-xs text-ink-400 num w-10 text-right">
                                {totalTasks > 0 ? Math.round(s.count / totalTasks * 100) : 0}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex items-center justify-center h-20 text-ink-500 text-sm">
                No task data available
              </div>
            )}
          </div>

          {/* SLA info */}
          {stats?.slaTotal && stats.slaTotal > 0 && (
            <div className="card p-5">
              <h3 className="text-sm font-600 text-white mb-3">SLA Performance</h3>
              <div className="flex items-center gap-4">
                <div
                  className="relative w-24 h-24 shrink-0"
                  style={{ borderRadius: '50%', background: `conic-gradient(${
                    stats.slaCompliance !== null && stats.slaCompliance >= 80 ? '#10B981' :
                    stats.slaCompliance !== null && stats.slaCompliance >= 60 ? '#F59E0B' : '#F43F5E'
                  } ${stats.slaCompliance ?? 0}%, rgba(255,255,255,0.08) ${stats.slaCompliance ?? 0}%)` }}
                >
                  <div
                    className="absolute inset-3 rounded-full flex items-center justify-center"
                    style={{ background: '#161B22' }}
                  >
                    <span className="text-sm font-700 text-white">{slaLabel}</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-ink-300">
                    <span className="text-white font-600">{stats.slaTotal}</span> tasks had an SLA target in the last 30 days.
                  </p>
                  <p className="text-sm text-ink-300">
                    <span className="font-600" style={{ color: '#10B981' }}>
                      {stats.slaCompliance !== null ? Math.round(stats.slaCompliance / 100 * stats.slaTotal) : 0}
                    </span> completed within SLA.
                  </p>
                  {stats.slaCompliance !== null && (
                    <p className="text-xs text-ink-500 mt-2">
                      {stats.slaCompliance >= 80
                        ? '✅ SLA compliance is healthy'
                        : stats.slaCompliance >= 60
                          ? '⚠️ SLA compliance needs improvement'
                          : '🔴 SLA compliance is critical — review staffing and priorities'}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
