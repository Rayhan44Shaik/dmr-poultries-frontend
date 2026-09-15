// src/modules/staff/components/performance/PerformanceKpiCards.tsx
//
// ============================================================================
// PERFORMANCE KPI CARDS — the global card language: white, one green accent
// ============================================================================
// Each metric is its own white card on the house surface (`uiCardClass`:
// rounded-xl, slate-200 border, shadow-card) with exactly ONE hint of colour —
// a small light-green bar on the leading edge — plus the icon in a soft
// emerald chip. The number itself stays slate-900 so it reads as data, not
// decoration: white card, green accent, quiet grey label, big clear figure.
//
// While the first load is in flight the value renders as a static block (never
// a fake zero, never a pulse) so the row cannot blink or jump.
// ============================================================================

import { memo, type ReactNode } from "react";

export interface PerformanceKpi {
  /** Already-translated label. */
  label: string;
  /** Pre-formatted value (₹/km/L/% applied by the page). */
  value: string | null;
  /** Already-translated supporting line. */
  sub?: string;
  /** Optional icon, rendered inside the card's soft emerald chip. */
  icon?: ReactNode;
}

function PerformanceKpiCardsImpl({
  kpis,
  columns = 5,
}: {
  kpis: readonly PerformanceKpi[];
  columns?: 4 | 5;
}) {
  const gridCols =
    columns === 5
      ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"
      : "grid-cols-2 sm:grid-cols-4";
  return (
    <div className={`grid ${gridCols} gap-3`} role="list" aria-label="KPIs">
      {kpis.map((kpi) => (
        <div
          key={kpi.label}
          role="listitem"
          className="relative flex items-center justify-between gap-3 overflow-hidden rounded-xl border border-slate-200 bg-white px-4 py-3.5 shadow-card transition-shadow hover:shadow-card-lg"
        >
          {/* The single spot of colour: a small light-green bar on the edge. */}
          <span
            aria-hidden="true"
            className="absolute inset-y-2.5 left-0 w-[3px] rounded-r-full bg-emerald-400/80"
          />
          <div className="min-w-0 pl-1.5">
            <p className="truncate text-[12px] font-medium text-slate-500">{kpi.label}</p>
            {kpi.value == null ? (
              /* Static placeholder: the card never pulses and keeps its height. */
              <div className="mt-1.5 h-[24px] w-20 rounded bg-slate-100" aria-hidden="true" />
            ) : (
              <p className="mt-1 truncate text-[21px] font-bold leading-tight tracking-tight tabular-nums text-slate-900">
                {kpi.value}
              </p>
            )}
            {kpi.sub && (
              <p className="mt-0.5 truncate text-[11px] font-medium text-slate-400">{kpi.sub}</p>
            )}
          </div>
          {kpi.icon && (
            <span
              aria-hidden="true"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 [&>svg]:h-[18px] [&>svg]:w-[18px]"
            >
              {kpi.icon}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

const PerformanceKpiCards = memo(PerformanceKpiCardsImpl);
export default PerformanceKpiCards;
