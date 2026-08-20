// src/modules/order/components/RoutePlanner.tsx
// Central decision screen: unassigned orders (left), route visualization
// (center), vehicle comparison + route details (right).

import { useMemo, useState } from "react";
import { MapPin, Truck } from "lucide-react";
import type { Order, VehicleAssignment as VehicleAssignmentType } from "../types/orderTypes";
import type { DeliveryRoute, RouteVehicle } from "../types/routeTypes";
import PriorityBadge from "./PriorityBadge";
import MapPlaceholder from "./MapPlaceholder";
import RouteTimeline from "./RouteTimeline";
import RouteCalculationCard from "./RouteCalculationCard";
import RouteStopList from "./RouteStopList";
import VehicleComparison from "./VehicleComparison";
import EmptyState from "./EmptyState";
import { recommendVehicles } from "../services/vehicleRecommendationService";
import { formatAddressShort } from "../utils/orderFormat";

interface RoutePlannerProps {
  orders: Order[];
  routes: DeliveryRoute[];
  vehicles: RouteVehicle[];
  isLoading: boolean;
  onAssign: (orderId: string, assignment: VehicleAssignmentType) => void;
}

export default function RoutePlanner({ orders, routes, vehicles, isLoading, onAssign }: RoutePlannerProps) {
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(routes[0]?.id ?? null);

  const unassigned = useMemo(
    () => orders.filter((o) => !o.vehicleAssignment && o.status !== "Cancelled" && o.status !== "Delivered"),
    [orders],
  );

  const selectedOrder = useMemo(
    () => unassigned.find((o) => o.id === selectedOrderId) ?? null,
    [unassigned, selectedOrderId],
  );

  const recommendation = useMemo(
    () => (selectedOrder ? recommendVehicles({ order: selectedOrder, vehicles }) : null),
    [selectedOrder, vehicles],
  );

  const selectedRoute = routes.find((r) => r.id === selectedRouteId) ?? routes[0] ?? null;

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
      {/* Left — orders awaiting assignment */}
      <div className="xl:col-span-3">
        <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h3 className="text-sm font-bold text-slate-800">Orders</h3>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
              {unassigned.length} unassigned
            </span>
          </div>
          <div className="max-h-[560px] divide-y divide-slate-100 overflow-y-auto">
            {unassigned.length === 0 ? (
              <EmptyState icon={Truck} title="All orders assigned" description="No orders are waiting for a vehicle." />
            ) : (
              unassigned.map((order) => {
                const active = selectedOrderId === order.id;
                return (
                  <button
                    key={order.id}
                    type="button"
                    onClick={() => {
                      setSelectedOrderId(order.id);
                      setSelectedRouteId(null);
                    }}
                    className={`block w-full px-4 py-3 text-left transition-colors ${active ? "bg-brand-50/60" : "hover:bg-slate-50"}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-800">{order.shop.name}</p>
                        <p className="flex items-center gap-1 text-[11px] text-slate-400">
                          <MapPin size={10} />
                          {formatAddressShort(order.shop.address)}
                        </p>
                        <p className="mt-0.5 text-[11px] text-slate-400">
                          {order.birds.toLocaleString("en-IN")} birds · {order.boxes} boxes · {order.deadlineLabel}
                        </p>
                      </div>
                      <PriorityBadge priority={order.priority} />
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Center — route visualization */}
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
                  onClick={() => {
                    setSelectedRouteId(route.id);
                    setSelectedOrderId(null);
                  }}
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

          {selectedRoute ? (
            <RouteTimeline route={selectedRoute} />
          ) : (
            <MapPlaceholder route={null} />
          )}
        </div>
      </div>

      {/* Right — decision panel */}
      <div className="xl:col-span-4">
        {selectedOrder && recommendation ? (
          <VehicleComparison
            order={selectedOrder}
            result={recommendation}
            onAssign={(assignment) => {
              onAssign(selectedOrder.id, assignment);
              setSelectedOrderId(null);
            }}
          />
        ) : selectedRoute ? (
          <div className="space-y-4">
            <RouteCalculationCard route={selectedRoute} />
            <RouteStopList route={selectedRoute} />
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200/80 bg-white p-10 text-center">
            <p className="text-sm font-semibold text-slate-700">Select an order or route</p>
            <p className="mt-1 text-xs text-slate-400">
              Choose an unassigned order to compare vehicles, or a route to review its plan.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
