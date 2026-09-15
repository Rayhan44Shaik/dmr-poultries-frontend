import React from "react";
import { Check, Hash, Calendar, Truck, User, UserCog, Warehouse, ShoppingBag, Bird, Scale, HeartPulse, ArrowUp, ArrowDown } from "lucide-react";
import type { Trip } from "../types/trip";
import { formatTripListDay } from "../utils/formatTripListDay";
import { localizeTripViewText } from "../utils/tripViewLocalization";
import { formatVehicleNumber } from "../../../../utils/format";
import { useI18n } from "../../../../i18n";

export type TripSortKey =
  | "tripNo"
  | "tripDate"
  | "vehicleNo"
  | "driverName"
  | "supervisorName"
  | "sourceFarm"
  | "totalShops"
  | "totalBirds"
  | "totalWeight"
  | "totalMortality";

interface Props {
  trips: Trip[];
  /** Keep the table surface informative while its server records are loading. */
  isLoading?: boolean;
  /** A searched trip/reference, when the caller has one, for useful context. */
  loadingReference?: string;
  selectedRowId?: number | null;
  onRowClick: (trip: Trip) => void;
  startIndex?: number;
  sortBy?: TripSortKey | null;
  sortDir?: "asc" | "desc";
  onSortChange?: (key: TripSortKey) => void;
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

function TripMasterTable({
  trips,
  isLoading = false,
  loadingReference,
  selectedRowId,
  onRowClick,
  startIndex = 0,
  sortBy = null,
  sortDir = "asc",
  onSortChange,
}: Props) {
  const { t, language } = useI18n();

  const sortable = (key: TripSortKey, content: React.ReactNode, center = false) => {
    if (!onSortChange) return content;
    const active = sortBy === key;
    return (
      <button
        type="button"
        onClick={() => onSortChange(key)}
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
                {sortable("tripNo", <div className="flex items-center gap-1.5">
                  <Hash size={14} className="text-slate-400 flex-shrink-0" />
                  <span>{t("operations.trip_no")}</span>
                </div>)}
              </th>
              <th className="px-4 py-4 text-left text-[12px] font-bold uppercase tracking-wider">
                {sortable("tripDate", <div className="flex items-center gap-1.5">
                  <Calendar size={14} className="text-blue-500 flex-shrink-0" />
                  <span>{t("ops.trip.day")}</span>
                </div>)}
              </th>
              <th className="px-4 py-4 text-left text-[12px] font-bold uppercase tracking-wider">
                {sortable("vehicleNo", <div className="flex items-center gap-1.5">
                  <Truck size={14} className="text-indigo-500 flex-shrink-0" />
                  <span>{t("common.vehicle")}</span>
                </div>)}
              </th>
              <th className="px-4 py-4 text-left text-[12px] font-bold uppercase tracking-wider">
                {sortable("driverName", <div className="flex items-center gap-1.5">
                  <User size={14} className="text-emerald-500 flex-shrink-0" />
                  <span>{t("common.driver")}</span>
                </div>)}
              </th>
              <th className="px-4 py-4 text-left text-[12px] font-bold uppercase tracking-wider">
                {sortable("supervisorName", <div className="flex items-center gap-1.5">
                  <UserCog size={14} className="text-purple-500 flex-shrink-0" />
                  <span>{t("common.supervisor")}</span>
                </div>)}
              </th>
              <th className="px-4 py-4 text-left text-[12px] font-bold uppercase tracking-wider">
                {sortable("sourceFarm", <div className="flex items-center gap-1.5">
                  <Warehouse size={14} className="text-amber-500 flex-shrink-0" />
                  <span>{t("ops.trip.source_farm")}</span>
                </div>)}
              </th>
              <th className="px-4 py-4 text-center text-[12px] font-bold uppercase tracking-wider">
                {sortable("totalShops", <div className="flex items-center justify-center gap-1.5">
                  <ShoppingBag size={14} className="text-cyan-500 flex-shrink-0" />
                  <span>{t("ops.trip.shops")}</span>
                </div>, true)}
              </th>
              <th className="px-4 py-4 text-center text-[12px] font-bold uppercase tracking-wider">
                {sortable("totalBirds", <div className="flex items-center justify-center gap-1.5">
                  <Bird size={14} className="text-blue-500 flex-shrink-0" />
                  <span>{t("common.birds")}</span>
                </div>, true)}
              </th>
              <th className="px-4 py-4 text-center text-[12px] font-bold uppercase tracking-wider">
                {sortable("totalWeight", <div className="flex items-center justify-center gap-1.5">
                  <Scale size={14} className="text-orange-500 flex-shrink-0" />
                  <span>{t("ops.trip.weight_kg")}</span>
                </div>, true)}
              </th>
              <th className="px-4 py-4 text-center text-[12px] font-bold uppercase tracking-wider">
                {sortable("totalMortality", <div className="flex items-center justify-center gap-1.5">
                  <HeartPulse size={14} className="text-rose-500 flex-shrink-0" />
                  <span>{t("operations.mortality_count")}</span>
                </div>, true)}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <tr>
                <td colSpan={11} className="px-4 py-14 text-center">
                  <div className="inline-flex flex-col items-center gap-2 text-slate-500">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-emerald-100 bg-emerald-50 text-emerald-600">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-200 border-t-emerald-600" aria-hidden="true" />
                    </span>
                    <p className="text-sm font-bold text-slate-700">{t("ops.trip.loading_trip_list")}</p>
                    <p className="text-xs font-medium text-slate-500">
                      {loadingReference
                        ? t("ops.trip.loading_reference", { reference: loadingReference })
                        : t("ops.trip.loading_trip_list_hint")}
                    </p>
                  </div>
                </td>
              </tr>
            ) : trips.length === 0 ? (
              <tr>
                <td colSpan={11} className="py-12 text-center text-slate-400 text-[13px] font-medium">
                  {t("ops.trip.no_completed_trips")}
                </td>
              </tr>
            ) : (
              trips.map((trip, index) => {
                const isSelected = trip.id === selectedRowId;
                const serialNo = startIndex + index + 1;
                return (
                  <tr
                    key={trip.id}
                    onClick={() => onRowClick(trip)}
                    className={`cursor-pointer transition-colors duration-150 ${
                      isSelected
                        ? "bg-blue-50/70 border-l-4 border-l-blue-300 ring-1 ring-inset ring-blue-200"
                        : `hover:bg-slate-50/60 ${index % 2 === 0 ? "bg-white" : "bg-slate-50/20"}`
                    }`}
                  >
                    <td className="px-4 py-5 text-center text-[13px] text-slate-500 font-medium w-10">
                      {isSelected ? <Check size={16} className="text-blue-500 inline" /> : serialNo}
                    </td>
                    {/* Keep logo in header, but working start from name of columns — S for Supervisor etc. */}
                    <td className="px-4 py-5 pl-9 font-bold text-emerald-600 text-[13px] whitespace-nowrap">{localizeTripViewText(trip.tripNo, language)}</td>
                    <td className="px-4 py-5 pl-9 text-[13px] font-medium text-slate-600 whitespace-nowrap">{formatTripListDay(trip.tripDate, language)}</td>
                    <td className="px-4 py-5 pl-9 text-[13px] font-medium text-slate-700 whitespace-nowrap">{localizeTripViewText(formatVehicleNumber(trip.vehicleNo), language)}</td>
                    <td className="px-4 py-5 pl-9 text-[13px] text-slate-600 whitespace-nowrap">{localizeTripViewText(trip.driverName, language) || "-"}</td>
                    <td className="px-4 py-5 pl-9 text-[13px] text-slate-600 whitespace-nowrap">{localizeTripViewText(trip.supervisorName, language)}</td>
                    <td className="px-4 py-5 pl-9 text-[13px] text-slate-600 font-medium whitespace-nowrap">{localizeTripViewText(trip.sourceFarm, language)}</td>
                    <td className="px-4 py-5 text-center text-[13px] font-bold text-slate-700 whitespace-nowrap">{trip.totalShops}</td>
                    <td className="px-4 py-5 text-center text-[13px] font-bold text-blue-600 whitespace-nowrap">{trip.totalBirds.toLocaleString()}</td>
                    <td className="px-4 py-5 text-center text-[13px] font-bold text-amber-600 whitespace-nowrap">{trip.totalWeight.toFixed(2)}</td>
                    <td className="px-4 py-5 text-center text-[13px] font-bold text-rose-600 whitespace-nowrap">{trip.totalMortality}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
    </div>
  );
}

export default React.memo(TripMasterTable);
