// src/modules/fleet-operations/components/analytics/ExpenseBreakdownChart.tsx
// ---------------------------------------------------------------------------
// Cost Analysis — styled after the dashboard's Collection Performance chart:
// compact summary tiles up top, then a ranked list of expense categories,
// each row carrying a number chip, a share ring, the amount line and a
// category pill. Ring, tiles and pills all read from the same items slice,
// so every figure on the card stays in perfect sync with the data.
// ---------------------------------------------------------------------------
import { memo, useMemo, type CSSProperties } from 'react';
import { formatCurrencyCompact } from '../../utils/formatters';

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

const EXPENSE_BREAKDOWN_ANIMATION_STYLES = `
@keyframes expense-share-card-in {
  0% { opacity: 0; transform: translateY(14px) scale(0.965); }
  55% { opacity: 1; transform: translateY(2px) scale(1.01); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes expense-ring-draw {
  from { stroke-dashoffset: var(--expense-ring-circumference); }
  to { stroke-dashoffset: var(--expense-ring-dashoffset); }
}
.expense-share-card {
  animation: expense-share-card-in 760ms cubic-bezier(0.16, 1, 0.3, 1) both;
}
.expense-ring-progress {
  animation: expense-ring-draw 1250ms cubic-bezier(0.16, 1, 0.3, 1) both;
}
@media (prefers-reduced-motion: reduce) {
  .expense-share-card,
  .expense-ring-progress {
    animation: none !important;
  }
}
`;

function ShareRing({ value, color, size = 56 }: { value: number; color: string; size?: number }) {
  const pct = Math.min(100, Math.max(0, Number.isFinite(value) ? value : 0));
  const radius = 20.4;
  const strokeWidth = 4.1;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - pct / 100);
  const roundedPct = Math.round(pct);
  const isWidePercent = roundedPct >= 100;
  const numberFontSize = Math.max(12, Math.round(size * (isWidePercent ? 0.25 : 0.31) * 10) / 10);
  const percentFontSize = Math.max(8.5, Math.round(size * (isWidePercent ? 0.16 : 0.2) * 10) / 10);
  const progressStyle = {
    strokeDasharray: circumference,
    strokeDashoffset: dashOffset,
    '--expense-ring-circumference': circumference,
    '--expense-ring-dashoffset': dashOffset,
  } as CSSProperties;

  return (
    <span
      className="relative grid shrink-0 place-items-center rounded-full bg-white shadow-sm ring-1 ring-inset ring-slate-200/80"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <svg className="absolute inset-0" viewBox="0 0 48 48">
        <circle cx="24" cy="24" r={radius} fill="none" stroke="#e2e8f0" strokeWidth={strokeWidth} />
        <circle
          cx="24"
          cy="24"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap={pct >= 99.5 ? 'butt' : 'round'}
          className="expense-ring-progress"
          style={progressStyle}
          transform="rotate(-90 24 24)"
        />
      </svg>
      <span className="expense-ring-value relative flex max-w-[78%] items-center justify-center overflow-visible whitespace-nowrap font-black leading-none tabular-nums tracking-[-0.08em] text-slate-800">
        <span style={{ fontSize: numberFontSize, lineHeight: 1 }}>{roundedPct}</span>
        <span className="ml-px tracking-normal" style={{ fontSize: percentFontSize, lineHeight: 1 }}>
          %
        </span>
      </span>
    </span>
  );
}

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
      <style>{EXPENSE_BREAKDOWN_ANIMATION_STYLES}</style>

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
            className="expense-share-card group relative min-w-0 rounded-xl border border-slate-100 bg-gradient-to-r from-white to-slate-50/60 px-2.5 py-1.5 shadow-xs transition-colors duration-150 hover:from-slate-50/70 hover:to-white"
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
