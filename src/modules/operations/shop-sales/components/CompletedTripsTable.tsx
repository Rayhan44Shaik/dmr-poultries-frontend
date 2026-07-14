import { DollarSign, Pencil, Lock } from "lucide-react";
import type { Trip } from "../../vehicle-trips/types/trip.ts";

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
}

export default function CompletedTripsTable({ trips, onEnterRate, onModifyRate }: Props) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 border-b">
            <tr className="text-slate-700 whitespace-nowrap">
              <th className="px-3 py-2 text-center text-[10px] font-medium uppercase tracking-wider">S.No</th>
              <th className="px-3 py-2 text-left text-[10px] font-medium uppercase tracking-wider">Trip No</th>
              <th className="px-3 py-2 text-left text-[10px] font-medium uppercase tracking-wider">Date</th>
              <th className="px-3 py-2 text-left text-[10px] font-medium uppercase tracking-wider">Vehicle</th>
              <th className="px-3 py-2 text-left text-[10px] font-medium uppercase tracking-wider">Supervisor</th>
              <th className="px-3 py-2 text-left text-[10px] font-medium uppercase tracking-wider">Farm</th>
              <th className="px-3 py-2 text-center text-[10px] font-medium uppercase tracking-wider">Shops</th>
              <th className="px-3 py-2 text-center text-[10px] font-medium uppercase tracking-wider">Birds</th>
              <th className="px-3 py-2 text-center text-[10px] font-medium uppercase tracking-wider">Weight</th>
              <th className="px-3 py-2 text-center text-[10px] font-medium uppercase tracking-wider">Action</th>
            </tr>
          </thead>
          <tbody>
            {trips.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-10 text-center text-slate-400 text-sm">
                  No trips waiting for rate entry.
                </td>
              </tr>
            ) : (
              trips.map((trip, index) => {
                const isLocked = trip.rateCompleted === true;
                const canModify = isLocked && isWithin10Days(trip.createdAt || "");
                const isReadOnly = isLocked && !canModify;

                return (
                  <tr key={trip.id} className="border-t hover:bg-blue-50 transition-colors">
                    <td className="px-3 py-2 text-center text-xs text-slate-600">{index + 1}</td>
                    <td className="px-3 py-2 font-semibold text-green-700 text-xs">{trip.tripNo}</td>
                    <td className="px-3 py-2 text-xs">{trip.tripDate}</td>
                    <td className="px-3 py-2 text-xs text-slate-700">{trip.vehicleNo}</td>
                    <td className="px-3 py-2 text-xs">{trip.supervisorName}</td>
                    <td className="px-3 py-2 text-xs">{trip.sourceFarm}</td>
                    <td className="px-3 py-2 text-center text-xs font-semibold">{trip.totalShops}</td>
                    <td className="px-3 py-2 text-center text-xs font-semibold text-blue-700">{trip.totalBirds.toLocaleString()}</td>
                    <td className="px-3 py-2 text-center text-xs font-semibold text-orange-600">{trip.totalWeight.toFixed(2)}</td>
                    <td className="px-3 py-2 text-center">
                      {!isLocked ? (
                        // Enter Rates – always enabled for un-locked trips
                        <button
                          onClick={() => onEnterRate(trip)}
                          className="inline-flex items-center gap-1 rounded-lg bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 text-xs font-medium transition-colors"
                        >
                          <DollarSign size={14} />
                          Enter Rates
                        </button>
                      ) : canModify ? (
                        // Modify Rates – within 10 days
                        <button
                          onClick={() => onModifyRate(trip)}
                          className="inline-flex items-center gap-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 text-xs font-medium transition-colors"
                        >
                          <Pencil size={14} />
                          Modify Rates
                        </button>
                      ) : isReadOnly ? (
                        // Read-only – older than 10 days
                        <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 text-slate-400 px-3 py-1.5 text-xs font-medium cursor-not-allowed">
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
    </div>
  );
}