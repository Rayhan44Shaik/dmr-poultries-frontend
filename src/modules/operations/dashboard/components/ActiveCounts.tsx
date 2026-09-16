import { Truck, Users, UserCog, Store, ClipboardList, Package } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useI18n } from "../../../../i18n";
import type {
  DashboardFleetCounts,
  RegisterCount,
} from "../services/dashboardService";

/**
 * Active Fleet per-register tiles. Every tile answers one question — “how
 * many are ACTIVE out of the whole register?” — for Shops, Vehicles, Drivers,
 * Supervisors, Helpers and Loaders (farms are deliberately excluded). The
 * headline is `active / total`, the bar is the active share of the register,
 * and the caption spells out the inactive remainder; when the period usage is
 * known (trips that actually ran in the selected range) it rides along as a
 * secondary line, never mixed into the register counts.
 */
interface ActiveCountsProps {
  counts: DashboardFleetCounts;
  /** In-period usage per register (trips in the selected range), when known. */
  used?: Partial<Record<keyof DashboardFleetCounts, number>>;
}

interface TileDef {
  key: keyof DashboardFleetCounts;
  icon: LucideIcon;
  color: string;
  bg: string;
}

const TILES: TileDef[] = [
  { key: "shops", icon: Store, color: "text-orange-500", bg: "bg-orange-50" },
  { key: "vehicles", icon: Truck, color: "text-blue-500", bg: "bg-blue-50" },
  { key: "drivers", icon: Users, color: "text-green-500", bg: "bg-green-50" },
  { key: "supervisors", icon: ClipboardList, color: "text-violet-500", bg: "bg-violet-50" },
  { key: "helpers", icon: UserCog, color: "text-purple-500", bg: "bg-purple-50" },
  { key: "loaders", icon: Package, color: "text-rose-500", bg: "bg-rose-50" },
];

const EMPTY: RegisterCount = { active: 0, total: 0 };

export default function ActiveCounts({ counts, used = {} }: ActiveCountsProps) {
  const { t } = useI18n();

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-700 mb-4 text-center">
        {t("ops.dashboard.active_counts")}
      </h3>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {TILES.map((tile) => {
          const Icon = tile.icon;
          const stat: RegisterCount = counts[tile.key] ?? EMPTY;
          const inactive = Math.max(0, stat.total - stat.active);
          // The share of the register that is active — the bar IS the
          // "how many active out of all" answer, no tooltip needed.
          const percent = stat.total > 0 ? (stat.active / stat.total) * 100 : 0;
          const usedInPeriod = used[tile.key];

          return (
            <div
              key={tile.key}
              className="flex flex-col items-center p-3 rounded-xl border border-slate-100 hover:shadow-md transition-shadow"
            >
              <div className={`p-2 rounded-full ${tile.bg} mb-2`}>
                <Icon size={18} className={tile.color} />
              </div>
              <div className="text-lg font-bold tabular-nums text-slate-800">
                {stat.active} / {stat.total}
              </div>
              <div className="text-xs text-slate-500 truncate w-full text-center">
                {t(`ops.dashboard.active_${tile.key}`)}
              </div>
              <div
                className="w-full h-1.5 bg-slate-100 rounded-full mt-2"
                title={t("ops.dashboard.active_of_total", {
                  active: stat.active,
                  total: stat.total,
                })}
              >
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    percent >= 90
                      ? "bg-green-500"
                      : percent >= 70
                      ? "bg-amber-500"
                      : "bg-red-500"
                  }`}
                  style={{ width: `${Math.min(percent, 100)}%` }}
                />
              </div>
              <div className="mt-1.5 w-full text-center text-[10.5px] leading-tight text-slate-400">
                {inactive > 0
                  ? t("ops.dashboard.inactive_count", { count: inactive })
                  : t("ops.dashboard.all_active")}
                {usedInPeriod != null && (
                  <span className="block text-slate-300 dark:text-slate-500">
                    {t("ops.dashboard.in_period", { count: usedInPeriod })}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
