import React, { type ReactNode } from "react";
import {
  IndianRupee,
  Pencil,
  Lock,
  ArrowUp,
  ArrowDown,
  Check,
  Hash,
  Calendar,
  Truck,
  UserCog,
  Warehouse,
  ShoppingBag,
  Bird,
  Scale,
} from "lucide-react";
import type { Trip } from "../../vehicle-trips/types/trip.ts";
import { formatVehicleNumber } from "../../../../utils/format";
import { useI18n } from "../../../../i18n";
import { ActionTooltip } from "../../../../ui/ActionTooltip";
import { uiActionIconMotionClass } from "../../../../shared/ui/uiTokens";
import type { RateEntrySortKey } from "../hooks/useCompletedTrips";
import { displayRateEntryName, formatRateEntryDay } from "../utils/rateEntryDisplay";

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
  selectedRowId?: number | null;
  onRowClick?: (trip: Trip) => void;
  startIndex?: number;
  sortBy?: RateEntrySortKey | null;
  sortDir?: "asc" | "desc";
  onSortChange?: (key: RateEntrySortKey) => void;
}

function SortArrows({ active, dir }: { active: boolean; dir?: "asc" | "desc" }) {
  const base = "h-3.5 w-3.5 shrink-0 transition-colors";
  const on = "text-emerald-600";
  const off = "text-slate-400 group-hover/sort:text-slate-600";
  return (
    <span className="inline-flex items-center gap-0.5 shrink-0" aria-hidden="true">
      <ArrowUp size={13} strokeWidth={2.7} className={`${base} ${active && dir === "asc" ? on : off}`} />
      <ArrowDown size={13} strokeWidth={2.7} className={`${base} ${active && dir === "desc" ? on : off}`} />
    </span>
  );
}

function CompletedTripsTable({
  trips,
  onEnterRate,
  onModifyRate,
  children,
  selectedRowId = null,
  onRowClick,
  startIndex = 0,
  sortBy = null,
  sortDir = "asc",
  onSortChange,
}: Props) {
  const { t, language } = useI18n();

  const sortable = (key: RateEntrySortKey, content: React.ReactNode, center = false) => {
    if (!onSortChange) return content;
    const active = sortBy === key;
    return (
      <button
        type="button"
        onClick={() => onSortChange(key)}
        title={t("common.sort")}
        aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
        className={`group/sort flex items-center gap-2 w-full uppercase tracking-wider font-bold text-[12px] transition-colors hover:text-emerald-700 ${
          center ? "justify-center" : ""
        } ${active ? "text-emerald-700" : ""}`}
      >
        {content}
        <SortArrows active={active} dir={sortDir} />
      </button>
    );
  };

  return (
    <div className="w-full overflow-x-auto">
      <table className="min-w-full text-[13px] text-left border-collapse">
        <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600">
          <tr className="whitespace-nowrap">
            <th className="px-4 py-4 text-center text-[12px] font-bold uppercase tracking-wider w-10">#</th>
            <th className="px-4 py-4 text-left text-[12px] font-bold uppercase tracking-wider">
              {sortable("tripNo", <div className="flex items-center gap-1.5"><Hash size={14} className="text-slate-400 flex-shrink-0" /><span>{t("operations.trip_no")}</span></div>)}
            </th>
            <th className="px-4 py-4 text-left text-[12px] font-bold uppercase tracking-wider">
              {sortable("tripDate", <div className="flex items-center gap-1.5"><Calendar size={14} className="text-blue-500 flex-shrink-0" /><span>{t("ops.rate.col.day")}</span></div>)}
            </th>
            <th className="px-4 py-4 text-left text-[12px] font-bold uppercase tracking-wider">
              {sortable("vehicleNo", <div className="flex items-center gap-1.5"><Truck size={14} className="text-indigo-500 flex-shrink-0" /><span>{t("common.vehicle")}</span></div>)}
            </th>
            <th className="px-4 py-4 text-left text-[12px] font-bold uppercase tracking-wider">
              {sortable("supervisorName", <div className="flex items-center gap-1.5"><UserCog size={14} className="text-purple-500 flex-shrink-0" /><span>{t("common.supervisor")}</span></div>)}
            </th>
            <th className="px-4 py-4 text-left text-[12px] font-bold uppercase tracking-wider">
              {sortable("sourceFarm", <div className="flex items-center gap-1.5"><Warehouse size={14} className="text-amber-500 flex-shrink-0" /><span>{t("ops.trip.source_farm")}</span></div>)}
            </th>
            <th className="px-4 py-4 text-center text-[12px] font-bold uppercase tracking-wider">
              {sortable("totalShops", <div className="flex items-center justify-center gap-1.5"><ShoppingBag size={14} className="text-cyan-500 flex-shrink-0" /><span>{t("ops.trip.shops")}</span></div>, true)}
            </th>
            <th className="px-4 py-4 text-center text-[12px] font-bold uppercase tracking-wider">
              {sortable("totalBirds", <div className="flex items-center justify-center gap-1.5"><Bird size={14} className="text-blue-500 flex-shrink-0" /><span>{t("common.birds")}</span></div>, true)}
            </th>
            <th className="px-4 py-4 text-center text-[12px] font-bold uppercase tracking-wider">
              {sortable("totalWeight", <div className="flex items-center justify-center gap-1.5"><Scale size={14} className="text-orange-500 flex-shrink-0" /><span>{t("ops.trip.weight_kg")}</span></div>, true)}
            </th>
            <th className="px-4 py-4 text-center text-[12px] font-bold uppercase tracking-wider">
              <div className="flex items-center justify-center gap-1.5"><IndianRupee size={14} className="text-emerald-500 flex-shrink-0" /><span>{t("ops.rate.col.action")}</span></div>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {trips.length === 0 ? (
            <tr>
              <td colSpan={10} className="py-12 text-center text-slate-400 text-[13px] font-medium">
                {t("ops.rate.no_waiting_trips")}
              </td>
            </tr>
          ) : (
            trips.map((trip, index) => {
              const isLocked = trip.rateCompleted === true;
              const canModify = isLocked && isWithin10Days(trip.createdAt || "");
              const isReadOnly = isLocked && !canModify;
              const serialNo = startIndex + index + 1;
              const isSelected = trip.id === selectedRowId;
              const totalShops = trip.totalShops ?? 0;

              return (
                <tr
                  key={trip.id}
                  onClick={() => onRowClick?.(trip)}
                  className={`${onRowClick ? "cursor-pointer" : ""} border-t transition-colors duration-150 ${
                    isSelected
                      ? "bg-blue-50/70 border-l-4 border-l-blue-300 ring-1 ring-inset ring-blue-200"
                      : `${index % 2 === 0 ? "bg-white" : "bg-slate-50/20"} hover:bg-slate-50/60`
                  }`}
                >
                  <td className="px-4 py-4 text-center text-[13px] text-slate-500 font-medium w-10">
                    {isSelected ? <Check size={16} className="inline text-blue-500" /> : serialNo}
                  </td>
                  {/* Keep 2d logo in header but working start from name S */}
                  <td className="px-4 py-4 pl-9 font-bold text-emerald-600 text-[13px] whitespace-nowrap">{trip.tripNo}</td>
                  <td className="px-4 py-4 pl-9 text-[13px] font-bold text-slate-700 whitespace-nowrap">
                    {formatRateEntryDay(trip.tripDate, language)}
                  </td>
                  <td className="px-4 py-4 pl-9 text-[13px] font-bold text-slate-700 whitespace-nowrap">{formatVehicleNumber(trip.vehicleNo)}</td>
                  <td className="px-4 py-4 pl-9 text-[13px] font-bold text-slate-700 whitespace-nowrap">{displayRateEntryName(trip.supervisorName, language)}</td>
                  <td className="px-4 py-4 pl-9 text-[13px] font-bold text-slate-700 whitespace-nowrap">
                    {displayRateEntryName(trip.sourceFarm, language)}
                  </td>
                  <td className="px-4 py-4 text-center whitespace-nowrap">
                    <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[12px] font-bold text-slate-700">
                      {totalShops}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-center text-[13px] font-bold text-blue-600 whitespace-nowrap">
                    {trip.totalBirds.toLocaleString()}
                  </td>
                  <td className="px-4 py-4 text-center text-[13px] font-bold text-amber-600 whitespace-nowrap">{trip.totalWeight.toFixed(2)}</td>
                  <td className="px-4 py-4 text-center whitespace-nowrap">
                    {!isLocked ? (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onEnterRate(trip);
                        }}
                        className="group relative inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:border-emerald-300 hover:text-emerald-800 px-3.5 py-2 text-[13px] font-bold shadow-sm transition-all active:scale-95"
                        aria-label={`${t("ops.rate.enter_tooltip")} ${trip.tripNo}`}
                      >
                        <span className={`inline-flex ${uiActionIconMotionClass.edit}`}>
                          <IndianRupee size={15} />
                        </span>
                        {t("ops.rate.enter_rates")}
                        <ActionTooltip label={t("ops.rate.enter_tooltip")} />
                      </button>
                    ) : canModify ? (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onModifyRate(trip);
                        }}
                        className="group relative inline-flex items-center gap-1.5 rounded-xl border border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100 hover:border-orange-300 px-3.5 py-2 text-[13px] font-bold shadow-sm transition-all active:scale-95"
                        aria-label={`${t("ops.rate.modify_tooltip")} ${trip.tripNo}`}
                      >
                        <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full bg-orange-100 text-orange-600 ring-1 ring-orange-200 group-hover:bg-orange-200 ${uiActionIconMotionClass.edit}`}>
                          <Pencil size={13} />
                        </span>
                        {t("ops.rate.modify_rates")}
                        <ActionTooltip label={t("ops.rate.modify_tooltip")} />
                      </button>
                    ) : isReadOnly ? (
                      <span className="inline-flex items-center gap-1 rounded-xl bg-slate-100 text-slate-400 px-3 py-2 text-[13px] font-semibold cursor-not-allowed">
                        <Lock size={15} />
                        {t("ops.rate.locked")}
                      </span>
                    ) : null}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
        {trips.length > 0 && (
          <tfoot className="bg-gradient-to-r from-emerald-50/80 via-white to-amber-50/60 border-t-2 border-emerald-200">
            <tr className="font-bold">
              <td className="px-4 py-3 text-center text-[11px] text-slate-400">—</td>
              <td className="px-4 py-3 text-[13px] font-bold text-slate-800">Total: {trips.length} trips</td>
              <td className="px-4 py-3"></td>
              <td className="px-4 py-3"></td>
              <td className="px-4 py-3"></td>
              <td className="px-4 py-3"></td>
              <td className="px-4 py-3 text-center">
                <span className="inline-flex items-center rounded-full border border-slate-300 bg-white px-3 py-1 text-[12px] font-bold text-slate-800 shadow-sm">
                  {trips.reduce((sum, t) => sum + (t.totalShops ?? 0), 0)} shops
                </span>
              </td>
              <td className="px-4 py-3 text-center text-[13px] font-bold text-blue-700 tabular-nums">
                {trips.reduce((sum, t) => sum + (t.totalBirds ?? 0), 0).toLocaleString()} birds
              </td>
              <td className="px-4 py-3 text-center text-[13px] font-bold text-amber-700 tabular-nums">
                {trips.reduce((sum, t) => sum + (t.totalWeight ?? 0), 0).toFixed(2)} KG
              </td>
              <td className="px-4 py-3 text-center">
                <span className="inline-flex items-center rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 px-3 py-1.5 text-[13px] font-bold tabular-nums shadow-sm">
                  ₹ {trips.reduce((sum, t) => sum + t.deliveries.reduce((s, d) => s + (d.amount ?? 0), 0), 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </td>
            </tr>
          </tfoot>
        )}
      </table>
      {children && <div className="border-t border-slate-200 bg-slate-50/50 px-3 py-2">{children}</div>}
    </div>
  );
}

export default React.memo(CompletedTripsTable);
