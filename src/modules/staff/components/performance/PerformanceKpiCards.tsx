// src/modules/staff/components/performance/PerformanceKpiCards.tsx
//
// ============================================================================
// PERFORMANCE KPI CARDS — the global card language
// ============================================================================
// Each metric is its own white card on the house surface (rounded-xl, slate
// border, shadow-card) wearing exactly three spots of ONE colour:
//
//   • the figure itself          → tone-600, big bold tabular
//   • the icon chip, top-right   → tone-50 fill, tone-600 icon
//   • a small bar on the bottom  → tone-500, inset from the corners
//
// The label is a quiet uppercase micro-caption, the supporting line stays
// slate-400. Nothing pulses: while the first load is in flight the value
// renders as a static block (never a fake zero) so the row cannot blink or
// jump, and the card height never changes.
// ============================================================================

import { memo, type ReactNode } from "react";

/** Colour families a KPI card can wear (full class strings — Tailwind scans them). */
export type KpiTone = "emerald" | "sky" | "indigo" | "amber" | "violet" | "rose";

const TONE_CLASS: Record<KpiTone, { value: string; chip: string; bar: string }> = {
  emerald: {
    value: "text-emerald-600",
    chip: "border-emerald-100 bg-emerald-50 text-emerald-600",
    bar: "bg-emerald-500",
  },
  sky: {
    value: "text-sky-600",
    chip: "border-sky-100 bg-sky-50 text-sky-600",
    bar: "bg-sky-500",
  },
  indigo: {
    value: "text-indigo-600",
    chip: "border-indigo-100 bg-indigo-50 text-indigo-600",
    bar: "bg-indigo-500",
  },
  amber: {
    value: "text-amber-600",
    chip: "border-amber-100 bg-amber-50 text-amber-600",
    bar: "bg-amber-500",
  },
  violet: {
    value: "text-violet-600",
    chip: "border-violet-100 bg-violet-50 text-violet-600",
    bar: "bg-violet-500",
  },
  rose: {
    value: "text-rose-600",
    chip: "border-rose-100 bg-rose-50 text-rose-600",
    bar: "bg-rose-500",
  },
};

export interface PerformanceKpi {
  /** Already-translated label. */
  label: string;
  /** Pre-formatted value (₹/km/L/% applied by the page). */
  value: string | null;
  /** Already-translated supporting line. */
  sub?: string;
  /** Optional icon, rendered inside the card's soft colour chip. */
  icon?: ReactNode;
  /** Card colour family. Defaults to emerald. */
  tone?: KpiTone;
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
      {kpis.map((kpi) => {
        const tone = TONE_CLASS[kpi.tone ?? "emerald"];
        return (
          <div
            key={kpi.label}
            role="listitem"
            className="relative overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card transition-shadow hover:shadow-card-lg"
          >
            <div className="flex items-start justify-between gap-3 px-4 pb-4 pt-3.5">
              <div className="min-w-0">
                <p className="truncate text-[10.5px] font-bold uppercase tracking-wider text-slate-400">
                  {kpi.label}
                </p>
                {kpi.value == null ? (
                  /* Static placeholder: the card never pulses and keeps its height. */
                  <div className="mt-2 h-[22px] w-20 rounded bg-slate-100" aria-hidden="true" />
                ) : (
                  <p
                    className={`mt-1.5 truncate text-[22px] font-bold leading-none tracking-tight tabular-nums ${tone.value}`}
                  >
                    {kpi.value}
                  </p>
                )}
                {kpi.sub && (
                  <p className="mt-1.5 truncate text-[11px] font-medium text-slate-400">{kpi.sub}</p>
                )}
              </div>
              {kpi.icon && (
                <span
                  aria-hidden="true"
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${tone.chip} [&>svg]:h-[18px] [&>svg]:w-[18px]`}
                >
                  {kpi.icon}
                </span>
              )}
            </div>
            {/* The card's colour, as a small bar along the bottom edge. */}
            <span
              aria-hidden="true"
              className={`absolute inset-x-3 bottom-0 h-1 rounded-full ${tone.bar}`}
            />
          </div>
        );
      })}
    </div>
  );
}

const PerformanceKpiCards = memo(PerformanceKpiCardsImpl);
export default PerformanceKpiCards;
