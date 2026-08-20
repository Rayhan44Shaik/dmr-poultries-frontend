// src/modules/order/pages/RoutePlanningPage.tsx
// Route planning screen: orders -> routes -> details.

import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Route as RouteIcon } from "lucide-react";
import RoutePlanner from "../components/RoutePlanner";
import { useOrders } from "../store/orderContext";
import { groupOrdersByVehicle } from "../utils/routeUtils";
import type { VehicleAssignment as VehicleAssignmentType } from "../types/orderTypes";

export default function RoutePlanningPage() {
  const navigate = useNavigate();
  const { orders, isLoading, assignVehicle } = useOrders();

  const routes = useMemo(() => groupOrdersByVehicle(orders), [orders]);
  const assignedCount = useMemo(
    () => orders.filter((o) => o.vehicleAssignment != null).length,
    [orders],
  );

  return (
    <div className="mx-auto max-w-[1600px] px-3 py-4 md:px-6 md:py-6">
      <button
        type="button"
        onClick={() => navigate("/order")}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 transition-colors hover:text-slate-800"
      >
        <ArrowLeft size={16} />
        Back to Orders
      </button>

      <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white px-6 py-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
            <RouteIcon size={26} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">Route Planning</h1>
            <p className="mt-0.5 text-sm text-slate-500">
              Assign orders to vehicles and review delivery sequences.
            </p>
          </div>
        </div>
        <div className="flex gap-6 text-center">
          <div>
            <p className="text-2xl font-bold text-slate-800">{routes.length}</p>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Routes</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-800">{assignedCount}</p>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Assigned</p>
          </div>
        </div>
      </div>

      <RoutePlanner
        orders={orders}
        routes={routes}
        isLoading={isLoading}
        onAssign={(orderId: string, assignment: VehicleAssignmentType) => assignVehicle(orderId, assignment)}
      />
    </div>
  );
}
