import { cn } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon?: React.ReactNode;
  accent?: 'gold' | 'teal' | 'rose' | 'blue';
  trend?: { value: number; label?: string };
  className?: string;
}

const accentMap = {
  gold: { color: '#F0A500', bg: 'rgba(240,165,0,0.1)', glow: 'rgba(240,165,0,0.15)' },
  teal: { color: '#10B981', bg: 'rgba(16,185,129,0.1)', glow: 'rgba(16,185,129,0.15)' },
  rose: { color: '#F43F5E', bg: 'rgba(244,63,94,0.1)', glow: 'rgba(244,63,94,0.15)' },
  blue: { color: '#3B82F6', bg: 'rgba(59,130,246,0.1)', glow: 'rgba(59,130,246,0.15)' },
};

export function StatCard({ label, value, sub, icon, accent = 'gold', trend, className }: StatCardProps) {
  const a = accentMap[accent];
  return (
    <div
      className={cn('card p-5 card-interactive relative overflow-hidden', className)}
      style={{ borderColor: `rgba(${accent === 'gold' ? '240,165,0' : accent === 'teal' ? '16,185,129' : accent === 'rose' ? '244,63,94' : '59,130,246'},0.12)` }}
    >
      {/* Subtle corner glow */}
      <div className="absolute top-0 right-0 w-24 h-24 rounded-full opacity-30 pointer-events-none"
        style={{ background: `radial-gradient(circle at top right, ${a.glow}, transparent 70%)`, transform: 'translate(30%, -30%)' }}
      />

      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-600 uppercase tracking-widest text-ink-400 font-display">{label}</p>
        {icon && (
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: a.bg }}>
            <span style={{ color: a.color }}>{icon}</span>
          </div>
        )}
      </div>

      <div className="num text-3xl font-700 text-white mb-1" style={{ fontFamily: 'var(--font-jetbrains)' }}>
        {value}
      </div>

      {(sub || trend) && (
        <div className="flex items-center gap-3 mt-1">
          {sub && <p className="text-xs text-ink-400">{sub}</p>}
          {trend && (
            <span className={cn('text-xs font-600 flex items-center gap-0.5', trend.value >= 0 ? 'text-teal' : 'text-rose')}>
              {trend.value >= 0 ? '↑' : '↓'} {Math.abs(trend.value)}%
              {trend.label && <span className="text-ink-400 font-400 ml-0.5">{trend.label}</span>}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
