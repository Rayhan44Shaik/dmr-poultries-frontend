// src/modules/order/components/RouteCalculationCard.tsx
// Route calculation summary for a single selected route. Distance / ETA are
// frontend estimates and are clearly labelled as such.

import { memo } from "react";
import type { DeliveryRoute } from "../types/routeTypes";
import { formatClock, parseHHmm } from "../utils/businessTime";
import { formatDistanceKm, formatTravelMinutes } from "../utils/orderFormat";

const LEVEL_STYLES: Record<string, string> = {
  HIGH: "bg-rose-50 text-rose-700 border-rose-200",
  MEDIUM: "bg-amber-50 text-amber-700 border-amber-200",
  LOW: "bg-slate-100 text-slate-600 border-slate-200",
};

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5">
      <span className="text-xs text-slate-400">{label}</span>
      <span className="text-right text-xs font-medium text-slate-700">{value}</span>
    </div>
  );
}

function RouteCalculationCard({ route }: { route: DeliveryRoute }) {
  const departureMinutes = parseHHmm(route.schedule.departureTime);
  const finalArrival =
    departureMinutes != null && route.estimatedTravelMinutes != null
      ? formatClock(departureMinutes + route.estimatedTravelMinutes)
      : "—";

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-3.5">
        <h3 className="text-sm font-bold text-slate-800">Route Calculation</h3>
        <p className="text-[11px] text-slate-400">Recommended route — frontend estimate</p>
      </div>

      <div className="px-5 py-3">
        <Row label="Pickup" value={`${route.pickup.farmName} (${route.pickup.location})`} />
        <Row label="Vehicle" value={`${route.vehicleNo} · ${route.driverName}`} />
        <Row label="Departure" value={route.schedule.departureTime} />
        <Row label="Stops" value={String(route.stops.length)} />
        <Row label="Total Birds" value={route.totalBirds.toLocaleString("en-IN")} />
        <Row label="Total Boxes" value={String(route.totalBoxes)} />
        <Row label="Estimated Distance" value={route.totalDistanceKm != null ? formatDistanceKm(route.totalDistanceKm) : "Pending"} />
        <Row label="Travel Time" value={formatTravelMinutes(route.estimatedTravelMinutes)} />
        <Row label="Final Arrival" value={finalArrival} />
      </div>

      <div className="border-t border-slate-100 px-5 py-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-400">Route Priority</span>
          <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${LEVEL_STYLES[route.routePriority]}`}>
            {route.routePriority}
          </span>
        </div>
        <ul className="mt-2 space-y-0.5">
          {route.priorityReasons.map((reason) => (
            <li key={reason} className="flex items-start gap-1.5 text-xs text-slate-600">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-slate-400" />
              {reason}
            </li>
          ))}
        </ul>
      </div>

      <div className="border-t border-slate-100 bg-slate-50/60 px-5 py-2.5 text-[11px] text-slate-400">
        Distance and ETA are straight-line estimates — real road routing not yet connected.
      </div>
    </div>
  );
}

export default memo(RouteCalculationCard);
