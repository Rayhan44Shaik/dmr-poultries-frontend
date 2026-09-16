// src/modules/dashboard/components/ActiveResourcesCard.tsx
// Active network & workforce — one tile per master register: how many are
// ACTIVE out of the full register (and the inactive remainder), for Shops,
// Vehicles, Drivers, Supervisors, Helpers and Loaders. Sits directly below
// the Active Fleet card so the bottom of the overview answers, at a glance,
// "of everything on record, how much is actually in service today?".

import { Link } from "react-router-dom";
import {
  ArrowRight,
  ClipboardList,
  Handshake,
  Package,
  Store,
  Truck,
  UserCog,
  type LucideIcon,
} from "lucide-react";
import type { WorkforceStat } from "../utils/dashboardDerive";
import { formatNumber } from "../../../utils/format";
import { useI18n } from "../../../i18n";

const TILE_ICONS: Record<WorkforceStat["key"], LucideIcon> = {
  shops: Store,
  vehicles: Truck,
  drivers: UserCog,
  supervisors: ClipboardList,
  helpers: Handshake,
  loaders: Package,
};

/** Same icon-tint vocabulary as the KPI tiles, so the card blends in. */
const TILE_TONES: Record<WorkforceStat["key"], string> = {
  shops: "bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400",
  vehicles: "bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400",
  drivers: "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400",
  supervisors: "bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400",
  helpers: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400",
  loaders: "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400",
};

interface ActiveResourcesCardProps {
  stats: WorkforceStat[];
}

export default function ActiveResourcesCard({ stats }: ActiveResourcesCardProps) {
  const { t } = useI18n();
  const totalActive = stats.reduce((acc, s) => acc + s.active, 0);
  const totalRecords = stats.reduce((acc, s) => acc + s.total, 0);

  return (
    <section className="rounded-xl border border-slate-200/80 bg-white shadow-card animate-fade-in-up dark:border-slate-800 dark:bg-slate-900">
      <header className="flex items-center justify-between gap-2 px-4 pb-3 pt-4">
        <div>
          <h3 className="text-[13.5px] font-semibold tracking-tight text-slate-800 dark:text-slate-100">
            {t("dashboard.resources.title")}
          </h3>
          <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
            {t("dashboard.resources.subtitle", {
              active: formatNumber(totalActive),
              total: formatNumber(totalRecords),
            })}
          </p>
        </div>
        <Link
          to="/masters?tab=shops"
          className="flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        >
          {t("dashboard.resources.view_masters")}
          <ArrowRight size={13} />
        </Link>
      </header>

      <div className="px-3 pb-4">
        <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-6">
          {stats.map((stat) => {
            const Icon = TILE_ICONS[stat.key];
            const inactive = Math.max(0, stat.total - stat.active);
            const pct = stat.total > 0 ? Math.round((stat.active / stat.total) * 100) : 0;
            return (
              <li
                key={stat.key}
                className="rounded-lg border border-slate-100 bg-slate-50/40 p-3 transition-colors hover:border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-800/40 dark:hover:border-slate-700 dark:hover:bg-slate-800/70"
              >
                <div className="flex items-center gap-2">
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${TILE_TONES[stat.key]}`}>
                    <Icon size={13} />
                  </span>
                  <span className="truncate text-[12px] font-semibold text-slate-700 dark:text-slate-200">
                    {t(`dashboard.resources.${stat.key}`)}
                  </span>
                </div>

                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-[19px] font-bold leading-tight tabular-nums tracking-tight text-slate-900 dark:text-white">
                    {formatNumber(stat.active)}
                  </span>
                  <span className="text-[11px] font-medium tabular-nums text-slate-400 dark:text-slate-500">
                    / {formatNumber(stat.total)}
                  </span>
                </div>

                {/* Active share of the full register — the bar IS the
                    "how many active out of all" answer, no tooltip needed. */}
                <div
                  className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200/70 dark:bg-slate-700"
                  role="img"
                  aria-label={t("dashboard.resources.active_of_total", {
                    active: stat.active,
                    total: stat.total,
                  })}
                  title={t("dashboard.resources.active_of_total", {
                    active: stat.active,
                    total: stat.total,
                  })}
                >
                  <div className="h-1.5 rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
                </div>

                <p className="mt-1.5 text-[10.5px] text-slate-400 dark:text-slate-500">
                  {inactive > 0
                    ? t("dashboard.resources.inactive", { count: inactive })
                    : t("dashboard.resources.all_active")}
                </p>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
