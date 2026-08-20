// src/modules/order/components/VehicleAssignment.tsx
// Shows vehicle assignment for an order, with system recommendation and an
// optional manual override (requirement #20). Distinguishes "System
// Recommended" from "Manually Assigned".

import { useMemo, useState } from "react";
import { Sparkles, Truck } from "lucide-react";
import type { Order, VehicleAssignment as VehicleAssignmentType } from "../types/orderTypes";
import { ORDER_VEHICLES } from "../data/orderMockData";
import { recommendVehicle } from "../services/vehicleRecommendationService";
import { nextTripNumber } from "../utils/sequence";

interface VehicleAssignmentProps {
  order: Order;
  onAssign: (assignment: VehicleAssignmentType) => void;
}

export default function VehicleAssignment({ order, onAssign }: VehicleAssignmentProps) {
  const [changeOpen, setChangeOpen] = useState(false);
  const [selectedVehicleId, setSelectedVehicleId] = useState("");

  const recommendation = useMemo(
    () => recommendVehicle({ order, vehicles: ORDER_VEHICLES }),
    [order],
  );

  const current = order.vehicleAssignment;

  const manualVehicles = ORDER_VEHICLES.filter((v) => v.available);

  const applyManual = () => {
    const vehicle = manualVehicles.find((v) => v.id === selectedVehicleId);
    if (!vehicle) return;
    const assignment: VehicleAssignmentType = {
      vehicleId: vehicle.id,
      vehicleNo: vehicle.vehicleNo,
      driverName: vehicle.driverName,
      supervisorName: vehicle.supervisorName,
      tripNo: nextTripNumber(),
      pickupFarm: vehicle.pickup.farmName,
      pickupLocation: vehicle.pickup.location,
      orderCount: vehicle.assignedOrderCount + 1,
      routeStatus: "Planned",
      assignmentType: "Manually Assigned",
    };
    onAssign(assignment);
    setChangeOpen(false);
  };

  if (current) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
            <Truck size={16} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-slate-800">{current.vehicleNo}</p>
            <p className="text-[11px] text-slate-400">
              {current.driverName} · {current.supervisorName}
            </p>
          </div>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
              current.assignmentType === "System Recommended"
                ? "bg-brand-50 text-brand-700"
                : "bg-amber-50 text-amber-700"
            }`}
          >
            {current.assignmentType}
          </span>
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
          <div className="flex justify-between"><dt className="text-slate-400">Pickup Farm</dt><dd className="font-medium text-slate-700">{current.pickupFarm}</dd></div>
          <div className="flex justify-between"><dt className="text-slate-400">Pickup Location</dt><dd className="font-medium text-slate-700">{current.pickupLocation}</dd></div>
          <div className="flex justify-between"><dt className="text-slate-400">Trip</dt><dd className="font-medium text-slate-700">{current.tripNo}</dd></div>
          <div className="flex justify-between"><dt className="text-slate-400">Orders</dt><dd className="font-medium text-slate-700">{current.orderCount}</dd></div>
          <div className="flex justify-between"><dt className="text-slate-400">Route</dt><dd className="font-medium text-slate-700">{current.routeStatus}</dd></div>
        </dl>
        <button
          type="button"
          onClick={() => setChangeOpen((v) => !v)}
          className="mt-3 text-xs font-semibold text-brand-600 transition-colors hover:text-brand-700"
        >
          Change vehicle…
        </button>
        {changeOpen && (
          <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
            <label className="block text-[11px] font-semibold text-slate-500">Select vehicle</label>
            <select
              value={selectedVehicleId}
              onChange={(e) => setSelectedVehicleId(e.target.value)}
              className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700 outline-none focus:border-brand-500"
            >
              <option value="">Choose…</option>
              {manualVehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.vehicleNo} — {v.pickup.location} ({v.driverName})
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={applyManual}
              disabled={!selectedVehicleId}
              className="w-full rounded-lg bg-slate-800 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-slate-900 disabled:opacity-40"
            >
              Assign manually
            </button>
          </div>
        )}
      </div>
    );
  }

  // Not yet assigned — show recommendation.
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/60 p-4">
      {recommendation ? (
        <>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
              <Sparkles size={16} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">System Recommended</p>
              <p className="text-sm font-bold text-slate-800">
                {recommendation.vehicle.vehicleNo} — {recommendation.vehicle.pickup.location}
              </p>
            </div>
          </div>
          <p className="mt-2 text-xs text-slate-500">{recommendation.reason}</p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() =>
                onAssign({
                  vehicleId: recommendation.vehicle.id,
                  vehicleNo: recommendation.vehicle.vehicleNo,
                  driverName: recommendation.vehicle.driverName,
                  supervisorName: recommendation.vehicle.supervisorName,
                  tripNo: nextTripNumber(),
                  pickupFarm: recommendation.vehicle.pickup.farmName,
                  pickupLocation: recommendation.vehicle.pickup.location,
                  orderCount: recommendation.vehicle.assignedOrderCount + 1,
                  routeStatus: "Planned",
                  assignmentType: "System Recommended",
                })
              }
              className="flex-1 rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-brand-700"
            >
              Use recommendation
            </button>
            <button
              type="button"
              onClick={() => setChangeOpen(true)}
              className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50"
            >
              Choose manually
            </button>
          </div>
          {changeOpen && (
            <div className="mt-3 space-y-2 border-t border-slate-200 pt-3">
              <select
                value={selectedVehicleId}
                onChange={(e) => setSelectedVehicleId(e.target.value)}
                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700 outline-none focus:border-brand-500"
              >
                <option value="">Choose…</option>
                {manualVehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.vehicleNo} — {v.pickup.location} ({v.driverName})
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={applyManual}
                disabled={!selectedVehicleId}
                className="w-full rounded-lg bg-slate-800 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-slate-900 disabled:opacity-40"
              >
                Assign manually
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-col items-center gap-2 py-4 text-center">
          <Truck size={20} className="text-slate-400" />
          <p className="text-sm font-semibold text-slate-700">No suitable vehicle is currently available.</p>
          <p className="text-xs text-slate-400">All vehicles are unavailable or lack capacity for this order.</p>
        </div>
      )}
    </div>
  );
}
