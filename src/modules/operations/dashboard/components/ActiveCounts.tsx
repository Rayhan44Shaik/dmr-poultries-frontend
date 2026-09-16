import { Truck, Users, UserCog, Store, ClipboardList, Package } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useI18n } from "../../../../i18n";
import type {
  DashboardFleetCounts,
  RegisterCount,
} from "../services/dashboardService";

/**
 * Active Fleet per-register tiles — one tile per register (Shops, Vehicles,
 * Drivers, Supervisors, Helpers, Loaders; farms deliberately excluded).
 * Every tile answers "how many are ACTIVE out of the whole register?":
 * the headline is `active / total`, the bar is the active share, and the
 * caption is the inactive remainder. Hovering (or keyboard-focusing) a tile
 * opens a tooltip that names exactly WHICH records are inactive, styled like
 * the Collection Recovery card's tooltip. In-period usage (trips that ran in
 * the selected range) rides along as a secondary line, never mixed into the
 * register counts. The surrounding section card owns the "Active Fleet" title.
 */
/** The six register keys — `asOf` is a snapshot timestamp, not a register. */
type RegisterKey = Exclude<keyof DashboardFleetCounts, "asOf"> & string;

interface ActiveCountsProps {
  counts: DashboardFleetCounts;
  /** In-period usage per register (trips in the selected range), when known. */
  used?: Partial<Record<RegisterKey, number>>;
}

interface TileDef {
  key: RegisterKey;
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

const EMPTY: RegisterCount = { active: 0, total: 0, inactiveItems: [], inactiveOverflow: 0 };

/**
 * Keep the centered tooltip inside the panel for the edge tiles: the first
 * column pins left, the last pins right, everyone else stays centered.
 */
function tooltipAlign(index: number, total: number): string {
  if (index === 0) return "left-0";
  if (index === total - 1) return "right-0";
  return "left-1/2 -translate-x-1/2";
}

function arrowAlign(index: number, total: number): string {
  if (index === 0) return "left-6";
  if (index === total - 1) return "right-6";
  return "left-1/2 -translate-x-1/2";
}

export default function ActiveCounts({ counts, used = {} }: ActiveCountsProps) {
  const { t } = useI18n();

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
      {TILES.map((tile, index) => {
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
            tabIndex={0}
            aria-label={`${t(`ops.dashboard.active_${tile.key}`)}: ${stat.active} / ${stat.total}${inactive > 0 ? `, ${t("ops.dashboard.inactive_count", { count: inactive })}` : ""}`}
            className="group relative flex flex-col items-center p-3 rounded-xl border border-slate-100 hover:shadow-md transition-shadow outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60"
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
              aria-hidden="true"
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

            {/* ── Inactive-register tooltip (rendered on hover/focus; naming
                  exactly which records are out of service) ──────────────── */}
            <div
              role="tooltip"
              className={`pointer-events-none invisible absolute bottom-[calc(100%+10px)] z-50 w-56 rounded-2xl border border-slate-200 bg-white p-3 text-left text-[10px] text-slate-500 opacity-0 shadow-xl shadow-slate-900/12 transition-opacity duration-150 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100 ${tooltipAlign(index, TILES.length)}`}
            >
              <span
                aria-hidden="true"
                className={`absolute top-full h-2.5 w-2.5 -translate-y-1/2 rotate-45 border-b border-r border-slate-200 bg-white ${arrowAlign(index, TILES.length)}`}
              />

              <div className="relative flex min-w-0 items-center justify-between gap-2 border-b border-slate-100 pb-1.5">
                <span className="truncate text-[11.5px] font-bold text-slate-800">
                  {t(`ops.dashboard.active_${tile.key}`)}
                </span>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black tabular-nums ring-1 ring-inset ${
                    inactive > 0
                      ? "bg-rose-50 text-rose-600 ring-rose-100"
                      : "bg-emerald-50 text-emerald-700 ring-emerald-100"
                  }`}
                >
                  {inactive > 0
                    ? t("ops.dashboard.inactive_count", { count: inactive })
                    : t("ops.dashboard.all_active")}
                </span>
              </div>

              {stat.inactiveItems.length > 0 ? (
                <ul className="relative mt-1.5 max-h-44 space-y-1 overflow-y-auto pr-0.5">
                  {stat.inactiveItems.map((item) => (
                    <li key={`${tile.key}-${item.name}-${item.detail ?? ""}`} className="flex items-start gap-1.5">
                      <span aria-hidden="true" className="mt-[4.5px] h-1.5 w-1.5 shrink-0 rounded-full bg-rose-400" />
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-slate-700">
                          {item.name}
                        </span>
                        {item.detail ? (
                          <span className="block truncate tabular-nums text-slate-400">
                            {item.detail}
                          </span>
                        ) : null}
                      </span>
                    </li>
                  ))}
                  {stat.inactiveOverflow > 0 && (
                    <li className="pt-0.5 text-center font-bold text-slate-400">
                      {t("ops.dashboard.more_inactive", { count: stat.inactiveOverflow })}
                    </li>
                  )}
                </ul>
              ) : (
                <p className="relative mt-1.5 text-slate-400">
                  {t("ops.dashboard.no_inactive")}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
