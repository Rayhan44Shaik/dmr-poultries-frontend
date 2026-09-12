import React, { type ReactNode } from "react";
import {
  IndianRupee,
  Pencil,
  Lock,
  Hash,
  Calendar,
  Truck,
  UserCog,
  Warehouse,
  ShoppingBag,
  Bird,
  Scale,
  Settings,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import type { Trip } from "../../vehicle-trips/types/trip.ts";
import { formatTripListDay } from "../../vehicle-trips/utils/formatTripListDay";
import { formatVehicleNumber } from "../../../../utils/format";
import { ActionTooltip } from "../../../../ui/ActionTooltip";
import { uiActionIconMotionClass } from "../../../../shared/ui/uiTokens";
import type { RateEntrySortKey } from "../hooks/useCompletedTrips";

// Helper: check if trip is within 10 days
const isWithin10Days = (createdAt: string) => {
  const created = new Date(createdAt);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
  return diffDays <= 10;
};

interface Props {
  trips: Trip[];
  onEnterRate: (trip: Trip) => void;
  onModifyRate: (trip: Trip) => void;
  children?: ReactNode;
  startIndex?: number;
  sortBy?: RateEntrySortKey | null;
  sortDir?: "asc" | "desc";
  onSortChange?: (key: RateEntrySortKey) => void;
}

/** Same side-by-side sort arrows used by Trip List. */
function SortArrows({ active, dir }: { active: boolean; dir?: "asc" | "desc" }) {
  const base = "h-3 w-3 shrink-0 transition-colors";
  const on = "text-emerald-600";
  const off = "text-slate-400 group-hover/sort:text-slate-600";
  return (
    <span className="inline-flex items-center gap-0.5 shrink-0" aria-hidden="true">
      <ArrowUp size={12} strokeWidth={2.7} className={`${base} ${active && dir === "asc" ? on : off}`} />
      <ArrowDown size={12} strokeWidth={2.7} className={`${base} ${active && dir === "desc" ? on : off}`} />
    </span>
  );
}

function CompletedTripsTable({
  trips,
  onEnterRate,
  onModifyRate,
  children,
  startIndex = 0,
  sortBy = null,
  sortDir = "asc",
  onSortChange,
}: Props) {
  const sortable = (key: RateEntrySortKey, content: React.ReactNode, center = false) => {
    if (!onSortChange) return content;
    const active = sortBy === key;
    return (
      <button
        type="button"
        onClick={() => onSortChange(key)}
        title="Sort"
        aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
        className={`group/sort flex items-center gap-2 w-full uppercase tracking-wider font-bold text-[11px] transition-colors hover:text-emerald-700 ${
          center ? "justify-center" : ""
        } ${active ? "text-emerald-700" : ""}`}
      >
        {content}
        <SortArrows active={active} dir={sortDir} />
      </button>
    );
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
      <div className="w-full overflow-x-auto">
        <table className="min-w-full text-sm text-left border-collapse">
          <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600">
            <tr className="whitespace-nowrap">
              <th className="px-4 py-3 text-center text-[11px] font-bold uppercase tracking-wider w-10">#</th>
              <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider">
                {sortable("tripNo", <div className="flex items-center gap-1.5">
                  <Hash size={13} className="text-slate-400 flex-shrink-0" />
                  <span>Trip No</span>
                </div>)}
              </th>
              <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider">
                {sortable("tripDate", <div className="flex items-center gap-1.5">
                  <Calendar size={13} className="text-blue-500 flex-shrink-0" />
                  <span>Day</span>
                </div>)}
              </th>
              <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider">
                {sortable("vehicleNo", <div className="flex items-center gap-1.5">
                  <Truck size={13} className="text-indigo-500 flex-shrink-0" />
                  <span>Vehicle</span>
                </div>)}
              </th>
              <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider">
                {sortable("supervisorName", <div className="flex items-center gap-1.5">
                  <UserCog size={13} className="text-purple-500 flex-shrink-0" />
                  <span>Supervisor</span>
                </div>)}
              </th>
              <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider">
                {sortable("sourceFarm", <div className="flex items-center gap-1.5">
                  <Warehouse size={13} className="text-amber-500 flex-shrink-0" />
                  <span>Farm</span>
                </div>)}
              </th>
              <th className="px-4 py-3 text-center text-[11px] font-bold uppercase tracking-wider">
                {sortable("totalShops", <div className="flex items-center justify-center gap-1.5">
                  <ShoppingBag size={13} className="text-cyan-500 flex-shrink-0" />
                  <span>Shops</span>
                </div>, true)}
              </th>
              <th className="px-4 py-3 text-center text-[11px] font-bold uppercase tracking-wider">
                {sortable("totalBirds", <div className="flex items-center justify-center gap-1.5">
                  <Bird size={13} className="text-blue-500 flex-shrink-0" />
                  <span>Birds</span>
                </div>, true)}
              </th>
              <th className="px-4 py-3 text-center text-[11px] font-bold uppercase tracking-wider">
                {sortable("totalWeight", <div className="flex items-center justify-center gap-1.5">
                  <Scale size={13} className="text-orange-500 flex-shrink-0" />
                  <span>Weight</span>
                </div>, true)}
              </th>
              <th className="px-4 py-3 text-center text-[11px] font-bold uppercase tracking-wider">
                <div className="flex items-center justify-center gap-1.5">
                  <Settings size={13} className="text-slate-500 flex-shrink-0" />
                  <span>Action</span>
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {trips.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-12 text-center text-slate-400 text-xs font-medium">
                  No trips waiting for rate entry.
                </td>
              </tr>
            ) : (
              trips.map((trip, index) => {
                const isLocked = trip.rateCompleted === true;
                const canModify = isLocked && isWithin10Days(trip.createdAt || "");
                const isReadOnly = isLocked && !canModify;
                const serialNo = startIndex + index + 1;

                return (
                  <tr
                    key={trip.id}
                    className={`${index % 2 === 0 ? "bg-white" : "bg-slate-50/20"} border-t transition-colors duration-150 hover:bg-slate-50/60`}
                  >
                    <td className="px-4 py-3 text-center text-xs text-slate-500 font-medium w-10">{serialNo}</td>
                    <td className="px-4 py-3 font-bold text-emerald-500 text-xs whitespace-nowrap">{trip.tripNo}</td>
                    <td className="px-4 py-3 text-xs font-medium text-slate-600 whitespace-nowrap">{formatTripListDay(trip.tripDate)}</td>
                    <td className="px-4 py-3 text-xs font-medium text-slate-700 whitespace-nowrap">{formatVehicleNumber(trip.vehicleNo)}</td>
                    <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">{trip.supervisorName}</td>
                    <td className="px-4 py-3 text-xs text-slate-600 font-medium whitespace-nowrap">{trip.sourceFarm}</td>
                    <td className="px-4 py-3 text-center text-xs font-bold text-slate-700 whitespace-nowrap">{trip.totalShops}</td>
                    <td className="px-4 py-3 text-center text-xs font-bold text-blue-500 whitespace-nowrap">{trip.totalBirds.toLocaleString()}</td>
                    <td className="px-4 py-3 text-center text-xs font-bold text-amber-500 whitespace-nowrap">{trip.totalWeight.toFixed(2)}</td>
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      {!isLocked ? (
                        // Enter Rates – always enabled for un-locked trips
                        <button
                          type="button"
                          onClick={() => onEnterRate(trip)}
                          className="group relative inline-flex items-center gap-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 text-xs font-semibold transition-[color,background-color,border-color,box-shadow,transform] duration-150 shadow-sm active:scale-95"
                          aria-label={`Enter rates for ${trip.tripNo}`}
                        >
                          <span className={`inline-flex ${uiActionIconMotionClass.edit}`}><IndianRupee size={14} /></span>
                          Enter Rates
                          <ActionTooltip label="Enter Rates" />
                        </button>
                      ) : canModify ? (
                        // Modify Rates – within 10 days
                        <button
                          type="button"
                          onClick={() => onModifyRate(trip)}
                          className="group relative inline-flex items-center gap-1 rounded-xl bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 text-xs font-semibold transition-[color,background-color,border-color,box-shadow,transform] duration-150 shadow-sm active:scale-95"
                          aria-label={`Modify rates for ${trip.tripNo}`}
                        >
                          <span className={`inline-flex ${uiActionIconMotionClass.edit}`}><Pencil size={14} /></span>
                          Modify Rates
                          <ActionTooltip label="Modify Rates" />
                        </button>
                      ) : isReadOnly ? (
                        // Read-only – older than 10 days
                        <span className="inline-flex items-center gap-1 rounded-xl bg-slate-100 text-slate-400 px-3 py-1.5 text-xs font-semibold cursor-not-allowed">
                          <Lock size={14} />
                          Locked
                        </span>
                      ) : null}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      {children}
    </div>
  );
}

export default React.memo(CompletedTripsTable);
