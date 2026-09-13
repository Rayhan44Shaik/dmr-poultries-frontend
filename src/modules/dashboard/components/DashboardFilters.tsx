import React from 'react';
import { CalendarDays, Calendar, ChartPie, CalendarRange, GitCompareArrows } from 'lucide-react';
import { useI18n } from '../../../i18n';
import { uiTransition, uiFocusRing } from '../../../shared/ui/uiTokens';

export type PeriodId = 'week' | 'month' | 'quarter' | 'custom';

const PERIOD_TABS = [
  { id: 'week',    labelKey: 'accounts.summary.period.this_week',   icon: CalendarDays,  dot: 'bg-sky-500',    text: 'text-sky-600 dark:text-sky-400' },
  { id: 'month',   labelKey: 'accounts.summary.period.month',       icon: Calendar,      dot: 'bg-indigo-500', text: 'text-indigo-600 dark:text-indigo-400' },
  { id: 'quarter', labelKey: 'accounts.summary.period.quarter',     icon: ChartPie,      dot: 'bg-violet-500', text: 'text-violet-600 dark:text-violet-400' },
  { id: 'custom',  labelKey: 'accounts.summary.period.custom_range', icon: CalendarRange, dot: 'bg-teal-500',   text: 'text-teal-600 dark:text-teal-400' },
] as const;

interface DashboardFiltersProps {
  period: PeriodId;
  setPeriod: (period: PeriodId) => void;
  comparePrevious: boolean;
  setComparePrevious: (val: boolean) => void;
  customStart: string;
  setCustomStart: (val: string) => void;
  customEnd: string;
  setCustomEnd: (val: string) => void;
}

export function DashboardFilters({
  period,
  setPeriod,
  comparePrevious,
  setComparePrevious,
  customStart,
  setCustomStart,
  customEnd,
  setCustomEnd,
}: DashboardFiltersProps) {
  const { t } = useI18n();

  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="flex rounded-xl bg-slate-200/50 p-1 dark:bg-slate-800/50">
        {PERIOD_TABS.map((tab) => {
          const active = period === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setPeriod(tab.id as PeriodId)}
              className={[
                'group inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold outline-none',
                uiTransition,
                uiFocusRing,
                active
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-white hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-slate-50',
              ].join(' ')}
            >
              <span
                aria-hidden="true"
                className={`h-2 w-2 shrink-0 rounded-full ${tab.dot}${active ? ' ring-2 ring-white/70' : ''}`}
              />
              <Icon
                size={14}
                strokeWidth={2}
                className={active ? 'text-white' : `${tab.text} opacity-70 group-hover:opacity-100`}
              />
              <span>{t(tab.labelKey)}</span>
            </button>
          );
        })}
      </div>

      {period === 'custom' && (
        <div className="flex items-center gap-2">
          <input
            type="date"
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
            value={customStart}
            onChange={(e) => setCustomStart(e.target.value)}
          />
          <span className="text-slate-500">-</span>
          <input
            type="date"
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
            value={customEnd}
            onChange={(e) => setCustomEnd(e.target.value)}
          />
        </div>
      )}

      <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 cursor-pointer group">
        <input 
          type="checkbox" 
          className="sr-only" 
          checked={comparePrevious} 
          onChange={(e) => setComparePrevious(e.target.checked)} 
        />
        <div className={`flex h-5 w-8 items-center rounded-full p-0.5 transition-colors ${comparePrevious ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`}>
          <div className={`h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${comparePrevious ? 'translate-x-3' : 'translate-x-0'}`} />
        </div>
        <GitCompareArrows size={16} className={comparePrevious ? 'text-emerald-600' : 'text-slate-400 group-hover:text-slate-600'} />
        {t('accounts.summary.compare_previous')}
      </label>
    </div>
  );
}
