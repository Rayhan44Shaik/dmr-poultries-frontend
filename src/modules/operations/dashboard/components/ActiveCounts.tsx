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
 * Hovering (or keyboard-focusing) a tile reveals a roster overlay rendered
 * strictly INSIDE the tile's own box (absolute inset, no pop-out): it lists
 * exactly WHO ran in the span, busiest first, with their per-span detail
 * (trips, shops delivered, farms covered, kg hauled). Nothing is drawn
 * outside the tiles' grid, so the panel never overlaps neighbouring cards.
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
      {TILES.map((tile) => {
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

            {/* ── Span-roster tooltip rendered INSIDE the tile on hover/focus
                  (absolute inset — it can never grow outside the tile) ─────── */}
            <div
              role="tooltip"
              aria-hidden="true"
              className="pointer-events-none invisible absolute inset-0 z-10 flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white/95 p-2 text-left text-[10px] text-slate-500 opacity-0 shadow-lg backdrop-blur-[1px] transition-opacity duration-150 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"
            >
              <div className="flex shrink-0 min-w-0 items-center justify-between gap-1.5 border-b border-slate-100 pb-1">
                <span className="truncate text-[11px] font-bold text-slate-800">
                  {registerLabel}
                </span>
                <span
                  className={`shrink-0 rounded-full px-1.5 py-px text-[9.5px] font-black tabular-nums ring-1 ring-inset ${
                    stat.worked > 0
                      ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
                      : "bg-slate-50 text-slate-500 ring-slate-100"
                  }`}
                >
                  {t("ops.dashboard.on_trips_count", { count: stat.worked })}
                </span>
              </div>

              {stat.items.length > 0 ? (
                <ul className="mt-1 min-h-0 flex-1 space-y-1 overflow-y-auto pr-0.5">
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
                <p className="mt-1 flex min-h-0 flex-1 items-center justify-center text-center text-slate-400">
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
