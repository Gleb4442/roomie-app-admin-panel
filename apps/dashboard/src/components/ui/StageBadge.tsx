import { stageConfig, orderStatusConfig, serviceStatusConfig } from '@/lib/utils';

export function StageBadge({ stage }: { stage: string }) {
  const cfg = stageConfig[stage] ?? { label: stage, color: '#94A3B8', bg: 'rgba(148,163,184,0.12)' };
  return (
    <span className="badge" style={{ color: cfg.color, background: cfg.bg }}>
      {cfg.label}
    </span>
  );
}

export function OrderStatusBadge({ status }: { status: string }) {
  const cfg = orderStatusConfig[status] ?? { label: status, color: '#94A3B8', bg: 'rgba(148,163,184,0.12)' };
  return (
    <span className="badge" style={{ color: cfg.color, background: cfg.bg }}>
      {cfg.label}
    </span>
  );
}

export function ServiceStatusBadge({ status }: { status: string }) {
  const cfg = serviceStatusConfig[status] ?? { label: status, color: '#94A3B8', bg: 'rgba(148,163,184,0.12)' };
  return (
    <span className="badge" style={{ color: cfg.color, background: cfg.bg }}>
      {cfg.label}
    </span>
  );
}
