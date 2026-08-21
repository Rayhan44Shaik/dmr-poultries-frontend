// src/modules/order/components/VehicleTripsTab.tsx
// Active Vehicle Trips dashboard — reads REAL trips from Trip Entry and overlays
// Order-module shop assignments. Never fabricates vehicle/trip data.

import { useMemo } from "react";
import { Clock, MapPin, Route, PackageCheck, Truck, User } from "lucide-react";
import { getActiveTrips, summarizeActiveTrip, type ActiveTripSummary } from "../services/tripIntegrationService";
import { useOrders } from "../store/orderContext";
import EmptyState from "./EmptyState";
import GPSStatus from "./GPSStatus";
import type { OrderTabKey } from "./OrderTabs";

interface VehicleTripsTabProps {
  onNavigate: (tab: OrderTabKey) => void;
}

export default function VehicleTripsTab({ onNavigate }: VehicleTripsTabProps) {
  const { orders } = useOrders();

  const assignedByVehicle = useMemo(() => {
    const map = new Map<string, number>();
    for (const o of orders) {
      if (o.vehicleAssignment) {
        map.set(o.vehicleAssignment.vehicleNo, (map.get(o.vehicleAssignment.vehicleNo) ?? 0) + 1);
      }
    }
    return map;
  }, [orders]);

  const trips = useMemo<ActiveTripSummary[]>(() => {
    return getActiveTrips().map((trip) => summarizeActiveTrip(trip, (vehicleNo) => assignedByVehicle.get(vehicleNo) ?? 0));
  }, [assignedByVehicle]);

  if (trips.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <EmptyState
          icon={Truck}
          title="No active vehicle trips"
          description="Create a trip in Trip Entry, complete Step 2 (farm/pickup), and submit it — active trips will appear here for shop assignment."
        />
      </div>
    );
  }

  return (
    <div>
      <h2 className="mb-3 text-sm font-bold text-slate-700">Active Vehicle Trips</h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {trips.map((t) => (
          <div key={t.trip.id} className="flex flex-col rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-semibold text-slate-500">{t.tripNo}</span>
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">Active</span>
            </div>

            <div className="mt-2 flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                <Truck size={18} />
              </span>
              <div>
                <p className="text-base font-bold text-slate-800">{t.vehicleNo}</p>
                <p className="text-[11px] text-slate-400">{t.tripStatus}</p>
              </div>
            </div>

            <div className="mt-3 space-y-1.5 text-xs text-slate-600">
              <p className="flex items-center gap-1.5"><User size={13} className="text-slate-400" />{t.driverName} — Driver</p>
              <p className="flex items-center gap-1.5"><User size={13} className="text-slate-400" />{t.supervisorName} — Supervisor</p>
              <p className="flex items-center gap-1.5"><MapPin size={13} className="text-slate-400" />{t.pickupFarm}</p>
              <p className="flex items-center gap-1.5"><Clock size={13} className="text-slate-400" />Departure: {t.departureTime}</p>
            </div>

            <div className="mt-2">
              <GPSStatus gps={t.vehicle.currentGps} status={t.vehicle.currentGpsStatus} label="Pickup GPS" />
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2 border-t border-slate-100 pt-3 text-center">
              <Stat label="Assigned Shops" value={String(t.totalAssignedShops)} />
              <Stat label="Remaining Birds" value={t.remainingBirds != null ? t.remainingBirds.toLocaleString("en-IN") : "—"} />
              <Stat label="Remaining Boxes" value={t.remainingBoxes != null ? String(t.remainingBoxes) : "—"} />
            </div>

            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => onNavigate("planning")}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50"
              >
                <Route size={13} />
                View Route
              </button>
              <button
                type="button"
                onClick={() => onNavigate("assignment")}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-brand-700"
              >
                <PackageCheck size={13} />
                Assign Shop
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="text-sm font-bold text-slate-700">{value}</p>
    </div>
  );
}
