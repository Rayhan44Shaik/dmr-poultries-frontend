// src/modules/order/components/DeliveryPlanningTab.tsx
// Delivery Planning tab: per-active-vehicle route timeline. Reuses the existing
// sequential delivery-sequencing + summary/timeline components.

import { useMemo, useState } from "react";
import { Route as RouteIcon } from "lucide-react";
import type { RouteVehicle } from "../types/routeTypes";
import DeliveryPlanSummary from "./DeliveryPlanSummary";
import RouteTimeline from "./RouteTimeline";
import RouteStopList from "./RouteStopList";
import EmptyState from "./EmptyState";
import { useOrders } from "../store/orderContext";
import { groupOrdersByVehicle } from "../utils/routeUtils";
import { DEFAULT_AVG_SPEED_KMH } from "../services/routeCalculationService";

interface DeliveryPlanningTabProps {
  vehicles: RouteVehicle[];
}

export default function DeliveryPlanningTab({ vehicles }: DeliveryPlanningTabProps) {
  const { orders } = useOrders();
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);

  const routes = useMemo(() => groupOrdersByVehicle(orders, vehicles), [orders, vehicles]);
  const selectedRoute = routes.find((r) => r.id === selectedRouteId) ?? routes[0] ?? null;

  if (vehicles.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <EmptyState
          icon={RouteIcon}
          title="No active vehicle trips"
          description="Delivery planning requires an active trip from Trip Entry."
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Vehicle / trip selector */}
      <div className="flex flex-wrap items-center gap-2">
        {routes.length === 0 ? (
          <p className="text-xs text-slate-400">No shops assigned to active vehicles yet — assign shops in the Shop Assignment tab.</p>
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

      {selectedRoute ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <DeliveryPlanSummary route={selectedRoute} />
          <div className="space-y-4">
            <RouteTimeline route={selectedRoute} />
            <RouteStopList route={selectedRoute} />
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-10 text-center">
          <p className="text-sm font-semibold text-slate-700">No route planned</p>
          <p className="mt-1 text-xs text-slate-400">Assign shops to active vehicles to build delivery routes.</p>
        </div>
      )}

      <p className="text-[11px] text-slate-400">
        Frontend road estimate — average speed assumption {DEFAULT_AVG_SPEED_KMH} km/h. Real routing not yet connected.
      </p>
    </div>
  );
}
