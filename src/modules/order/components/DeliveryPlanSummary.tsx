// src/modules/order/components/DeliveryPlanSummary.tsx
// "Delivery plan" header + base-phase card + deadline-exception callout +
// next-stop recommendation + route status summary. All distances/ETAs are
// frontend estimates; totals are based on the same dataset (planned +
// unplanned = total).

import { memo } from "react";
import { AlertTriangle, ArrowDown } from "lucide-react";
import type { DeliveryPhase, DeliveryRoute } from "../types/routeTypes";
import { PHASE_LABEL } from "../services/deliverySequencingService";
import { DEFAULT_AVG_SPEED_KMH } from "../services/routeCalculationService";
import { formatDistanceKm } from "../utils/orderFormat";

const PHASE_STYLES: Record<DeliveryPhase, string> = {
  Critical: "bg-rose-50 text-rose-700 border-rose-200",
  Important: "bg-amber-50 text-amber-700 border-amber-200",
  Normal: "bg-slate-100 text-slate-600 border-slate-200",
};

const ROUTE_STATUS_STYLES: Record<string, string> = {
  Planned: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Ready: "bg-slate-100 text-slate-600 border-slate-200",
  "Partially Planned": "bg-amber-50 text-amber-700 border-amber-200",
  "At Risk": "bg-orange-50 text-orange-700 border-orange-200",
  Conflict: "bg-rose-50 text-rose-700 border-rose-200",
  Blocked: "bg-rose-50 text-rose-700 border-rose-200",
  Completed: "bg-slate-100 text-slate-600 border-slate-200",
};

/** Base phase = highest-priority phase among ALL orders (planned + unplanned). */
function basePhaseOf(route: DeliveryRoute): DeliveryPhase | null {
  const phases: DeliveryPhase[] = [];
  for (const stop of route.stops) phases.push(stop.basePhase);
  for (const unplanned of route.unplannedOrders) phases.push(unplanned.basePhase);
  if (phases.length === 0) return null;
  return phases.reduce<DeliveryPhase>((cur, p) => {
    const rank: Record<DeliveryPhase, number> = { Critical: 1, Important: 2, Normal: 3 };
    return rank[p] < rank[cur] ? p : cur;
  }, phases[0]);
}

function countByBasePhase(route: DeliveryRoute): Record<DeliveryPhase, number> {
  const counts: Record<DeliveryPhase, number> = { Critical: 0, Important: 0, Normal: 0 };
  for (const stop of route.stops) counts[stop.basePhase] += 1;
  for (const unplanned of route.unplannedOrders) counts[unplanned.basePhase] += 1;
  return counts;
}

function DeliveryPlanSummary({ route }: { route: DeliveryRoute }) {
  const counts = countByBasePhase(route);
  const basePhase = basePhaseOf(route);
  const nextStop = route.stops[0] ?? null;
  const exceptionCount = route.stops.filter((s) => s.deadlineException).length;

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      {/* Header */}
      <div className="border-b border-slate-100 px-5 py-4">
        <h3 className="text-sm font-bold text-slate-800">Delivery Plan</h3>
        <div className="mt-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
          <HeaderStat label="Vehicle" value={route.vehicleNo} />
          <HeaderStat label="Pickup" value={route.pickup.farmName} />
          <HeaderStat label="Departure" value={route.schedule.departureTime ?? "Calculation Pending"} />
          <HeaderStat label="Planned" value={String(route.stops.length)} />
          <HeaderStat label="Unplanned" value={String(route.unplannedOrders.length)} />
          <HeaderStat label="Total Orders" value={String(route.totalOrderCount)} />
        </div>
      </div>

      {/* Base phase (never redefined by a promoted order) */}
      {basePhase && (
        <div className="border-b border-slate-100 bg-slate-50/60 px-5 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Base Delivery Phase</span>
              <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold ${PHASE_STYLES[basePhase]}`}>
                {PHASE_LABEL[basePhase]}
              </span>
            </div>
            <span className="text-[11px] text-slate-400">
              {(["Critical", "Important", "Normal"] as DeliveryPhase[]).map((p) => `${PHASE_LABEL[p]} ${counts[p]}`).join(" · ")}
            </span>
          </div>

          {exceptionCount > 0 && (
            <div className="mt-2 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <span>
                Exception: {exceptionCount} lower-phase order{exceptionCount > 1 ? "s" : ""} promoted because of deadline risk.
              </span>
            </div>
          )}
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

          {nextStop.deadlineException && (
            <div className="mt-2 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <span>Deadline Exception — {nextStop.promotionReason ?? "promoted because of deadline risk"}.</span>
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

      {/* Unplanned orders (never silently dropped) */}
      {route.unplannedOrders.length > 0 && (
        <div className="border-t border-slate-100 px-5 py-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Unplanned Orders</p>
          <ul className="mt-1.5 space-y-1">
            {route.unplannedOrders.map((u) => (
              <li key={u.orderId} className="flex items-center justify-between gap-2 text-xs text-slate-600">
                <span className="truncate">{u.orderNumber} · {u.shopName}</span>
                <span className="shrink-0 text-rose-500">{u.reason}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Route status + totals + distance efficiency */}
      <div className="border-t border-slate-100 px-5 py-3">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500">Route Status</span>
          <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${ROUTE_STATUS_STYLES[route.routeStatus] ?? ROUTE_STATUS_STYLES.Planned}`}>
            {route.routeStatus}
          </span>
        </div>

        <div className="mt-2 grid grid-cols-2 gap-1 text-xs text-slate-600 sm:grid-cols-3">
          <TotalsRow label="Planned Birds" value={route.plannedBirds.toLocaleString("en-IN")} />
          <TotalsRow label="Unplanned Birds" value={route.unplannedBirds.toLocaleString("en-IN")} />
          <TotalsRow label="Planned Boxes" value={String(route.plannedBoxes)} />
          <TotalsRow label="Unplanned Boxes" value={String(route.unplannedBoxes)} />
          <TotalsRow label="At Risk" value={String(route.atRiskCount)} />
          <TotalsRow label="Deadline Conflicts" value={String(route.deadlineConflicts ? "Yes" : "No")} />
        </div>

        <div className="mt-3 flex items-center justify-between border-t border-slate-50 pt-2 text-xs">
          <span className="text-slate-500">Estimated distance efficiency</span>
          <span className="font-semibold text-slate-700">{formatDistanceKm(route.totalDistanceKm)}</span>
        </div>

        <div className="mt-2 flex items-start gap-1.5 text-[11px] text-slate-400">
          <ArrowDown size={11} className="mt-0.5 shrink-0" />
          Frontend road estimate — average speed assumption {DEFAULT_AVG_SPEED_KMH} km/h. Compared with a simple farm → each-shop baseline. Real routing not yet connected.
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

function TotalsRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-400">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}

export default memo(DeliveryPlanSummary);
