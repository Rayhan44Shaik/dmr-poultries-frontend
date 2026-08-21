// src/modules/order/components/DeliveryPlanSummary.tsx
// "Delivery plan" header + current-phase card + next-stop recommendation.
// Surfaces the phase model, the chosen next stop and WHY, and the distance
// saving estimate. All distances/ETAs are frontend estimates.

import { memo } from "react";
import { AlertTriangle, ArrowDown, Fuel } from "lucide-react";
import type { DeliveryPhase, DeliveryRoute } from "../types/routeTypes";
import { PHASE_LABEL } from "../services/deliverySequencingService";
import { DEFAULT_AVG_SPEED_KMH } from "../services/routeCalculationService";
import { formatDistanceKm } from "../utils/orderFormat";

const PHASE_STYLES: Record<DeliveryPhase, string> = {
  Critical: "bg-rose-50 text-rose-700 border-rose-200",
  Important: "bg-amber-50 text-amber-700 border-amber-200",
  Normal: "bg-slate-100 text-slate-600 border-slate-200",
};

function countByPhase(route: DeliveryRoute): Record<DeliveryPhase, number> {
  const counts: Record<DeliveryPhase, number> = { Critical: 0, Important: 0, Normal: 0 };
  for (const stop of route.stops) counts[stop.phase] += 1;
  return counts;
}

function currentPhaseOf(route: DeliveryRoute): DeliveryPhase | null {
  for (const stop of route.stops) return stop.phase;
  return null;
}

function DeliveryPlanSummary({ route }: { route: DeliveryRoute }) {
  const counts = countByPhase(route);
  const currentPhase = currentPhaseOf(route);
  const nextStop = route.stops[0] ?? null;

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      {/* Header */}
      <div className="border-b border-slate-100 px-5 py-4">
        <h3 className="text-sm font-bold text-slate-800">Delivery Plan</h3>
        <div className="mt-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
          <HeaderStat label="Vehicle" value={route.vehicleNo} />
          <HeaderStat label="Pickup" value={route.pickup.farmName} />
          <HeaderStat label="Departure" value={route.schedule.departureTime} />
          <HeaderStat label="Stops" value={String(route.stops.length)} />
          <HeaderStat label="Total Birds" value={route.totalBirds.toLocaleString("en-IN")} />
          <HeaderStat label="Total Boxes" value={String(route.totalBoxes)} />
        </div>
      </div>

      {/* Current phase */}
      {currentPhase && (
        <div className="border-b border-slate-100 bg-slate-50/60 px-5 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Current Phase</span>
              <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold ${PHASE_STYLES[currentPhase]}`}>
                {PHASE_LABEL[currentPhase]}
              </span>
            </div>
            <span className="text-[11px] text-slate-400">
              {(["Critical", "Important", "Normal"] as DeliveryPhase[]).map((p) => `${PHASE_LABEL[p]} ${counts[p]}`).join(" · ")}
            </span>
          </div>
        </div>
      )}

      {/* Next stop */}
      {nextStop && (
        <div className="px-5 py-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Next Stop</p>
          <div className="mt-1.5 flex items-center gap-3">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">1</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-800">{nextStop.shopName}</p>
              <p className="text-[11px] text-slate-400">
                {nextStop.deadlineLabel} · ETA {nextStop.arrivalTime ?? "—"} · buffer {nextStop.bufferMinutes != null ? `${nextStop.bufferMinutes} min` : "—"}
              </p>
            </div>
            <span className="text-xs font-semibold text-slate-600">{formatDistanceKm(nextStop.legDistanceKm)}</span>
          </div>

          {nextStop.deadlineConflict && (
            <div className="mt-2 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <span>DEADLINE CONFLICT — this stop was promoted ahead of its priority phase.</span>
            </div>
          )}

          {nextStop.reason.length > 0 && (
            <ul className="mt-2 space-y-0.5">
              {nextStop.reason.map((r) => (
                <li key={r} className="flex items-start gap-1.5 text-xs text-slate-600">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-emerald-500" />
                  {r}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Distance efficiency + estimate disclaimer */}
      <div className="border-t border-slate-100 px-5 py-3">
        <div className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-1.5 text-slate-500">
            <Fuel size={13} />
            Distance-efficient sequence
          </span>
          <span className="font-semibold text-slate-700">{formatDistanceKm(route.totalDistanceKm)}</span>
        </div>
        {route.deadlineConflicts && (
          <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-rose-600">
            <AlertTriangle size={12} /> Deadline conflict(s) detected in this plan
          </p>
        )}
        <div className="mt-2 flex items-start gap-1.5 border-t border-slate-50 pt-2 text-[11px] text-slate-400">
          <ArrowDown size={11} className="mt-0.5 shrink-0" />
          Frontend road estimate — average speed assumption {DEFAULT_AVG_SPEED_KMH} km/h. Real routing not yet connected.
        </div>
      </div>
    </div>
  );
}

function HeaderStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="truncate font-semibold text-slate-700">{value}</p>
    </div>
  );
}

export default memo(DeliveryPlanSummary);
