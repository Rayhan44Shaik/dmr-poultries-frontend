import React from "react";
import { Check, Hash, Calendar, Truck, User, UserCog, Warehouse, Store, ShoppingBag, Bird, Scale, HeartPulse } from "lucide-react";
import type { Trip } from "../types/trip";
import { formatTripListDay } from "../utils/formatTripListDay";
import { useI18n } from "../../../../i18n";

interface Props {
  trips: Trip[];
  selectedRowId?: number | null;
  onRowClick: (trip: Trip) => void;
  startIndex?: number;
}

function TripMasterTable({ trips, selectedRowId, onRowClick, startIndex = 0 }: Props) {
  const { t } = useI18n();
  return (
    <div className="w-full overflow-x-auto">
      <table className="min-w-full text-sm text-left border-collapse">
        <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600">
            <tr className="whitespace-nowrap">
              <th className="px-4 py-3 text-center text-[11px] font-bold uppercase tracking-wider w-10">#</th>
              <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider">
                <div className="flex items-center gap-1.5">
                  <Hash size={13} className="text-slate-400 flex-shrink-0" />
                  <span>{t("operations.trip_no")}</span>
                </div>
              </th>
              <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider">
                <div className="flex items-center gap-1.5">
                  <Calendar size={13} className="text-blue-500 flex-shrink-0" />
                  <span>{t("ops.trip.day")}</span>
                </div>
              </th>
              <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider">
                <div className="flex items-center gap-1.5">
                  <Truck size={13} className="text-indigo-500 flex-shrink-0" />
                  <span>{t("common.vehicle")}</span>
                </div>
              </th>
              <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider">
                <div className="flex items-center gap-1.5">
                  <User size={13} className="text-emerald-500 flex-shrink-0" />
                  <span>{t("common.driver")}</span>
                </div>
              </th>
              <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider">
                <div className="flex items-center gap-1.5">
                  <UserCog size={13} className="text-purple-500 flex-shrink-0" />
                  <span>{t("common.supervisor")}</span>
                </div>
              </th>
              <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider">
                <div className="flex items-center gap-1.5">
                  <Warehouse size={13} className="text-amber-500 flex-shrink-0" />
                  <span>{t("ops.trip.source_farm")}</span>
                </div>
              </th>
              <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider">
                <div className="flex items-center gap-1.5">
                  <Store size={13} className="text-orange-500 flex-shrink-0" />
                  <span>{t("ops.trip.last_shop")}</span>
                </div>
              </th>
              <th className="px-4 py-3 text-center text-[11px] font-bold uppercase tracking-wider">
                <div className="flex items-center justify-center gap-1.5">
                  <ShoppingBag size={13} className="text-cyan-500 flex-shrink-0" />
                  <span>{t("ops.trip.shops")}</span>
                </div>
              </th>
              <th className="px-4 py-3 text-center text-[11px] font-bold uppercase tracking-wider">
                <div className="flex items-center justify-center gap-1.5">
                  <Bird size={13} className="text-blue-500 flex-shrink-0" />
                  <span>{t("common.birds")}</span>
                </div>
              </th>
              <th className="px-4 py-3 text-center text-[11px] font-bold uppercase tracking-wider">
                <div className="flex items-center justify-center gap-1.5">
                  <Scale size={13} className="text-orange-500 flex-shrink-0" />
                  <span>{t("ops.trip.weight_kg")}</span>
                </div>
              </th>
              <th className="px-4 py-3 text-center text-[11px] font-bold uppercase tracking-wider">
                <div className="flex items-center justify-center gap-1.5">
                  <HeartPulse size={13} className="text-rose-500 flex-shrink-0" />
                  <span>{t("operations.mortality_count")}</span>
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {trips.length === 0 ? (
              <tr>
                <td colSpan={12} className="py-12 text-center text-slate-400 text-xs font-medium">
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
                    className={`cursor-pointer transition-all duration-150 ${
                      isSelected
                        ? "bg-blue-50/85 border-l-4 border-l-blue-600 shadow-sm"
                        : "hover:bg-slate-50/60"
                    } ${index % 2 === 0 ? "bg-white" : "bg-slate-50/20"}`}
                  >
                    <td className="px-4 py-3 text-center text-xs text-slate-500 font-medium w-10">
                      {isSelected ? <Check size={15} className="text-blue-500 inline" /> : serialNo}
                    </td>
                    <td className="px-4 py-3 font-bold text-emerald-500 text-xs whitespace-nowrap">
                      {trip.tripNo}
                    </td>
                    <td className="px-4 py-3 text-xs font-medium text-slate-600 whitespace-nowrap">{formatTripListDay(trip.tripDate)}</td>
                    <td className="px-4 py-3 text-xs font-medium text-slate-700 whitespace-nowrap">{trip.vehicleNo}</td>
                    <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">{trip.driverName || "-"}</td>
                    <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">{trip.supervisorName}</td>
                    <td className="px-4 py-3 text-xs text-slate-600 font-medium whitespace-nowrap">{trip.sourceFarm}</td>
                    <td className="px-4 py-3 text-xs font-medium text-slate-600 whitespace-nowrap">
                      {trip.lastShop || (trip.deliveries?.length ? trip.deliveries[trip.deliveries.length - 1].shopName : "--")}
                    </td>
                    <td className="px-4 py-3 text-center text-xs font-bold text-slate-700 whitespace-nowrap">{trip.totalShops}</td>
                    <td className="px-4 py-3 text-center text-xs font-bold text-blue-500 whitespace-nowrap">{trip.totalBirds.toLocaleString()}</td>
                    <td className="px-4 py-3 text-center text-xs font-bold text-amber-500 whitespace-nowrap">{trip.totalWeight.toFixed(2)}</td>
                    <td className="px-4 py-3 text-center text-xs font-bold text-rose-500 whitespace-nowrap">{trip.totalMortality}</td>
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