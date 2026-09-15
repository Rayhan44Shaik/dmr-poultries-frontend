// src/modules/dashboard/components/QuarterSnapshot.tsx
// "Quarter to date" band — where the whole business window stands.
//
// The figures come from GET /api/operations/dashboard, the SAME aggregate the
// Operations Dashboard and Accounts → Analysis render, so this band can never
// drift away from those pages. Nothing is rendered when the aggregate is
// unavailable (a backend that has not implemented the endpoint yet).

import { Layers } from "lucide-react";
import type { QuarterSnapshot } from "../services/dashboardService";
import { formatDayMonth, formatINRCompact, formatNumber, formatWeight } from "../../../utils/format";
import { useI18n } from "../../../i18n";

interface QuarterSnapshotProps {
  quarter: QuarterSnapshot | null;
}

interface Figure {
  key: string;
  label: string;
  value: string;
  sub: string;
  tone: "brand" | "sky" | "amber" | "rose" | "violet" | "slate";
}

const TONE_TEXT: Record<Figure["tone"], string> = {
  brand: "text-brand-600 dark:text-brand-400",
  sky: "text-sky-600 dark:text-sky-400",
  amber: "text-amber-600 dark:text-amber-400",
  rose: "text-rose-600 dark:text-rose-400",
  violet: "text-violet-600 dark:text-violet-400",
  slate: "text-slate-500 dark:text-slate-400",
};

/** Local-calendar Date from a YYYY-MM-DD string. `new Date("2026-06-16")`
 *  parses as UTC midnight and renders as the 15th in any zone behind UTC. */
const localDate = (value: string): Date => new Date(`${value}T00:00:00`);

export default function QuarterSnapshot({ quarter }: QuarterSnapshotProps) {
  const { t } = useI18n();
  if (!quarter) return null;

  const collectedPct =
    quarter.sales > 0 ? Math.round((quarter.collections / quarter.sales) * 100) : 0;
  const net = quarter.sales - quarter.expenses;

  const figures: Figure[] = [
    {
      key: "trips",
      label: t("dashboard.quarter.trips"),
      value: formatNumber(quarter.trips),
      sub: t("dashboard.quarter.trips_sub", { weight: formatWeight(quarter.weight) }),
      tone: "brand",
    },
    {
      key: "sales",
      label: t("dashboard.quarter.sales"),
      value: formatINRCompact(quarter.sales),
      sub: t("dashboard.quarter.sales_sub"),
      tone: "brand",
    },
    {
      key: "collections",
      label: t("dashboard.quarter.collections"),
      value: formatINRCompact(quarter.collections),
      sub: t("dashboard.quarter.collections_sub", { pct: collectedPct }),
      tone: "sky",
    },
    {
      key: "expenses",
      label: t("dashboard.quarter.expenses"),
      value: formatINRCompact(quarter.expenses),
      sub: t("dashboard.quarter.expenses_sub", {
        fuel: formatINRCompact(quarter.fuelExpense),
        trip: formatINRCompact(quarter.tripExpense),
        maintenance: formatINRCompact(quarter.maintenanceExpense),
      }),
      tone: "amber",
    },
    {
      key: "net",
      label: t("dashboard.quarter.net"),
      value: formatINRCompact(net),
      sub: t("dashboard.quarter.net_sub"),
      tone: net >= 0 ? "violet" : "rose",
    },
    {
      key: "pending",
      label: t("dashboard.quarter.pending"),
      value: formatINRCompact(quarter.pending),
      sub: t("dashboard.quarter.pending_sub"),
      tone: "rose",
    },
  ];

  return (
    <section className="rounded-xl border border-slate-200/80 bg-white shadow-card animate-fade-in-up dark:border-slate-800 dark:bg-slate-900">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
            <Layers size={14} />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-[13.5px] font-semibold tracking-tight text-slate-800 dark:text-slate-100">
              {t("dashboard.quarter.title")}
            </h2>
            <p className="truncate text-xs text-slate-400 dark:text-slate-500">
              {quarter.label} · {formatDayMonth(localDate(quarter.fromDate))} → {formatDayMonth(localDate(quarter.toDate))}
            </p>
          </div>
        </div>
        <span className="shrink-0 rounded-full bg-slate-50 px-2.5 py-1 text-[10.5px] font-semibold text-slate-500 ring-1 ring-inset ring-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-700">
          {t("dashboard.quarter.through", { date: formatDayMonth(localDate(quarter.today)) })}
        </span>
      </header>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 px-4 py-3 sm:grid-cols-3 lg:grid-cols-6">
        {figures.map((figure) => (
          <div key={figure.key} className="min-w-0">
            <dt className="truncate text-[10.5px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
              {figure.label}
            </dt>
            <dd
              className={`mt-0.5 truncate text-[15px] font-bold tabular-nums ${TONE_TEXT[figure.tone]}`}
              title={figure.value}
            >
              {figure.value}
            </dd>
            <dd className="truncate text-[10.5px] text-slate-400 dark:text-slate-500" title={figure.sub}>
              {figure.sub}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
