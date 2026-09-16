import { useState } from "react";
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
 * Two ways to read the roster, both staying inside the panel:
 *  - HOVER/FOCUS a tile → an overlay rendered strictly INSIDE the tile lists
 *    who ran in the span, busiest first, with trips / shops / farms / kg.
 *  - CLICK a tile (e.g. Active Loaders) → a details panel opens BELOW the
 *    tiles: the selected register's worked list, then a divider, then the
 *    "did not run in this range" members as a one-by-one HORIZONTAL scroll
 *    line. Selecting the tile again closes the panel; selecting another
 *    register switches it. Register-Inactive (out of service) members carry
 *    an "Inactive" badge, so they are never confused with actives that were
 *    merely idle in the window.
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

const EMPTY: SpanFleetRoster = { worked: 0, activeTotal: 0, items: [], overflow: 0, idle: [], idleOverflow: 0 };

export default function ActiveCounts({ rosters }: ActiveCountsProps) {
  const { t } = useI18n();
  /** Selected tile drives the details panel; clicking it again closes it. */
  const [selected, setSelected] = useState<RosterKey | null>(null);

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

  const selectedRoster = selected ? rosters[selected] ?? EMPTY : null;
  const selectedLabel = selected ? t(`ops.dashboard.active_${selected}`) : "";
  const idleTotal = selectedRoster ? selectedRoster.idle.length + selectedRoster.idleOverflow : 0;

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {TILES.map((tile) => {
          const Icon = tile.icon;
          const stat: SpanFleetRoster = rosters[tile.key] ?? EMPTY;
          // The share of the active register that ran this span.
          const percent = stat.activeTotal > 0 ? (stat.worked / stat.activeTotal) * 100 : 0;
          const registerLabel = t(`ops.dashboard.active_${tile.key}`);
          const isSelected = selected === tile.key;

          return (
            <button
              key={tile.key}
              type="button"
              onClick={() => setSelected(isSelected ? null : tile.key)}
              aria-pressed={isSelected}
              aria-label={`${registerLabel}: ${stat.activeTotal > 0 ? `${stat.worked} / ${stat.activeTotal}` : stat.worked}`}
              className={`group relative flex flex-col items-center p-3 rounded-xl border transition-shadow outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 ${
                isSelected
                  ? "border-emerald-300 bg-emerald-50/40 shadow-md"
                  : "border-slate-100 hover:shadow-md"
              }`}
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

              {/* ── Span-roster overlay rendered INSIDE the tile on hover/focus
                    (absolute inset — it can never grow outside the tile) ─────── */}
              <div
                role="tooltip"
                aria-hidden="true"
                className="pointer-events-none invisible absolute inset-0 z-10 flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white/95 p-2 text-left text-[10px] text-slate-500 opacity-0 shadow-lg backdrop-blur-[1px] transition-opacity duration-150 group-hover:visible group-hover:opacity-100 group-focus-visible:visible group-focus-visible:opacity-100"
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
            </button>
          );
        })}
      </div>

      {/* ── Selected-register details: worked list, then the one-by-one
            HORIZONTAL line of who did not run in this range ────────────────── */}
      {selected && selectedRoster && (
        <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50/60 p-3.5">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-[11.5px] font-black text-slate-800 truncate">
              {selectedLabel}
            </h4>
            <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-black tabular-nums text-emerald-700 ring-1 ring-inset ring-emerald-100">
              {t("ops.dashboard.on_trips_count", { count: selectedRoster.worked })}
            </span>
          </div>

          {selectedRoster.items.length > 0 ? (
            <ul className="mt-2 grid max-h-48 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-1.5 overflow-y-auto pr-1 text-[10.5px]">
              {selectedRoster.items.map((item) => (
                <li key={`panel-${selected}-${item.name}`} className="flex items-start gap-1.5">
                  <span aria-hidden="true" className="mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-slate-700">
                      {item.name}
                    </span>
                    <span className="block truncate tabular-nums text-slate-400">
                      {participantDetail(selected, item)}
                    </span>
                  </span>
                </li>
              ))}
              {selectedRoster.overflow > 0 && (
                <li className="self-center text-center font-bold text-slate-400">
                  {t("ops.dashboard.more_items", { count: selectedRoster.overflow })}
                </li>
              )}
            </ul>
          ) : (
            <p className="mt-2 text-[10.5px] text-slate-400">
              {t("ops.dashboard.no_trips_range")}
            </p>
          )}

          <div className="mt-3 border-t border-slate-200/70 pt-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10.5px] font-bold text-slate-500">
                {t("ops.dashboard.idle_list")}
              </span>
              <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black tabular-nums text-slate-500 ring-1 ring-inset ring-slate-200/70">
                {idleTotal}
              </span>
            </div>

            {selectedRoster.idle.length > 0 ? (
              <ul className="mt-1.5 flex gap-2 overflow-x-auto pb-1">
                {selectedRoster.idle.map((item) => (
                  <li
                    key={`idle-${selected}-${item.name}`}
                    className="shrink-0 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] shadow-sm"
                  >
                    <span className="flex items-center gap-1.5">
                      <span className="truncate font-semibold text-slate-700">{item.name}</span>
                      {item.registerInactive && (
                        <span className="shrink-0 rounded-full bg-rose-50 px-1.5 py-px text-[9px] font-black text-rose-600 ring-1 ring-inset ring-rose-100">
                          {t("common.inactive")}
                        </span>
                      )}
                    </span>
                    {item.detail ? (
                      <span className="block truncate tabular-nums text-slate-400">{item.detail}</span>
                    ) : null}
                  </li>
                ))}
                {selectedRoster.idleOverflow > 0 && (
                  <li className="shrink-0 self-center rounded-lg border border-dashed border-slate-200 px-2.5 py-1.5 text-[10px] font-bold text-slate-400">
                    {t("ops.dashboard.more_items", { count: selectedRoster.idleOverflow })}
                  </li>
                )}
              </ul>
            ) : (
              <p className="mt-1.5 text-[10.5px] text-slate-400">
                {t("ops.dashboard.everyone_ran")}
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
