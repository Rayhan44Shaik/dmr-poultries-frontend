// src/modules/staff/components/performance/PerformanceKpiCards.tsx
//
// ============================================================================
// PERFORMANCE KPI STRIP — one quiet card for the whole metric row
// ============================================================================
// Design (deliberately simple): a single bordered card subdivided by hairline
// rules — no per-metric boxes, icon chips or shadows competing with the
// numbers. Each cell: tiny uppercase label (with an optional muted icon),
// one bold tabular-numeral value, one muted supporting line. While the
// initial load is in flight the value renders as a skeleton — never a fake
// zero — and cell dimensions are fixed so nothing jumps when data arrives.
// ============================================================================

import { memo, type ReactNode } from "react";
import { uiSkeletonClass } from "../../../../shared/ui/uiTokens";

export interface PerformanceKpi {
  /** Already-translated label. */
  label: string;
  /** Pre-formatted value (₹/km/L/% applied by the page). */
  value: string | null;
  /** Already-translated supporting line. */
  sub?: string;
  /** Optional small muted icon, rendered inline before the label. */
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
      ? "grid-cols-2 md:grid-cols-3 xl:grid-cols-5"
      : "grid-cols-2 md:grid-cols-4";
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
      <div className={`grid ${gridCols} gap-px bg-slate-100`} role="list" aria-label="KPIs">
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            role="listitem"
            className="min-w-0 bg-white px-4 py-3"
          >
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              {kpi.icon && (
                <span className="shrink-0 text-slate-300 [&>svg]:h-3.5 [&>svg]:w-3.5" aria-hidden="true">
                  {kpi.icon}
                </span>
              )}
              <span className="truncate">{kpi.label}</span>
            </div>
            {kpi.value == null ? (
              <div className={`mt-1.5 h-7 w-24 ${uiSkeletonClass}`} aria-hidden="true" />
            ) : (
              <div className="mt-1.5 truncate text-[22px] font-bold leading-7 tabular-nums text-slate-900">
                {kpi.value}
              </div>
            )}
            {kpi.sub && (
              <div className="mt-0.5 truncate text-[11px] text-slate-400">{kpi.sub}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

const PerformanceKpiCards = memo(PerformanceKpiCardsImpl);
export default PerformanceKpiCards;
