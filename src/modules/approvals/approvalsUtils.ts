// Display helpers shared by every Approval Center table / card.
import type { MaintenanceEvent } from '../fleet-operations/types';

export const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export const inr2 = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const kg = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });

/** "12 Sep 2026" from a YYYY-MM-DD or ISO value, without timezone drift. */
export function dateLabel(value?: string | null): string {
  if (!value) return '—';
  const day = new Date(value);
  if (Number.isNaN(day.getTime())) return value.slice(0, 10);
  return day.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function dateTimeLabel(value?: string | null): string {
  if (!value) return '—';
  const day = new Date(value);
  if (Number.isNaN(day.getTime())) return dateLabel(value);
  return day.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export interface WaitingAge {
  label: string;
  days: number;
  /** slate = fresh · amber = ageing · rose = overdue-for-approval */
  tone: 'slate' | 'amber' | 'rose';
}

/** How long a record has been waiting for a decision. */
export function waitingAge(createdAtIso?: string | null): WaitingAge {
  if (!createdAtIso) return { label: '—', days: 0, tone: 'slate' };
  const from = new Date(createdAtIso);
  if (Number.isNaN(from.getTime())) return { label: '—', days: 0, tone: 'slate' };
  const ms = Date.now() - from.getTime();
  const days = Math.max(0, Math.floor(ms / 86_400_000));
  const label = days === 0 ? 'Today' : days === 1 ? '1 day' : `${days} days`;
  const tone: WaitingAge['tone'] = days >= 7 ? 'rose' : days >= 3 ? 'amber' : 'slate';
  return { label, days, tone };
}

export const waitingToneClass: Record<WaitingAge['tone'], string> = {
  slate: 'bg-slate-100 text-slate-600 ring-slate-200',
  amber: 'bg-amber-50 text-amber-700 ring-amber-200',
  rose: 'bg-rose-50 text-rose-700 ring-rose-200',
};

/** Compact "3 parts · labour included" summary for the bill-rate column. */
export function partsSummary(record: MaintenanceEvent): {
  line: string;
  top?: { name: string; qty: number; rate: number; amount: number };
} {
  const parts = Array.isArray(record.parts) ? record.parts : [];
  if (parts.length === 0) return { line: 'Labour only' };
  const priced = [...parts].sort((a, b) => (Number(b.amount) || 0) - (Number(a.amount) || 0));
  return {
    line: `${parts.length} ${parts.length === 1 ? 'line' : 'lines'}`,
    top: priced[0]
      ? {
          name: priced[0].name,
          qty: Number(priced[0].quantity) || 1,
          rate: Number(priced[0].rate) || 0,
          amount: Number(priced[0].amount) || 0,
        }
      : undefined,
  };
}

/** Sum of part lines vs total bill — exposes unallocated labour/other charges. */
export function partsLineTotal(record: MaintenanceEvent): number {
  return (Array.isArray(record.parts) ? record.parts : []).reduce(
    (sum, part) => sum + (Number(part.amount) || 0),
    0
  );
}
