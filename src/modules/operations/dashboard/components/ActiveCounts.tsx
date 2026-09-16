import { useState } from "react";
import { Truck, Users, UserCog, ClipboardList, Package } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useI18n } from "../../../../i18n";
import type {
  DashboardSpanFleet,
  SpanFleetRoster,
} from "../services/dashboardService";

/**
 * Active Fleet — span-scoped tiles with NO lists of who worked. Hovering or
 * clicking never surfaces "active trips" details anywhere:
 *  - Tiles (always on screen) show only the worked/active count for the
 *    selected window ("22 / 22 style"), the register name and a share bar.
 *  - CLICK any tile → that register's "did not run in this range" members
 *    appear below the tiles as a one-by-one HORIZONTAL scroll line;
 *    selecting the tile again closes it, selecting another register
 *    switches it. Only ACTIVE register members can appear there — a tile
 *    reading "29 / 29" therefore shows "Everyone ran trips in this range"
 *    (worked + idle always equals the tile's active denominator), and
 *    out-of-service members never surface. The worked/active roster lists
 *    themselves are deliberately never rendered.
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
  const { t, language } = useI18n();
  /** Selected tile drives the idle line; clicking it again closes it. */
  const [selected, setSelected] = useState<RosterKey | null>(null);

  /** "16 Aug 2026" in the UI's own language for an idle member's last run. */
  const formatLastTrip = (isoDate: string): string => {
    const date = new Date(`${isoDate}T00:00:00`);
    if (Number.isNaN(date.getTime())) return isoDate;
    return date.toLocaleDateString(language === "te" ? "te-IN" : "en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
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

          const tileBody = (
            <>
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
            </>
          );

          // Vehicles is clickable like the crew tiles — its active list is
          // never shown, and its "did not run" chips open on demand below.
          return (
            <button
              key={tile.key}
              type="button"
              onClick={() => setSelected(isSelected ? null : tile.key)}
              aria-pressed={isSelected}
              aria-label={`${registerLabel}: ${stat.activeTotal > 0 ? `${stat.worked} / ${stat.activeTotal}` : stat.worked}`}
              className={`flex flex-col items-center p-3 rounded-xl border transition-shadow outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 ${
                isSelected
                  ? "border-emerald-300 bg-emerald-50/40 shadow-md"
                  : "border-slate-100 hover:shadow-md"
              }`}
            >
              {tileBody}
            </button>
          );
        })}
      </div>

      {/* ── Selected register's "did not run in this range" line — chips in a
            one-by-one HORIZONTAL scroll row, toggled by the tile click. The
            active/worked-trip lists are never rendered, by design. ────────── */}
      {selected && selectedRoster && (
        <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3.5">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-[10.5px] font-bold text-slate-500">
              {selectedLabel} · {t("ops.dashboard.idle_list")}
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
                  <span className="truncate font-semibold text-slate-700">{item.name}</span>
                  {item.type ? (
                    <span className="block truncate text-slate-400">{item.type}</span>
                  ) : null}
                  <span className="block truncate tabular-nums text-slate-400">
                    {item.lastTripDate
                      ? t("ops.dashboard.last_worked", { date: formatLastTrip(item.lastTripDate) })
                      : t("ops.dashboard.no_trips_yet")}
                  </span>
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
      )}
    </>
  );
}
