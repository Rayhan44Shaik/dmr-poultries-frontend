// src/modules/order/components/ExceptionsTab.tsx
// Unplanned / Exceptions tab: orders that cannot currently be planned, surfaced
// explicitly (never silently dropped). planned + unplanned = total is preserved.

import { useMemo } from "react";
import { AlertTriangle } from "lucide-react";
import type { Order } from "../types/orderTypes";
import type { RouteVehicle } from "../types/routeTypes";
import EmptyState from "./EmptyState";
import { useOrders } from "../store/orderContext";
import { recommendVehicles } from "../services/vehicleRecommendationService";
import { isValidCoordinate } from "../utils/gps";

interface ExceptionItem {
  orderId: string;
  orderNumber: string;
  shopName: string;
  priority: Order["priority"];
  problem: string;
  planningState: string;
}

interface ExceptionsTabProps {
  vehicles: RouteVehicle[];
}

export default function ExceptionsTab({ vehicles }: ExceptionsTabProps) {
  const { orders } = useOrders();

  const exceptions = useMemo<ExceptionItem[]>(() => {
    const items: ExceptionItem[] = [];
    for (const o of orders) {
      if (o.status === "Cancelled" || o.status === "Delivered") continue;

      // Unroutable — missing/invalid shop GPS.
      if (!isValidCoordinate(o.shop.gps)) {
        items.push({ orderId: o.id, orderNumber: o.orderNumber, shopName: o.shop.name, priority: o.priority, problem: "Shop GPS unavailable", planningState: "Unroutable" });
        continue;
      }

      // Already assigned → not an exception.
      if (o.vehicleAssignment) continue;

      // No active trip.
      if (vehicles.length === 0) {
        items.push({ orderId: o.id, orderNumber: o.orderNumber, shopName: o.shop.name, priority: o.priority, problem: "No active trip", planningState: "Unroutable" });
        continue;
      }

      const rec = recommendVehicles({ order: o, vehicles });
      if (!rec.recommended) {
        items.push({ orderId: o.id, orderNumber: o.orderNumber, shopName: o.shop.name, priority: o.priority, problem: rec.summary, planningState: "Unroutable" });
      } else if (rec.recommended.deadlineFeasible === "Cannot Meet") {
        items.push({ orderId: o.id, orderNumber: o.orderNumber, shopName: o.shop.name, priority: o.priority, problem: "Predicted to miss delivery deadline", planningState: "Cannot Meet" });
      } else if (rec.recommended.deadlineFeasible === "At Risk") {
        items.push({ orderId: o.id, orderNumber: o.orderNumber, shopName: o.shop.name, priority: o.priority, problem: "Tight delivery buffer", planningState: "At Risk" });
      }
    }
    return items;
  }, [orders, vehicles]);

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
        <h3 className="text-sm font-bold text-slate-800">Unplanned / Exceptions</h3>
        <span className="rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-600">{exceptions.length}</span>
      </div>

      {exceptions.length === 0 ? (
        <EmptyState icon={AlertTriangle} title="No exceptions" description="Every order is planned or assigned." />
      ) : (
        <div className="divide-y divide-slate-100">
          {exceptions.map((item) => (
            <div key={item.orderId} className="flex items-center gap-3 px-5 py-3">
              <AlertTriangle size={16} className="shrink-0 text-rose-500" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-800">{item.orderNumber}</p>
                <p className="text-[11px] text-slate-400">{item.shopName}</p>
              </div>
              <div className="hidden text-right sm:block">
                <p className="text-xs font-medium text-slate-600">{item.problem}</p>
                <p className="text-[11px] text-slate-400">{item.planningState}</p>
              </div>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                item.planningState === "Unroutable" ? "bg-rose-50 text-rose-700" : item.planningState === "Cannot Meet" ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-700"
              }`}>
                {item.planningState}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
