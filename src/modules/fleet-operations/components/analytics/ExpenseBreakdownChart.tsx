// src/modules/fleet-operations/components/analytics/ExpenseBreakdownChart.tsx
// ---------------------------------------------------------------------------
// Cost Analysis — styled after the dashboard's Collection Performance chart:
// compact summary tiles up top, then a ranked list of expense categories,
// each row carrying a number chip, a share ring, the amount line and a
// category pill. Ring, tiles and pills all read from the same items slice,
// so every figure on the card stays in perfect sync with the data.
// ---------------------------------------------------------------------------
import { memo, useMemo } from 'react';
import { formatCurrencyCompact } from '../../utils/formatters';
import ShareRing from './ShareRing';

interface ExpenseData {
  name: string;
  value: number;
}

interface ExpenseBreakdownChartProps {
  data: ExpenseData[];
  height?: number;
}

const SUPPORTED_CATEGORIES = ['Fuel', 'Maintenance', 'Other'];

interface CategoryTone {
  ring: string;
  chip: string;
  pill: string;
  tile: string;
}

const TONE_BY_CATEGORY: Record<string, CategoryTone> = {
  Fuel: {
    ring: '#2563eb',
    chip: 'bg-blue-50 text-blue-700 ring-blue-100',
    pill: 'bg-blue-50 text-blue-700 ring-blue-100',
    tile: 'border-blue-200 bg-blue-50/70 text-blue-700',
  },
  Maintenance: {
    ring: '#f59e0b',
    chip: 'bg-amber-50 text-amber-700 ring-amber-100',
    pill: 'bg-amber-50 text-amber-700 ring-amber-100',
    tile: 'border-amber-200 bg-amber-50/70 text-amber-700',
  },
  Other: {
    ring: '#64748b',
    chip: 'bg-slate-100 text-slate-600 ring-slate-200',
    pill: 'bg-slate-100 text-slate-600 ring-slate-200',
    tile: 'border-slate-200 bg-slate-50/80 text-slate-700',
  },
};

const FALLBACK_TONE: CategoryTone = TONE_BY_CATEGORY.Other;

const ExpenseBreakdownChart = ({ data, height = 320 }: ExpenseBreakdownChartProps) => {
  const items = useMemo(() => {
    if (!Array.isArray(data)) return [];
    return data
      .filter((item) => Number(item.value) > 0 && SUPPORTED_CATEGORIES.includes(item.name))
      .map((item) => ({ ...item, value: Number(item.value) }))
      .sort(
        (a, b) =>
          b.value - a.value ||
          SUPPORTED_CATEGORIES.indexOf(a.name) - SUPPORTED_CATEGORIES.indexOf(b.name)
      );
  }, [data]);

  const total = useMemo(() => items.reduce((sum, item) => sum + item.value, 0), [items]);

  if (items.length === 0 || total <= 0) {
    return (
      <div
        style={{ minHeight: `${height / 16}rem` }}
        className="flex h-full items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 text-sm font-medium text-slate-400"
      >
        No expense data for the selected filters.
      </div>
    );
  }

  const rows = items.map((item) => ({
    ...item,
    percentage: (item.value / total) * 100,
    tone: TONE_BY_CATEGORY[item.name] ?? FALLBACK_TONE,
  }));

  return (
    <div className="flex h-full w-full flex-col" style={{ minHeight: `${height / 16}rem` }}>
      <div className="grid grid-cols-3 gap-1.5">
        {rows.map((row) => (
          <div
            key={row.name}
            className={`min-w-0 rounded-lg border px-2 py-1 text-center ${row.tone.tile}`}
          >
            <span className="block truncate text-[8.5px] font-black uppercase tracking-wide opacity-60">
              {row.name}
            </span>
            <strong
              className="block truncate text-[12.5px] font-black tabular-nums"
              title={`${row.name}: ${formatCurrencyCompact(row.value)} · ${row.percentage.toFixed(1)}%`}
            >
              {formatCurrencyCompact(row.value)}
            </strong>
          </div>
        ))}
      </div>

      <div className="mt-2 space-y-1.5">
        {rows.map((row, index) => (
          <article
            key={row.name}
            className="share-card-in group relative min-w-0 rounded-xl border border-slate-100 bg-gradient-to-r from-white to-slate-50/60 px-2.5 py-1.5 shadow-xs transition-colors duration-150 hover:from-slate-50/70 hover:to-white"
            style={{ animationDelay: `${index * 80}ms` }}
            title={`${row.name}: ${formatCurrencyCompact(row.value)} of ${formatCurrencyCompact(total)} (${row.percentage.toFixed(1)}%)`}
          >
            <div className="grid min-w-0 grid-cols-[1.35rem_3.65rem_minmax(0,1fr)_auto] items-center gap-1.5">
              <span
                className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full text-[9.5px] font-black tabular-nums ring-1 ring-inset ${row.tone.chip}`}
              >
                {index + 1}
              </span>
              <ShareRing value={row.percentage} color={row.tone.ring} />
              <div className="min-w-0">
                <p className="truncate text-[12.5px] font-medium leading-tight text-slate-700 transition-colors group-hover:text-slate-900">
                  {row.name}
                </p>
                <p className="mt-0.5 truncate text-[10px] font-semibold tabular-nums text-slate-500">
                  {formatCurrencyCompact(row.value)} of {formatCurrencyCompact(total)}
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full px-1.5 py-1 text-[10.5px] font-black tabular-nums ring-1 ring-inset ${row.tone.pill}`}
              >
                {formatCurrencyCompact(row.value)}
              </span>
            </div>
          </article>
        ))}
      </div>

      <div className="mt-auto flex items-center justify-between rounded-lg bg-slate-50 px-2.5 py-1.5 ring-1 ring-inset ring-slate-100">
        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
          Total Cost
        </span>
        <strong className="text-[13px] font-black tabular-nums text-slate-900">
          {formatCurrencyCompact(total)}
        </strong>
      </div>
    </div>
  );
};

export default memo(ExpenseBreakdownChart);
