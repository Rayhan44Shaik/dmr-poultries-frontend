import React from "react";
import { Check, Hash, Calendar, Truck, User, UserCog, Warehouse, Store, ShoppingBag, Bird, Scale, HeartPulse } from "lucide-react";
import type { Trip } from "../types/trip";

interface Props {
  trips: Trip[];
  selectedRowId?: number | null;
  onRowClick: (trip: Trip) => void;
  startIndex?: number; // ✅ add this
}

function TripMasterTable({ trips, selectedRowId, onRowClick, startIndex = 0 }: Props) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 border-b">
            <tr className="text-slate-700 whitespace-nowrap">
              <th className="px-2 py-2 text-center text-[10px] font-medium uppercase tracking-wider w-8">#</th>
              <th className="px-2 py-2 text-left text-[10px] font-medium uppercase tracking-wider">
                <div className="flex items-center gap-1">
                  <Hash size={14} className="text-slate-500 flex-shrink-0" />
                  <span>Trip No</span>
                </div>
              </th>
              <th className="px-2 py-2 text-left text-[10px] font-medium uppercase tracking-wider">
                <div className="flex items-center gap-1">
                  <Calendar size={14} className="text-blue-500 flex-shrink-0" />
                  <span>Date</span>
                </div>
              </th>
              <th className="px-2 py-2 text-left text-[10px] font-medium uppercase tracking-wider">
                <div className="flex items-center gap-1">
                  <Truck size={14} className="text-indigo-600 flex-shrink-0" />
                  <span>Vehicle</span>
                </div>
              </th>
              <th className="px-2 py-2 text-left text-[10px] font-medium uppercase tracking-wider">
                <div className="flex items-center gap-1">
                  <User size={14} className="text-green-600 flex-shrink-0" />
                  <span>Driver</span>
                </div>
              </th>
              <th className="px-2 py-2 text-left text-[10px] font-medium uppercase tracking-wider">
                <div className="flex items-center gap-1">
                  <UserCog size={14} className="text-purple-600 flex-shrink-0" />
                  <span>Supervisor</span>
                </div>
              </th>
              <th className="px-2 py-2 text-left text-[10px] font-medium uppercase tracking-wider">
                <div className="flex items-center gap-1">
                  <Warehouse size={14} className="text-amber-600 flex-shrink-0" />
                  <span>Source Farm</span>
                </div>
              </th>
              <th className="px-2 py-2 text-left text-[10px] font-medium uppercase tracking-wider">
                <div className="flex items-center gap-1">
                  <Store size={14} className="text-orange-500 flex-shrink-0" />
                  <span>Last Shop</span>
                </div>
              </th>
              <th className="px-2 py-2 text-center text-[10px] font-medium uppercase tracking-wider">
                <div className="flex items-center justify-center gap-1">
                  <ShoppingBag size={14} className="text-cyan-600 flex-shrink-0" />
                  <span>Shops</span>
                </div>
              </th>
              <th className="px-2 py-2 text-center text-[10px] font-medium uppercase tracking-wider">
                <div className="flex items-center justify-center gap-1">
                  <Bird size={14} className="text-blue-500 flex-shrink-0" />
                  <span>Birds</span>
                </div>
              </th>
              <th className="px-2 py-2 text-center text-[10px] font-medium uppercase tracking-wider">
                <div className="flex items-center justify-center gap-1">
                  <Scale size={14} className="text-orange-600 flex-shrink-0" />
                  <span>Weight (KG)</span>
                </div>
              </th>
              <th className="px-2 py-2 text-center text-[10px] font-medium uppercase tracking-wider">
                <div className="flex items-center justify-center gap-1">
                  <HeartPulse size={14} className="text-red-500 flex-shrink-0" />
                  <span>Mortality</span>
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {trips.length === 0 ? (
              <tr>
                <td colSpan={12} className="py-10 text-center text-slate-400 text-sm">
                  No completed trips found.
                </td>
              </tr>
            ) : (
              trips.map((trip, index) => {
                const isSelected = trip.id === selectedRowId;
                const serialNo = startIndex + index + 1; // ✅ global serial number
                return (
                  <tr
                    key={trip.id}
                    onClick={() => onRowClick(trip)}
                    className={`border-t cursor-pointer transition-all duration-150 ${
                      isSelected
                        ? "bg-blue-100 border-l-4 border-l-blue-600"
                        : "hover:bg-blue-50"
                    } ${index % 2 === 0 ? "bg-white" : "bg-slate-50/40"}`}
                  >
                    <td className="px-2 py-2 text-center text-xs text-slate-600 w-8">
                      {isSelected ? <Check size={16} className="text-blue-600 inline" /> : serialNo}
                    </td>
                    <td className="px-2 py-2 font-semibold text-green-700 text-xs whitespace-nowrap">{trip.tripNo}</td>
                    <td className="px-2 py-2 text-xs whitespace-nowrap">{trip.tripDate}</td>
                    <td className="px-2 py-2 text-xs text-slate-700 whitespace-nowrap">{trip.vehicleNo}</td>
                    <td className="px-2 py-2 text-xs whitespace-nowrap">{trip.driverName}</td>
                    <td className="px-2 py-2 text-xs whitespace-nowrap">{trip.supervisorName}</td>
                    <td className="px-2 py-2 text-xs whitespace-nowrap">{trip.sourceFarm}</td>
                    <td className="px-2 py-2 text-xs whitespace-nowrap">
                      {trip.deliveries.length > 0 ? trip.deliveries[trip.deliveries.length - 1].shopName : "--"}
                    </td>
                    <td className="px-2 py-2 text-center text-xs font-semibold whitespace-nowrap">{trip.totalShops}</td>
                    <td className="px-2 py-2 text-center text-xs font-semibold text-blue-700 whitespace-nowrap">{trip.totalBirds.toLocaleString()}</td>
                    <td className="px-2 py-2 text-center text-xs font-semibold text-orange-600 whitespace-nowrap">{trip.totalWeight.toFixed(2)}</td>
                    <td className="px-2 py-2 text-center text-xs font-semibold text-red-600 whitespace-nowrap">{trip.totalMortality}</td>
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