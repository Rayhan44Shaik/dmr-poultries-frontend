import { Truck, Users, UserCog, ClipboardList, Package } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useI18n } from "../../../../i18n";
import type {
  DashboardSpanFleet,
  SpanFleetParticipant,
  SpanFleetRoster,
} from "../services/dashboardService";

/**
 * Active Fleet — span-scoped roster tiles. Only the people and vehicles that
 * actually ran a trip inside the selected date window are counted (the panel
 * below the "Active Fleet" heading names the same span); the active masters
 * register rides along as the small "of N active" denominator for context.
 * Tiles: Vehicles, Drivers, Supervisors, Helpers, Loaders — shops are
 * deliberately not part of this panel.
 *
 * Hovering (or keyboard-focusing) a tile opens a tooltip listing exactly WHO
 * ran in the span, busiest first, with their per-span detail (trips, shops
 * delivered, farms covered, kg hauled) in the Collection Recovery card's
 * popover style.
 */
interface ActiveCountsProps {
  rosters: DashboardSpanFleet;
}

/** The five registers the panel shows — `tripCount` is meta, not a register. */
type RosterKey = Exclude<keyof DashboardSpanFleet, "tripCount"> & string;

interface TileDef {
  key: RosterKey;
  icon: LucideIcon;
  color: string;
  bg: string;
}

const TILES: TileDef[] = [
  { key: "vehicles", icon: Truck, color: "text-blue-500", bg: "bg-blue-50" },
  { key: "drivers", icon: Users, color: "text-green-500", bg: "bg-green-50" },
  { key: "supervisors", icon: ClipboardList, color: "text-violet-500", bg: "bg-violet-50" },
  { key: "helpers", icon: UserCog, color: "text-purple-500", bg: "bg-purple-50" },
  { key: "loaders", icon: Package, color: "text-rose-500", bg: "bg-rose-50" },
];

const EMPTY: SpanFleetRoster = { worked: 0, activeTotal: 0, items: [], overflow: 0 };

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

export default function ActiveCounts({ rosters }: ActiveCountsProps) {
  const { t } = useI18n();

  /** Per-span detail for one participant, shaped by what the register knows. */
  const participantDetail = (key: RosterKey, p: SpanFleetParticipant): string => {
    if (key === "vehicles" && p.weightKg != null) {
      return t("ops.dashboard.detail_trips_weight", { trips: p.trips, weight: p.weightKg.toLocaleString("en-IN") });
    }
    if (key === "drivers" && p.shops != null) {
      return t("ops.dashboard.detail_trips_shops", { trips: p.trips, shops: p.shops });
    }
    if (key === "supervisors" && p.farms != null) {
      return t("ops.dashboard.detail_trips_farms", { trips: p.trips, farms: p.farms });
    }
    return t("ops.dashboard.detail_trips", { trips: p.trips });
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
      {TILES.map((tile, index) => {
        const Icon = tile.icon;
        const stat: SpanFleetRoster = rosters[tile.key] ?? EMPTY;
        // The share of the active register that ran this span.
        const percent = stat.activeTotal > 0 ? (stat.worked / stat.activeTotal) * 100 : 0;
        const registerLabel = t(`ops.dashboard.active_${tile.key}`);

        return (
          <div
            key={tile.key}
            tabIndex={0}
            aria-label={`${registerLabel}: ${stat.activeTotal > 0 ? `${stat.worked} / ${stat.activeTotal}` : stat.worked}`}
            className="group relative flex flex-col items-center p-3 rounded-xl border border-slate-100 hover:shadow-md transition-shadow outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60"
          >
            <div className={`p-2 rounded-full ${tile.bg} mb-2`}>
              <Icon size={18} className={tile.color} />
            </div>
            <div className="text-lg font-bold tabular-nums text-slate-800">
              {stat.activeTotal > 0 ? `${stat.worked} / ${stat.activeTotal}` : stat.worked}
            </div>
            <div className="text-xs text-slate-500 truncate w-full text-center">
              {registerLabel}
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
              {t("ops.dashboard.on_trips_range")}
            </div>

            {/* ── Span-roster tooltip (on hover/focus; exactly who ran trips
                  inside the selected window, busiest first) ──────────────── */}
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
                  {registerLabel}
                </span>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black tabular-nums ring-1 ring-inset ${
                    stat.worked > 0
                      ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
                      : "bg-slate-50 text-slate-500 ring-slate-100"
                  }`}
                >
                  {t("ops.dashboard.on_trips_count", { count: stat.worked })}
                </span>
              </div>

              {stat.items.length > 0 ? (
                <ul className="relative mt-1.5 max-h-44 space-y-1 overflow-y-auto pr-0.5">
                  {stat.items.map((item) => (
                    <li key={`${tile.key}-${item.name}`} className="flex items-start gap-1.5">
                      <span aria-hidden="true" className="mt-[4.5px] h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-slate-700">
                          {item.name}
                        </span>
                        <span className="block truncate tabular-nums text-slate-400">
                          {participantDetail(tile.key, item)}
                        </span>
                      </span>
                    </li>
                  ))}
                  {stat.overflow > 0 && (
                    <li className="pt-0.5 text-center font-bold text-slate-400">
                      {t("ops.dashboard.more_items", { count: stat.overflow })}
                    </li>
                  )}
                </ul>
              ) : (
                <p className="relative mt-1.5 text-slate-400">
                  {t("ops.dashboard.no_trips_range")}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
