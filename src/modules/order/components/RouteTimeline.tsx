// src/modules/order/components/RouteTimeline.tsx
// Compact vertical timeline: pickup → loading → departure → stops with ETAs,
// delivery-phase badges, and deadline-conflict warnings.

import { memo } from "react";
import { AlertTriangle } from "lucide-react";
import type { DeliveryPhase, DeliveryRoute } from "../types/routeTypes";
import PriorityBadge from "./PriorityBadge";
import { PHASE_LABEL } from "../services/deliverySequencingService";
import { formatClock, parseHHmm } from "../utils/businessTime";

const PHASE_STYLES: Record<DeliveryPhase, string> = {
  Critical: "bg-rose-50 text-rose-700 border-rose-200",
  Important: "bg-amber-50 text-amber-700 border-amber-200",
  Normal: "bg-slate-100 text-slate-600 border-slate-200",
};

function RouteTimeline({ route }: { route: DeliveryRoute }) {
  const departureMinutes = parseHHmm(route.schedule.departureTime);

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
      <h3 className="mb-4 text-sm font-bold text-slate-800">Route Timeline</h3>

      <ol className="relative space-y-0 border-l-2 border-slate-100 pl-5">
        {/* Pickup origin */}
        <li className="relative pb-5">
          <span className="absolute -left-[27px] flex h-4 w-4 items-center justify-center rounded-full bg-brand-600 ring-4 ring-white">
            <span className="h-1.5 w-1.5 rounded-full bg-white" />
          </span>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-800">{route.pickup.farmName}</p>
              <p className="text-[11px] text-slate-400">Pickup · {route.pickup.location}</p>
            </div>
            <span className="text-xs font-semibold text-slate-500">
              {route.schedule.tripSubmittedTime ?? "—"}
            </span>
          </div>
          <p className="mt-0.5 text-[11px] text-slate-400">
            Loading done {route.schedule.loadingCompletionTime ?? "—"} · Departs {route.schedule.departureTime ?? "Calculation Pending"}
          </p>
        </li>

        {route.stops.map((stop, index) => {
          const prevPhase = index > 0 ? route.stops[index - 1].effectivePlanningPhase : null;
          const phaseBoundary = prevPhase !== stop.effectivePlanningPhase;
          return (
            <li key={stop.orderId} className="relative pb-4 last:pb-0">
              <span className="absolute -left-[27px] flex h-4 w-4 items-center justify-center rounded-full bg-slate-300 ring-4 ring-white">
                <span className="h-1.5 w-1.5 rounded-full bg-white" />
              </span>

              {phaseBoundary && (
                <span className={`mb-1.5 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${PHASE_STYLES[stop.effectivePlanningPhase]}`}>
                  {PHASE_LABEL[stop.effectivePlanningPhase]} phase
                </span>
              )}

              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-800">
                    <span className="mr-1.5 text-slate-400">#{stop.stopNumber}</span>
                    {stop.shopName}
                    {stop.deadlineException && (
                      <AlertTriangle size={12} className="ml-1.5 inline text-rose-500" aria-label="Deadline exception" />
                    )}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    {stop.birds.toLocaleString("en-IN")} birds · {stop.boxes} boxes · {stop.deadlineLabel}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <PriorityBadge priority={stop.priority} />
                  <span className="w-16 text-right text-xs font-semibold text-slate-600">
                    {stop.arrivalTime ?? "—"}
                  </span>
                </div>
              </div>
              <p className="mt-0.5 text-[11px] text-slate-400">
                {stop.fromName} → {stop.shopName} · {stop.legDistanceKm != null ? `${stop.legDistanceKm} km` : "—"}
                {stop.bufferMinutes != null ? ` · buffer ${stop.bufferMinutes} min` : ""}
              </p>
            </li>
          );
        })}

        {/* Final arrival */}
        {route.stops.length > 0 && (
          <li className="relative">
            <span className="absolute -left-[27px] flex h-4 w-4 items-center justify-center rounded-full bg-slate-200 ring-4 ring-white">
              <span className="h-1.5 w-1.5 rounded-full bg-white" />
            </span>
            <p className="text-sm font-semibold text-slate-700">
              Route complete
              {departureMinutes != null && route.estimatedTravelMinutes != null && (
                <span className="ml-2 font-normal text-slate-400">
                  ~{formatClock(departureMinutes + route.estimatedTravelMinutes)}
                </span>
              )}
            </p>
          </li>
        )}
      </ol>
    </div>
  );
}

export default memo(RouteTimeline);
