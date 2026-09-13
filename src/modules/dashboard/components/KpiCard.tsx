import { memo } from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import type { KpiDatum } from "../utils/dashboardDerive";

const toneClasses: Record<KpiDatum["tone"], { bg: string; text: string }> = {
  brand: { bg: "bg-brand-500", text: "text-brand-600 dark:text-brand-400" },
  sky: { bg: "bg-sky-500", text: "text-sky-600 dark:text-sky-400" },
  amber: { bg: "bg-amber-500", text: "text-amber-500 dark:text-amber-400" },
  rose: { bg: "bg-rose-500", text: "text-rose-500 dark:text-rose-400" },
  violet: { bg: "bg-violet-500", text: "text-violet-600 dark:text-violet-400" },
  emerald: { bg: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400" },
  teal: { bg: "bg-teal-500", text: "text-teal-600 dark:text-teal-400" },
  slate: { bg: "bg-slate-500", text: "text-slate-600 dark:text-slate-400" },
};

interface KpiCardProps {
  kpi: KpiDatum;
  index?: number;
}

function KpiCard({ kpi, index = 0 }: KpiCardProps) {
  const tone = toneClasses[kpi.tone] || toneClasses.slate;
  const Icon = kpi.icon;

  let trendClass = "bg-slate-50 text-slate-500 dark:bg-slate-800/50";
  let TrendIcon = Minus;
  if (kpi.trend === "up") {
    trendClass = "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10";
    TrendIcon = ArrowUpRight;
  } else if (kpi.trend === "down") {
    trendClass = "bg-rose-50 text-rose-600 dark:bg-rose-500/10";
    TrendIcon = ArrowDownRight;
  }

  return (
    <div
      className="group flex w-full items-center gap-1.5 py-1 animate-fade-in justify-between"
      style={{ animationDelay: `${Math.min(index * 30, 200)}ms` }}
    >
      <div className="flex items-center gap-1.5 min-w-0 shrink-0">
        <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-white ${tone.bg}`}>
          <Icon size={12} strokeWidth={2.5} />
        </div>
        <div className="flex items-baseline gap-1 whitespace-nowrap">
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">{kpi.label}</span>
          <span className={`text-[13px] font-bold tracking-tight tabular-nums ${tone.text}`}>
            {kpi.value}
          </span>
        </div>
      </div>

      <span
        className={`flex items-center shrink-0 gap-0.5 rounded px-1 py-0.5 text-[9.5px] font-bold tabular-nums whitespace-nowrap ${trendClass}`}
      >
        <TrendIcon size={10} strokeWidth={2.5} />
        {kpi.delta === 0 ? "No change" : kpi.delta != null ? `${Math.abs(kpi.delta)}%` : ""}
        {kpi.sub && <span className="font-medium opacity-60 ml-0.5">{kpi.sub}</span>}
      </span>
    </div>
  );
}

export default memo(KpiCard);
