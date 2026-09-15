// src/modules/staff/components/performance/PerformanceKpiCards.tsx
//
// ============================================================================
// PERFORMANCE KPI CARDS — the Trip List card, one per metric
// ============================================================================
// Same visual language as the Trip List strip (TripKPICards): a tinted card per
// metric, 12px medium slate label, 18px bold tone-coloured value and the icon
// in a round 40px tinted bubble on the right. Kept deliberately plain — no
// shadows competing with the numbers, no animation: while the first load is in
// flight the value renders as a static block (never a fake zero) so the row
// never blinks or jumps when the data lands.
// ============================================================================

import { memo, type ReactNode } from "react";

/** Tint family for a card — identical palette to the Trip List KPI cards. */
export type PerformanceKpiTone =
  | "blue"
  | "green"
  | "purple"
  | "orange"
  | "rose"
  | "sky";

const TONES: Record<PerformanceKpiTone, { card: string; icon: string; value: string }> = {
  blue: { card: "bg-blue-50/70", icon: "bg-blue-50/80", value: "text-blue-500" },
  green: { card: "bg-green-50/70", icon: "bg-green-50/80", value: "text-green-500" },
  purple: { card: "bg-purple-50/70", icon: "bg-purple-50/80", value: "text-purple-500" },
  orange: { card: "bg-orange-50/70", icon: "bg-orange-50/80", value: "text-orange-500" },
  rose: { card: "bg-rose-50/70", icon: "bg-rose-50/80", value: "text-rose-500" },
  sky: { card: "bg-sky-50/70", icon: "bg-sky-50/80", value: "text-sky-500" },
};

/** Tone used when a caller does not pick one — the Trip List order. */
const TONE_ORDER: PerformanceKpiTone[] = ["blue", "green", "purple", "orange", "rose"];

export interface PerformanceKpi {
  /** Already-translated label. */
  label: string;
  /** Pre-formatted value (₹/km/L/% applied by the page). */
  value: string | null;
  /** Already-translated supporting line. */
  sub?: string;
  /** Optional icon, rendered inside the card's round tinted bubble. */
  icon?: ReactNode;
  /** Tint family; defaults to the Trip List order. */
  tone?: PerformanceKpiTone;
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
    /* `role="list"` keeps the row announceable exactly as before. */
    <div className={`grid ${gridCols} gap-3`} role="list" aria-label="KPIs">
      {kpis.map((kpi, index) => {
        const tone = TONES[kpi.tone ?? TONE_ORDER[index % TONE_ORDER.length]];
        return (
          <div
            key={kpi.label}
            role="listitem"
            className={`${tone.card} flex items-center justify-between rounded-lg border border-slate-200 px-3 py-3 transition-all hover:shadow-sm`}
          >
            <div className="min-w-0">
              <div className="text-xs font-medium text-slate-500">{kpi.label}</div>
              {/* Missing value → a static block: the card never pulses, and the
                  row keeps its height while the numbers arrive. */}
              {kpi.value == null ? (
                <div
                  className="mt-1 h-[22px] w-20 rounded bg-white/70"
                  aria-hidden="true"
                />
              ) : (
                <div className={`mt-0.5 truncate text-lg font-bold ${tone.value}`}>
                  {kpi.value}
                </div>
              )}
              {kpi.sub && (
                <div className="mt-0.5 truncate text-[11px] font-medium text-slate-500/90">
                  {kpi.sub}
                </div>
              )}
            </div>
            {kpi.icon && (
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${tone.icon} ${tone.value} [&>svg]:h-5 [&>svg]:w-5`}
                aria-hidden="true"
              >
                {kpi.icon}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

const PerformanceKpiCards = memo(PerformanceKpiCardsImpl);
export default PerformanceKpiCards;
