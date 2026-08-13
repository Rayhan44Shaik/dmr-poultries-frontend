import React from "react";
import { Check, Hash, Calendar, Truck, User, UserCog, Warehouse, Store, ShoppingBag, Bird, Scale, HeartPulse, History } from "lucide-react";
import type { Trip } from "../types/trip";

interface Props {
  trips: Trip[];
  selectedRowId?: number | null;
  onRowClick: (trip: Trip) => void;
  startIndex?: number;
}

const dayLabel = (dateStr?: string): string => {
  if (!dateStr) return "-";
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-GB", { weekday: "short" }).toUpperCase();
};

function TripMasterTable({ trips, selectedRowId, onRowClick, startIndex = 0 }: Props) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xl shadow-slate-100 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm text-left border-collapse">
          <thead className="bg-gradient-to-r from-slate-50 via-white to-slate-50 border-b border-slate-100 text-slate-600">
            <tr>
              <th className="px-4 py-3 text-center text-[11px] font-bold uppercase tracking-wider whitespace-nowrap w-10">#</th>
              <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider whitespace-nowrap">
                <div className="flex items-center gap-1.5">
                  <Hash size={13} className="text-slate-400 flex-shrink-0" />
                  <span>Trip No</span>
                </div>
              </th>
              <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider whitespace-nowrap">
                <div className="flex items-center gap-1.5">
                  <Calendar size={13} className="text-blue-500 flex-shrink-0" />
                  <span>Day</span>
                </div>
              </th>
              <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider whitespace-nowrap">
                <div className="flex items-center gap-1.5">
                  <Truck size={13} className="text-indigo-500 flex-shrink-0" />
                  <span>Vehicle</span>
                </div>
              </th>
              <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider whitespace-nowrap">
                <div className="flex items-center gap-1.5">
                  <User size={13} className="text-emerald-500 flex-shrink-0" />
                  <span>Driver</span>
                </div>
              </th>
              <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider whitespace-nowrap">
                <div className="flex items-center gap-1.5">
                  <UserCog size={13} className="text-purple-500 flex-shrink-0" />
                  <span>Supervisor</span>
                </div>
              </th>
              <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider whitespace-nowrap">
                <div className="flex items-center gap-1.5">
                  <Warehouse size={13} className="text-amber-500 flex-shrink-0" />
                  <span>Source Farm</span>
                </div>
              </th>
              <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider whitespace-nowrap">
                <div className="flex items-center gap-1.5">
                  <Store size={13} className="text-orange-500 flex-shrink-0" />
                  <span>Last Shop</span>
                </div>
              </th>
              <th className="px-4 py-3 text-center text-[11px] font-bold uppercase tracking-wider whitespace-nowrap">
                <div className="flex items-center justify-center gap-1.5">
                  <ShoppingBag size={13} className="text-cyan-500 flex-shrink-0" />
                  <span>Shops</span>
                </div>
              </th>
              <th className="px-4 py-3 text-center text-[11px] font-bold uppercase tracking-wider whitespace-nowrap">
                <div className="flex items-center justify-center gap-1.5">
                  <Bird size={13} className="text-blue-500 flex-shrink-0" />
                  <span>Birds</span>
                </div>
              </th>
              <th className="px-4 py-3 text-center text-[11px] font-bold uppercase tracking-wider whitespace-nowrap">
                <div className="flex items-center justify-center gap-1.5">
                  <Scale size={13} className="text-orange-500 flex-shrink-0" />
                  <span>Weight (KG)</span>
                </div>
              </th>
              <th className="px-4 py-3 text-center text-[11px] font-bold uppercase tracking-wider whitespace-nowrap">
                <div className="flex items-center justify-center gap-1.5">
                  <HeartPulse size={13} className="text-rose-500 flex-shrink-0" />
                  <span>Mortality</span>
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {trips.length === 0 ? (
              <tr>
                <td colSpan={12} className="py-16 text-center text-slate-400 text-xs font-medium">
                  <History size={24} className="mx-auto mb-2 opacity-50" />
                  No completed trips found matching your criteria.
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
                    className={`cursor-pointer transition-all duration-150 group ${
                      isSelected
                        ? "bg-blue-50/80 shadow-inner border-l-4 border-l-blue-600"
                        : "hover:bg-slate-50/80 border-l-4 border-l-transparent"
                    }`}
                  >
                    <td className="px-4 py-3 text-center text-xs text-slate-500 font-medium w-10 whitespace-nowrap">
                      {isSelected ? <Check size={15} className="text-blue-600 inline" /> : serialNo}
                    </td>

                    <td className="px-4 py-3 text-left whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <div className="w-[13px] shrink-0" />
                        <span className="bg-emerald-50 px-2 py-1 rounded-md border border-emerald-100/80 font-bold text-emerald-700 text-xs">
                          {trip.tripNo}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-left whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <div className="w-[13px] shrink-0" />
                        <span className="text-xs font-medium text-slate-600">{dayLabel(trip.tripDate)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-left whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <div className="w-[13px] shrink-0" />
                        <span className="text-xs font-medium text-slate-700">{trip.vehicleNo}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-left whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <div className="w-[13px] shrink-0" />
                        <span className="text-xs text-slate-600">{trip.driverName || "-"}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-left whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <div className="w-[13px] shrink-0" />
                        <span className="text-xs text-slate-600">{trip.supervisorName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-left whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <div className="w-[13px] shrink-0" />
                        <span className="text-xs font-medium text-slate-600">{trip.sourceFarm}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-left whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <div className="w-[13px] shrink-0" />
                        <span className="text-xs text-slate-600">
                          {trip.deliveries.length > 0 ? trip.deliveries[trip.deliveries.length - 1].shopName : "--"}
                        </span>
                      </div>
                    </td>

                    <td className="px-4 py-3 text-center text-xs font-bold text-slate-700 whitespace-nowrap">{trip.totalShops}</td>
                    <td className="px-4 py-3 text-center text-xs font-bold text-blue-700 whitespace-nowrap">{trip.totalBirds.toLocaleString()}</td>
                    <td className="px-4 py-3 text-center text-xs font-bold text-amber-600 whitespace-nowrap">{trip.totalWeight.toFixed(2)}</td>
                    <td className="px-4 py-3 text-center text-xs font-bold text-rose-600 whitespace-nowrap">{trip.totalMortality}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default React.memo(TripMasterTable);