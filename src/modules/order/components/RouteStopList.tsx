// src/modules/order/components/RouteStopList.tsx
// Per-stop delivery list with distance, ETA, buffer and deadline status.

import { memo } from "react";
import { AlertTriangle } from "lucide-react";
import type { DeliveryPhase, DeliveryRoute } from "../types/routeTypes";
import PriorityBadge from "./PriorityBadge";
import { PHASE_LABEL } from "../services/deliverySequencingService";
import { formatDistanceKm } from "../utils/orderFormat";

const PHASE_STYLES: Record<DeliveryPhase, string> = {
  Critical: "bg-rose-50 text-rose-700 border-rose-200",
  Important: "bg-amber-50 text-amber-700 border-amber-200",
  Normal: "bg-slate-100 text-slate-600 border-slate-200",
};

const FEASIBILITY_LABEL: Record<string, { text: string; className: string }> = {
  "Can Meet": { text: "✓", className: "text-emerald-600" },
  "At Risk": { text: "⚠", className: "text-amber-600" },
  "Cannot Meet": { text: "✕", className: "text-rose-600" },
  Unknown: { text: "—", className: "text-slate-400" },
};

function RouteStopList({ route }: { route: DeliveryRoute }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
        <h3 className="text-sm font-bold text-slate-800">Stops · {route.vehicleNo}</h3>
        <span className="text-[11px] font-medium text-slate-400">{route.stops.length} stop{route.stops.length === 1 ? "" : "s"}</span>
      </div>

      <div className="divide-y divide-slate-100">
        {route.stops.length === 0 ? (
          <p className="px-5 py-8 text-center text-xs text-slate-400">No stops assigned to this route.</p>
        ) : (
          route.stops.map((stop) => {
            const feas = FEASIBILITY_LABEL[stop.deadlineFeasible] ?? FEASIBILITY_LABEL.Unknown;
            return (
              <div key={stop.orderId} className="flex items-center gap-3 px-5 py-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">
                  {stop.stopNumber}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-slate-800">
                    {stop.shopName}
                    {stop.deadlineException && (
                      <AlertTriangle size={12} className="shrink-0 text-rose-500" aria-label="Deadline exception" />
                    )}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    {stop.birds.toLocaleString("en-IN")} birds · {stop.boxes} boxes · {stop.deadlineLabel}
                  </p>
                  {stop.reason.length > 0 && (
                    <p className="mt-0.5 truncate text-[10px] text-slate-400" title={stop.reason.join(" · ")}>
                      {stop.reason.join(" · ")}
                    </p>
                  )}
                </div>
                <span className={`hidden shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase sm:inline ${PHASE_STYLES[stop.effectivePlanningPhase]}`}>
                  {PHASE_LABEL[stop.effectivePlanningPhase]}
                </span>
                <PriorityBadge priority={stop.priority} />
                <div className="w-20 text-right">
                  <p className="text-xs font-semibold text-slate-600">
                    {stop.legDistanceKm != null ? formatDistanceKm(stop.legDistanceKm) : "Pending"}
                  </p>
                  <p className="text-[11px] text-slate-400">ETA {stop.arrivalTime ?? "—"}</p>
                </div>
                <span className={`w-5 text-center text-sm font-bold ${feas.className}`} title={stop.deadlineFeasible}>
                  {feas.text}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default memo(RouteStopList);
