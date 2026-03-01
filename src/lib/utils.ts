import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, formatDistanceToNow, parseISO } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(iso: string): string {
  try {
    return format(parseISO(iso), 'dd MMM yyyy');
  } catch {
    return iso;
  }
}

export function formatDateTime(iso: string): string {
  try {
    return format(parseISO(iso), 'dd MMM, HH:mm');
  } catch {
    return iso;
  }
}

export function formatTimeAgo(iso: string): string {
  try {
    return formatDistanceToNow(parseISO(iso), { addSuffix: true });
  } catch {
    return iso;
  }
}

export function formatTime(iso: string): string {
  try {
    return format(parseISO(iso), 'HH:mm');
  } catch {
    return iso;
  }
}

// Stage labels & colors
export const stageConfig: Record<string, { label: string; color: string; bg: string }> = {
  PRE_ARRIVAL: { label: 'Pre-Arrival', color: '#F0A500', bg: 'rgba(240,165,0,0.12)' },
  CHECKED_IN: { label: 'Checked In', color: '#10B981', bg: 'rgba(16,185,129,0.12)' },
  IN_STAY: { label: 'In Stay', color: '#3B82F6', bg: 'rgba(59,130,246,0.12)' },
  CHECKOUT: { label: 'Checkout', color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' },
  POST_STAY: { label: 'Post-Stay', color: '#A855F7', bg: 'rgba(168,85,247,0.12)' },
  BETWEEN_STAYS: { label: 'Between Stays', color: '#64748B', bg: 'rgba(100,116,139,0.12)' },
};

export const orderStatusConfig: Record<string, { label: string; color: string; bg: string }> = {
  PENDING: { label: 'Pending', color: '#F0A500', bg: 'rgba(240,165,0,0.12)' },
  SENT_TO_POS: { label: 'Sent to POS', color: '#94A3B8', bg: 'rgba(148,163,184,0.12)' },
  CONFIRMED: { label: 'Confirmed', color: '#3B82F6', bg: 'rgba(59,130,246,0.12)' },
  PREPARING: { label: 'Preparing', color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' },
  READY: { label: 'Ready', color: '#10B981', bg: 'rgba(16,185,129,0.12)' },
  IN_TRANSIT: { label: 'In Transit', color: '#6366F1', bg: 'rgba(99,102,241,0.12)' },
  DELIVERED: { label: 'Delivered', color: '#10B981', bg: 'rgba(16,185,129,0.15)' },
  COMPLETED: { label: 'Completed', color: '#64748B', bg: 'rgba(100,116,139,0.12)' },
  CANCELLED: { label: 'Cancelled', color: '#F43F5E', bg: 'rgba(244,63,94,0.12)' },
};

export const serviceStatusConfig: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: 'Pending', color: '#F0A500', bg: 'rgba(240,165,0,0.12)' },
  accepted: { label: 'Accepted', color: '#3B82F6', bg: 'rgba(59,130,246,0.12)' },
  in_progress: { label: 'In Progress', color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' },
  completed: { label: 'Completed', color: '#10B981', bg: 'rgba(16,185,129,0.12)' },
  rejected: { label: 'Rejected', color: '#F43F5E', bg: 'rgba(244,63,94,0.12)' },
};

export function getApiBase(): string {
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
}
