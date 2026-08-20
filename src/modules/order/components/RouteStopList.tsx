// src/modules/order/components/RouteStopList.tsx
// Ordered delivery stops for a route, plus route totals.

import { memo } from "react";
import type { DeliveryRoute, RoutePriorityLevel } from "../types/routeTypes";
import PriorityBadge from "./PriorityBadge";
import { formatDistanceKm } from "../utils/orderFormat";

const LEVEL_STYLES: Record<RoutePriorityLevel, string> = {
  HIGH: "bg-rose-50 text-rose-700 border-rose-200",
  MEDIUM: "bg-amber-50 text-amber-700 border-amber-200",
  LOW: "bg-slate-100 text-slate-600 border-slate-200",
};

function RouteStopList({ route }: { route: DeliveryRoute }) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
        <div>
          <h3 className="text-sm font-bold text-slate-800">VEHICLE {route.vehicleNo}</h3>
          <p className="text-xs text-slate-400">
            Pickup: {route.pickup.farmName} · {route.driverName} · {route.supervisorName}
          </p>
        </div>
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${LEVEL_STYLES[route.routePriority]}`}>
          Route Priority: {route.routePriority}
        </span>
      </div>

      {/* Priority reasons */}
      <div className="border-b border-slate-100 bg-slate-50/60 px-5 py-2.5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Reasons</p>
        <ul className="mt-1 space-y-0.5">
          {route.priorityReasons.map((reason) => (
            <li key={reason} className="flex items-start gap-1.5 text-xs text-slate-600">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-slate-400" />
              {reason}
            </li>
          ))}
        </ul>
      </div>

      {/* Stops */}
      <div className="divide-y divide-slate-100">
        {route.stops.length === 0 ? (
          <p className="px-5 py-8 text-center text-xs text-slate-400">No stops assigned to this route.</p>
        ) : (
          route.stops.map((stop) => (
            <div key={stop.orderId} className="flex items-center gap-3 px-5 py-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">
                {stop.stopNumber}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-800">{stop.shopName}</p>
                <p className="text-[11px] text-slate-400">
                  {stop.birds.toLocaleString("en-IN")} birds · {stop.boxes} boxes · {stop.deadline}
                </p>
              </div>
              <PriorityBadge priority={stop.priority} />
              <span className="w-16 text-right text-xs font-medium text-slate-600">
                {stop.legDistanceKm != null ? formatDistanceKm(stop.legDistanceKm) : "Pending"}
              </span>
            </div>
          ))
        )}
      </div>

      {/* Totals */}
      <div className="grid grid-cols-2 gap-px border-t border-slate-100 bg-slate-100 sm:grid-cols-3">
        <Total label="Total Distance" value={route.totalDistanceKm != null ? formatDistanceKm(route.totalDistanceKm) : "Pending"} />
        <Total label="Est. Travel Time" value={route.estimatedTravelMinutes != null ? `~${route.estimatedTravelMinutes}m` : "Pending"} />
        <Total label="Stops" value={String(route.stops.length)} />
        <Total label="Total Birds" value={route.totalBirds.toLocaleString("en-IN")} />
        <Total label="Total Boxes" value={String(route.totalBoxes)} />
        <Total label="Route Status" value={route.routeStatus} />
      </div>
    </div>
  );
}

function Total({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white px-4 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="text-sm font-bold text-slate-700">{value}</p>
    </div>
  );
}

export default memo(RouteStopList);
