// src/modules/order/components/RoutePlanner.tsx
// Three-panel route planning screen: orders (left), route visualization
// (center), route details (right).

import { useMemo, useState } from "react";
import { Truck } from "lucide-react";
import type { Order, VehicleAssignment as VehicleAssignmentType } from "../types/orderTypes";
import type { DeliveryRoute } from "../types/routeTypes";
import PriorityBadge from "./PriorityBadge";
import MapPlaceholder from "./MapPlaceholder";
import RouteStopList from "./RouteStopList";
import EmptyState from "./EmptyState";
import { ORDER_VEHICLES } from "../data/orderMockData";
import { nextTripNumber } from "../utils/sequence";

interface RoutePlannerProps {
  orders: Order[];
  routes: DeliveryRoute[];
  isLoading: boolean;
  onAssign: (orderId: string, assignment: VehicleAssignmentType) => void;
}

export default function RoutePlanner({ orders, routes, isLoading, onAssign }: RoutePlannerProps) {
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(routes[0]?.id ?? null);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [vehicleChoice, setVehicleChoice] = useState("");

  const unassigned = useMemo(
    () => orders.filter((o) => !o.vehicleAssignment && o.status !== "Cancelled" && o.status !== "Delivered"),
    [orders],
  );

  const selectedRoute = routes.find((r) => r.id === selectedRouteId) ?? routes[0] ?? null;

  const doAssign = (order: Order) => {
    const vehicle = ORDER_VEHICLES.find((v) => v.id === vehicleChoice);
    if (!vehicle) return;
    onAssign(order.id, {
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
    });
    setAssigningId(null);
    setVehicleChoice("");
  };

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-slate-200/80 bg-white p-12 text-center">
        <div className="inline-flex items-center gap-2 text-sm font-medium text-slate-400">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-brand-600" />
          Planning routes…
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
      {/* Left — awaiting assignment */}
      <div className="xl:col-span-3">
        <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h3 className="text-sm font-bold text-slate-800">Orders</h3>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
              {unassigned.length} unassigned
            </span>
          </div>
          <div className="max-h-[520px] divide-y divide-slate-100 overflow-y-auto">
            {unassigned.length === 0 ? (
              <EmptyState icon={Truck} title="All orders assigned" description="No orders are waiting for a vehicle." />
            ) : (
              unassigned.map((order) => (
                <div key={order.id} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-800">{order.shop.name}</p>
                      <p className="text-[11px] text-slate-400">
                        {order.orderNumber} · {order.birds.toLocaleString("en-IN")} birds · {order.deliveryDeadline}
                      </p>
                    </div>
                    <PriorityBadge priority={order.priority} />
                  </div>
                  {assigningId === order.id ? (
                    <div className="mt-2 space-y-2">
                      <select
                        value={vehicleChoice}
                        onChange={(e) => setVehicleChoice(e.target.value)}
                        className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700 outline-none focus:border-brand-500"
                      >
                        <option value="">Select vehicle…</option>
                        {ORDER_VEHICLES.filter((v) => v.available).map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.vehicleNo} — {v.pickup.location}
                          </option>
                        ))}
                      </select>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => doAssign(order)}
                          disabled={!vehicleChoice}
                          className="flex-1 rounded-lg bg-brand-600 px-2 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-40"
                        >
                          Assign
                        </button>
                        <button
                          type="button"
                          onClick={() => setAssigningId(null)}
                          className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-semibold text-slate-500 transition-colors hover:bg-slate-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setAssigningId(order.id);
                        setVehicleChoice("");
                      }}
                      className="mt-2 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50"
                    >
                      Assign vehicle
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Center — visualization */}
      <div className="xl:col-span-5">
        <div className="flex flex-col gap-3">
          {/* Route selector */}
          <div className="flex flex-wrap gap-2">
            {routes.length === 0 ? (
              <p className="text-xs text-slate-400">No routes planned yet — assign orders to vehicles.</p>
            ) : (
              routes.map((route) => (
                <button
                  key={route.id}
                  type="button"
                  onClick={() => setSelectedRouteId(route.id)}
                  className={`rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                    selectedRoute?.id === route.id
                      ? "border-brand-600 bg-brand-50 text-brand-700"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {route.vehicleNo}
                  <span className="ml-1.5 text-[10px] font-normal text-slate-400">{route.pickup.location}</span>
                </button>
              ))
            )}
          </div>
          <MapPlaceholder route={selectedRoute} />
        </div>
      </div>

      {/* Right — route details */}
      <div className="xl:col-span-4">
        {selectedRoute ? (
          <RouteStopList route={selectedRoute} />
        ) : (
          <div className="rounded-2xl border border-slate-200/80 bg-white p-10 text-center">
            <p className="text-sm font-semibold text-slate-700">No route selected</p>
            <p className="mt-1 text-xs text-slate-400">Assign orders to vehicles to build routes.</p>
          </div>
        )}
      </div>
    </div>
  );
}
