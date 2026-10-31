import React, { useState, type FocusEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { LucideIcon } from "lucide-react";

export type KpiTone = "blue" | "amber" | "emerald" | "violet" | "rose" | "cyan";

export interface KpiCardItem {
  id: string;
  label: string;
  value: ReactNode;
  /** Full, unshortened metric displayed when the operator hovers the card. */
  tooltip?: string;
  /** Rich breakdown shown in the same fixed, unclipped style as table KPIs. */
  tooltipContent?: ReactNode;
  Icon: LucideIcon;
  tone: KpiTone;
}

export type CompactKpiValue = {
  /** Visible, compact Indian-number figure (for example `2.18`). */
  compact: string;
  /** `L` at one lakh and `Cr` at one crore; blank below one lakh. */
  suffix: "" | "L" | "Cr";
  /** Exact Indian-formatted value for the card tooltip. */
  exact: string;
};

/**
 * Formats an operational KPI in Indian units. The full figure remains
 * available as `exact`, while values from 1,00,000 upward stay compact:
 * `2,18,000` → `2.18 L`, `2,19,00,000` → `2.19 Cr`.
 */
export function compactKpiValue(value: number, fractionDigits = 0): CompactKpiValue {
  const safeValue = Number.isFinite(value) ? value : 0;
  const exact = new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(safeValue);
  const absolute = Math.abs(safeValue);
  if (absolute >= 10_000_000) {
    return { compact: (safeValue / 10_000_000).toFixed(2), suffix: "Cr", exact };
  }
  if (absolute >= 100_000) {
    return { compact: (safeValue / 100_000).toFixed(2), suffix: "L", exact };
  }
  return { compact: exact, suffix: "", exact };
}

/** Renders a compact KPI value while keeping its unit visually secondary. */
export function KpiMetricValue({
  metric,
  prefix = "",
  unit,
}: {
  metric: CompactKpiValue;
  prefix?: string;
  unit?: string;
}) {
  return (
    <>
      {prefix}{metric.compact}
      {metric.suffix ? <span className="ml-1 text-[11px] font-bold tracking-normal">{metric.suffix}</span> : null}
      {unit ? <span className="ml-1 text-[11px] font-bold tracking-normal">{unit}</span> : null}
    </>
  );
}

interface Props {
  /** KPI content in the operational order appropriate to the source page. */
  items: readonly KpiCardItem[];
  /** Static Tailwind grid classes, for example `lg:grid-cols-5`. */
  gridClassName?: string;
  ariaLabel?: string;
  /**
   * Card size. `default` is the Trip List surface; `compact` is a tighter
   * card (used where the strip would otherwise dominate the page or a popup)
   * that keeps the same tone, icon tile and accent bar.
   */
  density?: "default" | "compact";
}

/** Per-density card, label, value, icon-tile, glow and accent classes. */
const densityClasses = {
  default: {
    card: "min-h-[6.75rem] rounded-2xl p-4",
    label: "text-[11px]",
    value: "mt-2 text-2xl",
    iconTile: "h-11 w-11 rounded-xl",
    iconSize: 22,
    glow: "-right-7 -top-7 h-24 w-24",
    accent: "h-1",
    grid: "gap-3",
  },
  compact: {
    card: "min-h-[5.25rem] rounded-xl px-3.5 py-3",
    label: "text-[10px]",
    value: "mt-1.5 text-lg",
    iconTile: "h-8 w-8 rounded-lg",
    iconSize: 16,
    glow: "-right-5 -top-5 h-16 w-16",
    accent: "h-[0.1875rem]",
    grid: "gap-2.5",
  },
} as const;

const toneClasses: Record<KpiTone, { value: string; icon: string; glow: string; accent: string }> = {
  blue: {
    value: "text-blue-600",
    icon: "border-blue-100 bg-blue-50 text-blue-500 shadow-blue-100/60",
    glow: "bg-blue-50",
    accent: "bg-blue-300",
  },
  amber: {
    value: "text-amber-600",
    icon: "border-amber-100 bg-amber-50 text-amber-500 shadow-amber-100/60",
    glow: "bg-amber-50",
    accent: "bg-amber-300",
  },
  emerald: {
    value: "text-emerald-600",
    icon: "border-emerald-100 bg-emerald-50 text-emerald-500 shadow-emerald-100/60",
    glow: "bg-emerald-50",
    accent: "bg-emerald-300",
  },
  violet: {
    value: "text-violet-600",
    icon: "border-violet-100 bg-violet-50 text-violet-500 shadow-violet-100/60",
    glow: "bg-violet-50",
    accent: "bg-violet-300",
  },
  rose: {
    value: "text-rose-600",
    icon: "border-rose-100 bg-rose-50 text-rose-500 shadow-rose-100/60",
    glow: "bg-rose-50",
    accent: "bg-rose-300",
  },
  cyan: {
    value: "text-cyan-600",
    icon: "border-cyan-100 bg-cyan-50 text-cyan-500 shadow-cyan-100/60",
    glow: "bg-cyan-50",
    accent: "bg-cyan-300",
  },
};

function KpiCard({ item, density }: { item: KpiCardItem; density: keyof typeof densityClasses }) {
  const { id, label, value, tooltip, tooltipContent, Icon, tone } = item;
  const dense = densityClasses[density];
  const classes = toneClasses[tone];
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);

  const showTooltip = (target: HTMLElement) => {
    if (!tooltipContent) return;
    const rect = target.getBoundingClientRect();
    const width = 260;
    const left = Math.min(window.innerWidth - width - 12, Math.max(12, rect.left + rect.width / 2 - width / 2));
    setPosition({ left, top: Math.min(window.innerHeight - 12, rect.bottom + 8) });
  };

  const handleFocus = (event: FocusEvent<HTMLDivElement>) => showTooltip(event.currentTarget);

  return (
    <div
      key={id}
      title={tooltipContent ? undefined : tooltip}
      tabIndex={tooltipContent ? 0 : undefined}
      onPointerEnter={(event) => showTooltip(event.currentTarget)}
      onPointerLeave={() => setPosition(null)}
      onFocus={handleFocus}
      onBlur={() => setPosition(null)}
      className={`group relative isolate overflow-hidden border border-slate-200/80 bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 ${dense.card} ${tooltip || tooltipContent ? "cursor-help" : ""}`}
    >
      <span className={`pointer-events-none absolute rounded-full ${dense.glow} ${classes.glow}`} aria-hidden="true" />
      <span className={`absolute inset-x-0 bottom-0 ${dense.accent} ${classes.accent}`} aria-hidden="true" />
      <div className="relative flex h-full items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={`font-bold uppercase tracking-wide text-slate-500 ${dense.label}`}>{label}</p>
          <p className={`font-extrabold leading-none tracking-tight tabular-nums ${dense.value} ${classes.value}`}>{value}</p>
        </div>
        <span className={`inline-flex shrink-0 items-center justify-center border shadow-sm transition-transform duration-200 group-hover:scale-105 ${dense.iconTile} ${classes.icon}`} aria-hidden="true">
          <Icon size={dense.iconSize} strokeWidth={2.25} />
        </span>
      </div>
      {tooltipContent && position ? createPortal(
        <div role="tooltip" style={position} className="pointer-events-none fixed z-[9999] w-[260px] rounded-xl border border-slate-200 bg-white p-3 text-left text-[11px] font-medium text-slate-700 shadow-2xl">
          {tooltipContent}
        </div>,
        document.body,
      ) : null}
    </div>
  );
}

/**
 * Shared KPI display surface for operational pages. It intentionally uses
 * restrained pastel tones, readable values, and recognisable icon tiles rather
 * than dark or visually heavy cards.
 */
export function KpiCardGrid({ items, gridClassName = "", ariaLabel, density = "default" }: Props) {
  const dense = densityClasses[density];
  return (
    <section
      className={`grid grid-cols-2 sm:grid-cols-3 ${dense.grid} ${gridClassName}`}
      aria-label={ariaLabel}
      aria-live="polite"
    >
      {items.map((item) => <KpiCard key={item.id} item={item} density={density} />)}
    </section>
  );
}

export default React.memo(KpiCardGrid);
