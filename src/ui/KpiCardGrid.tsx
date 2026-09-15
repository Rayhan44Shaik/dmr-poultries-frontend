import React, { type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export type KpiTone = "blue" | "amber" | "emerald" | "violet" | "rose" | "cyan";

export interface KpiCardItem {
  id: string;
  label: string;
  value: ReactNode;
  Icon: LucideIcon;
  tone: KpiTone;
}

interface Props {
  /** KPI content in the operational order appropriate to the source page. */
  items: readonly KpiCardItem[];
  /** Static Tailwind grid classes, for example `lg:grid-cols-5`. */
  gridClassName?: string;
  ariaLabel?: string;
}

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

/**
 * Shared KPI display surface for operational pages. It intentionally uses
 * restrained pastel tones, readable values, and recognisable icon tiles rather
 * than dark or visually heavy cards.
 */
export function KpiCardGrid({ items, gridClassName = "", ariaLabel }: Props) {
  return (
    <section
      className={`grid grid-cols-2 gap-3 sm:grid-cols-3 ${gridClassName}`}
      aria-label={ariaLabel}
      aria-live="polite"
    >
      {items.map(({ id, label, value, Icon, tone }) => {
        const classes = toneClasses[tone];
        return (
          <div
            key={id}
            className="group relative isolate min-h-[108px] overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
          >
            <span className={`pointer-events-none absolute -right-7 -top-7 h-24 w-24 rounded-full ${classes.glow}`} aria-hidden="true" />
            <span className={`absolute inset-x-0 bottom-0 h-1 ${classes.accent}`} aria-hidden="true" />
            <div className="relative flex h-full items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
                <p className={`mt-2 text-2xl font-extrabold leading-none tracking-tight tabular-nums ${classes.value}`}>
                  {value}
                </p>
              </div>
              <span
                className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border shadow-sm transition-transform duration-200 group-hover:scale-105 ${classes.icon}`}
                aria-hidden="true"
              >
                <Icon size={22} strokeWidth={2.25} />
              </span>
            </div>
          </div>
        );
      })}
    </section>
  );
}

export default React.memo(KpiCardGrid);
