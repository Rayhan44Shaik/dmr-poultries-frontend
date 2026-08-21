// src/modules/order/components/VehicleComparison.tsx
// Vehicle comparison panel: all candidate vehicles with ETA / buffer / deadline
// status, the recommended vehicle highlighted, readable reasons, and manual
// override with an at-risk warning.

import { useMemo, useState } from "react";
import { AlertTriangle, Sparkles } from "lucide-react";
import type { Order, VehicleAssignment as VehicleAssignmentType } from "../types/orderTypes";
import type { RouteVehicle } from "../types/routeTypes";
import type { RecommendationResult } from "../services/vehicleRecommendationService";
import { nextTripNumber } from "../utils/sequence";

interface VehicleComparisonProps {
  order: Order;
  result: RecommendationResult;
  onAssign: (assignment: VehicleAssignmentType) => void;
}

const TIER_STYLES: Record<string, string> = {
  "Best Match": "bg-emerald-50 text-emerald-700 border-emerald-200",
  Alternative: "bg-slate-100 text-slate-600 border-slate-200",
  "At Risk": "bg-amber-50 text-amber-700 border-amber-200",
  "Not Suitable": "bg-rose-50 text-rose-700 border-rose-200",
};

const FEASIBILITY_LABEL: Record<string, string> = {
  "Can Meet": "✓ Can Meet",
  "At Risk": "⚠ At Risk",
  "Cannot Meet": "✕ Cannot Meet",
  Unknown: "—",
};

function buildAssignment(order: Order, vehicle: RouteVehicle, assignmentType: "System Recommended" | "Manually Assigned"): VehicleAssignmentType {
  return {
    vehicleId: vehicle.id,
    vehicleNo: vehicle.vehicleNo,
    driverName: vehicle.driverName,
    supervisorName: vehicle.supervisorName,
    tripNo: vehicle.tripNo ?? nextTripNumber(),
    pickupFarm: vehicle.pickup.farmName,
    pickupLocation: vehicle.pickup.location,
    orderCount: vehicle.assignedOrderCount + 1,
    routeStatus: "Planned",
    departureTime: vehicle.schedule.departureTime,
    assignmentType,
  };
}

export default function VehicleComparison({ order, result, onAssign }: VehicleComparisonProps) {
  const [overrideId, setOverrideId] = useState<string | null>(null);

  const overrideCandidate = useMemo(
    () => result.candidates.find((c) => c.vehicle.id === overrideId) ?? null,
    [result, overrideId],
  );

  const confirmManual = () => {
    if (!overrideCandidate) return;
    onAssign(buildAssignment(order, overrideCandidate.vehicle, "Manually Assigned"));
    setOverrideId(null);
  };

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
        <div>
          <h3 className="text-sm font-bold text-slate-800">Vehicle Recommendation</h3>
          <p className="text-[11px] text-slate-400">
            {order.shop.name} · deadline {order.deadlineLabel} ({order.deadlineTime})
          </p>
        </div>
        {result.recommended && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-semibold text-brand-700">
            <Sparkles size={12} />
            {result.recommended.vehicle.vehicleNo}
          </span>
        )}
      </div>

      {/* Comparison table */}
      <div className="overflow-x-auto">
        <table className="min-w-full text-xs">
          <thead className="border-b border-slate-100 bg-slate-50/60">
            <tr className="whitespace-nowrap text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">
              <th className="px-3 py-2">Vehicle</th>
              <th className="px-3 py-2">Pickup</th>
              <th className="px-3 py-2">Departure</th>
              <th className="px-3 py-2">Travel</th>
              <th className="px-3 py-2">ETA</th>
              <th className="px-3 py-2">Buffer</th>
              <th className="px-3 py-2">Capacity</th>
              <th className="px-3 py-2">Stops</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Recommendation</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {result.candidates.map((candidate) => {
              const v = candidate.vehicle;
              const isRecommended = result.recommended?.vehicle.id === v.id;
              return (
                <tr key={v.id} className={isRecommended ? "bg-emerald-50/40" : ""}>
                  <td className="px-3 py-2 font-semibold text-slate-700">
                    {v.vehicleNo}
                    {isRecommended && <span className="ml-1.5 rounded bg-emerald-600 px-1.5 py-0.5 text-[9px] font-bold text-white">BEST</span>}
                  </td>
                  <td className="px-3 py-2 text-slate-600">{v.pickup.location}</td>
                  <td className="px-3 py-2 text-slate-600">{v.schedule.departureTime ?? "Pending"}</td>
                  <td className="px-3 py-2 text-slate-600">
                    {candidate.travelMinutes != null ? `~${candidate.travelMinutes}m` : "—"}
                  </td>
                  <td className="px-3 py-2 font-semibold text-slate-700">
                    {candidate.predictedArrival ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-slate-600">
                    {candidate.bufferMinutes != null ? `${candidate.bufferMinutes}m` : "—"}
                  </td>
                  <td className="px-3 py-2 text-slate-600">
                    {(v.birdCapacity == null || v.birdCapacity >= order.birds) && (v.boxCapacity == null || v.boxCapacity >= order.boxes)
                      ? "OK"
                      : "Insufficient"}
                  </td>
                  <td className="px-3 py-2 text-slate-600">{v.assignedOrderCount}</td>
                  <td className="px-3 py-2">
                    <span className={candidate.deadlineFeasible === "Cannot Meet" ? "font-semibold text-rose-600" : candidate.deadlineFeasible === "At Risk" ? "font-semibold text-amber-600" : "font-semibold text-emerald-600"}>
                      {FEASIBILITY_LABEL[candidate.deadlineFeasible]}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${TIER_STYLES[candidate.tier]}`}>
                      {candidate.tier}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Recommended reasons */}
      {result.recommended && (
        <div className="border-t border-slate-100 px-5 py-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Why {result.recommended.vehicle.vehicleNo}?
          </p>
          <ul className="mt-1.5 space-y-0.5">
            {result.recommended.reasons.map((reason) => (
              <li key={reason} className="flex items-start gap-1.5 text-xs text-slate-600">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-emerald-500" />
                {reason}
              </li>
            ))}
            {result.recommended.eligibilityReasons.map((reason) => (
              <li key={reason} className="flex items-start gap-1.5 text-xs text-rose-600">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-rose-500" />
                {reason}
              </li>
            ))}
          </ul>

          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => onAssign(buildAssignment(order, result.recommended!.vehicle, "System Recommended"))}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-brand-700"
            >
              <Sparkles size={13} />
              Use recommendation
            </button>
            <button
              type="button"
              onClick={() => setOverrideId(overrideId ? null : (result.candidates.find((c) => c.eligibility !== "Not Eligible")?.vehicle.id ?? ""))}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50"
            >
              Choose manually…
            </button>
          </div>
        </div>
      )}

      {/* Manual override */}
      {overrideId && (
        <div className="border-t border-slate-100 bg-slate-50/60 px-5 py-3">
          <label className="mb-1 block text-[11px] font-semibold text-slate-500">Select vehicle</label>
          <select
            value={overrideId}
            onChange={(e) => setOverrideId(e.target.value)}
            className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700 outline-none focus:border-brand-500"
          >
            <option value="">Choose…</option>
            {result.candidates
              .filter((c) => c.eligibility !== "Not Eligible")
              .map((c) => (
                <option key={c.vehicle.id} value={c.vehicle.id}>
                  {c.vehicle.vehicleNo} — {c.vehicle.pickup.location} (ETA {c.predictedArrival ?? "—"})
                </option>
              ))}
          </select>

          {overrideCandidate && (overrideCandidate.deadlineFeasible === "At Risk" || overrideCandidate.deadlineFeasible === "Cannot Meet") && (
            <div className="mt-2 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <span>
                {overrideCandidate.vehicle.vehicleNo} is predicted to arrive{" "}
                {overrideCandidate.deadlineFeasible === "Cannot Meet"
                  ? `${Math.abs(overrideCandidate.bufferMinutes ?? 0)} min after`
                  : "very close to"}{" "}
                the required delivery time. Continue with manual assignment?
              </span>
            </div>
          )}

          <button
            type="button"
            onClick={confirmManual}
            disabled={!overrideCandidate}
            className="mt-2 w-full rounded-lg bg-slate-800 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-slate-900 disabled:opacity-40"
          >
            Assign manually
          </button>
        </div>
      )}
    </div>
  );
}
