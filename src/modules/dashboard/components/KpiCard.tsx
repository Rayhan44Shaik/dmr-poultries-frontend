// src/modules/dashboard/components/KpiCard.tsx
// Premium KPI card: value, comparison, trend chip, sparkline, tinted icon.

import { memo } from "react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import type { KpiDatum } from "../utils/dashboardDerive";

const toneClasses: Record<KpiDatum["tone"], { icon: string; spark: string }> = {
  brand: { icon: "bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400", spark: "#059669" },
  sky: { icon: "bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400", spark: "#0ea5e9" },
  amber: { icon: "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400", spark: "#d97706" },
  rose: { icon: "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400", spark: "#e11d48" },
  violet: { icon: "bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400", spark: "#7c3aed" },
  slate: { icon: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300", spark: "#64748b" },
};

interface KpiCardProps {
  kpi: KpiDatum;
  index?: number;
}

function KpiCard({ kpi, index = 0 }: KpiCardProps) {
  const tone = toneClasses[kpi.tone];
  const Icon = kpi.icon;
  const hasSpark = kpi.spark.some((p) => p.y > 0);

  return (
    /* ALL EIGHT ON ONE LINE, no sideways dragging: the row is an 8-column grid
       (see DashboardPage), so each card owns 1/8 of the page width. To keep
       every detail legible in that share the card is taller and degrades
       gracefully instead of clipping:
         · it measures itself (`@container`) and steps up at 100px of content —
           24px→28px icon, 10.5px→11.5px label, 17px→20px value, 9.5px→10.5px
           chip and sub line;
         · the label wraps onto a second line rather than truncating;
         · the delta chip drops under the value (`flex-wrap`) when the two would
           not sit side by side.
       Padding stays p-3 at every tier on purpose: container queries read the
       content-box width, so tiering the padding would move the measurement. */
    <div
      className="@container group relative flex h-full min-h-[112px] min-w-0 flex-col overflow-hidden rounded-xl border border-slate-200/80 bg-white p-3 shadow-card transition-all duration-200 hover:-translate-y-px hover:border-slate-300/80 hover:shadow-card-lg animate-fade-in-up dark:border-slate-800 dark:bg-slate-900"
      style={{ animationDelay: `${Math.min(index * 40, 320)}ms` }}
    >
      <div className={`flex min-w-0 flex-1 flex-col ${hasSpark ? "pb-6" : ""}`}>
        <div className="flex min-w-0 items-start justify-between gap-1">
          <p
            className="min-w-0 text-[10.5px] leading-snug font-medium break-words text-slate-500 @min-[100px]:text-[11.5px] dark:text-slate-400"
            title={kpi.label}
          >
            {kpi.label}
          </p>
          <span
            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg @min-[100px]:h-7 @min-[100px]:w-7 ${tone.icon}`}
          >
            <Icon size={13} className="h-[13px] w-[13px] @min-[100px]:h-3.5 @min-[100px]:w-3.5" />
          </span>
        </div>

        <div className="mt-1.5 flex flex-wrap items-end justify-between gap-x-1.5 gap-y-1">
          <p
            className="min-w-0 truncate text-[17px] font-bold leading-tight tracking-tight text-slate-900 tabular-nums @min-[100px]:text-[20px] dark:text-white"
            title={kpi.value}
          >
            {kpi.value}
          </p>
          {kpi.delta != null && (
            <span
              className={`flex shrink-0 items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[9.5px] font-semibold tabular-nums @min-[100px]:text-[10.5px] ${
                kpi.trend === "up"
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
                  : kpi.trend === "down"
                  ? "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400"
                  : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
              }`}
            >
              {kpi.trend === "up" ? <ArrowUpRight size={11} /> : kpi.trend === "down" ? <ArrowDownRight size={11} /> : <Minus size={11} />}
              {Math.abs(kpi.delta)}%
            </span>
          )}
        </div>

        <p
          className="mt-auto truncate pt-1 text-[9.5px] text-slate-400 @min-[100px]:text-[10.5px] dark:text-slate-500"
          title={kpi.sub}
        >
          {kpi.sub}
        </p>
      </div>

      {hasSpark && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 opacity-70 transition-opacity group-hover:opacity-100">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={kpi.spark} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={`spark-${kpi.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={tone.spark} stopOpacity={0.22} />
                  <stop offset="100%" stopColor={tone.spark} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="y"
                stroke={tone.spark}
                strokeWidth={1.5}
                fill={`url(#spark-${kpi.key})`}
                isAnimationActive={false}
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

export default memo(KpiCard);
