// src/modules/order/components/ShopAssignmentTab.tsx
// Shop Assignment workspace: pending shop orders (left) + recommended vehicles
// for the selected order (right). Recommendations are computed against ACTIVE
// trips (Trip Entry) via the existing hierarchical recommendation service.

import { useMemo, useState } from "react";
import { MapPin, PackageCheck } from "lucide-react";
import type { RouteVehicle } from "../types/routeTypes";
import PriorityBadge from "./PriorityBadge";
import VehicleComparison from "./VehicleComparison";
import EmptyState from "./EmptyState";
import { useOrders } from "../store/orderContext";
import { recommendVehicles } from "../services/vehicleRecommendationService";

interface ShopAssignmentTabProps {
  vehicles: RouteVehicle[];
}

export default function ShopAssignmentTab({ vehicles }: ShopAssignmentTabProps) {
  const { orders, isLoading, assignVehicle } = useOrders();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const pending = useMemo(
    () => orders.filter((o) => !o.vehicleAssignment && o.status !== "Cancelled" && o.status !== "Delivered"),
    [orders],
  );

  const selectedOrder = useMemo(
    () => pending.find((o) => o.id === selectedId) ?? null,
    [pending, selectedId],
  );

  const recommendation = useMemo(
    () => (selectedOrder && vehicles.length > 0 ? recommendVehicles({ order: selectedOrder, vehicles }) : null),
    [selectedOrder, vehicles],
  );

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
      {/* Left — pending shops */}
      <div className="xl:col-span-5">
        <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h3 className="text-sm font-bold text-slate-800">Pending Shops</h3>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">{pending.length}</span>
          </div>
          <div className="max-h-[560px] divide-y divide-slate-100 overflow-y-auto">
            {isLoading ? (
              <div className="p-6 text-center text-xs text-slate-400">Loading orders…</div>
            ) : pending.length === 0 ? (
              <EmptyState icon={PackageCheck} title="No pending shops" description="All orders are assigned or completed." />
            ) : (
              pending.map((order) => (
                <button
                  key={order.id}
                  type="button"
                  onClick={() => setSelectedId(order.id)}
                  className={`block w-full px-4 py-3 text-left transition-colors ${selectedId === order.id ? "bg-brand-50/60" : "hover:bg-slate-50"}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-800">{order.shop.name}</p>
                      <p className="flex items-center gap-1 text-[11px] text-slate-400">
                        <MapPin size={10} />
                        {order.shop.location} · {order.birds.toLocaleString("en-IN")} birds · {order.deadlineLabel}
                      </p>
                    </div>
                    <PriorityBadge priority={order.priority} />
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Right — recommended vehicles */}
      <div className="xl:col-span-7">
        {selectedOrder && recommendation ? (
          <VehicleComparison
            order={selectedOrder}
            result={recommendation}
            onAssign={(assignment) => {
              assignVehicle(selectedOrder.id, assignment);
              setSelectedId(null);
            }}
          />
        ) : (
          <div className="rounded-2xl border border-slate-200/80 bg-white p-10 text-center">
            {vehicles.length === 0 ? (
              <EmptyState
                icon={PackageCheck}
                title="No active vehicle trips"
                description="Create and submit a trip in Trip Entry (with farm/pickup) before assigning shops."
              />
            ) : (
              <>
                <p className="text-sm font-semibold text-slate-700">Select a pending shop</p>
                <p className="mt-1 text-xs text-slate-400">Choose an order on the left to see recommended vehicles.</p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
