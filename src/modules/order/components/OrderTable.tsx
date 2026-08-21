// src/modules/order/components/OrderTable.tsx
// Orders tab table — compact primary columns, expandable full detail rows, and
// a shop cell that acts as the visual anchor (name + location + GPS status).
// Never shows internal ids.

import { memo, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Eye, MapPin, Sparkles, Star } from "lucide-react";
import type { Order } from "../types/orderTypes";
import type { RouteVehicle } from "../types/routeTypes";
import PriorityBadge from "./PriorityBadge";
import StatusBadge from "./StatusBadge";
import GPSStatus from "./GPSStatus";
import { recommendVehicles } from "../services/vehicleRecommendationService";
import { formatAddress } from "../utils/orderFormat";
import { formatDeliveryDate } from "../utils/orderFormat";

interface OrderTableProps {
  orders: Order[];
  isLoading: boolean;
  vehicles: RouteVehicle[];
  onOpenDetails: (order: Order) => void;
}

function requirementLabel(order: Order): string {
  const birds = order.birds > 0 ? `${order.birds.toLocaleString("en-IN")} birds` : null;
  const boxes = order.boxes > 0 ? `${order.boxes} boxes` : null;
  if (birds && boxes) return `${birds} + ${boxes}`;
  return birds ?? boxes ?? "—";
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1">
      <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</span>
      <span className="text-right text-xs font-medium text-slate-700">{value}</span>
    </div>
  );
}

function OrderTable({ orders, isLoading, vehicles, onOpenDetails }: OrderTableProps) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="bg-white p-10 text-center">
        <div className="inline-flex items-center gap-2 text-sm font-medium text-slate-400">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-brand-600" />
          Loading orders…
        </div>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="bg-white p-12 text-center">
        <p className="text-sm font-semibold text-slate-700">No orders found.</p>
        <p className="mt-1 text-xs text-slate-400">Create a new shop order to get started.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-xs">
        <thead className="sticky top-0 z-10 border-b border-slate-200/70 bg-slate-50/95">
          <tr className="whitespace-nowrap text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
            <th className="w-8 px-2 py-2.5" />
            <th className="px-3 py-2.5">Order No</th>
            <th className="px-3 py-2.5">Shop</th>
            <th className="px-3 py-2.5 text-right">Requirement</th>
            <th className="px-3 py-2.5">Priority</th>
            <th className="px-3 py-2.5">Customer</th>
            <th className="px-3 py-2.5">Deadline</th>
            <th className="px-3 py-2.5">Assignment</th>
            <th className="px-3 py-2.5">Status</th>
            <th className="px-3 py-2.5 text-center">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {orders.map((order) => {
            const isExpanded = expanded === order.id;
            return (
              <FragmentRow
                key={order.id}
                order={order}
                vehicles={vehicles}
                isExpanded={isExpanded}
                onToggle={() => setExpanded(isExpanded ? null : order.id)}
                onOpen={() => onOpenDetails(order)}
              />
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function FragmentRow({
  order,
  vehicles,
  isExpanded,
  onToggle,
  onOpen,
}: {
  order: Order;
  vehicles: RouteVehicle[];
  isExpanded: boolean;
  onToggle: () => void;
  onOpen: () => void;
}) {
  const assignment = order.vehicleAssignment;

  // Light recommendation for the expanded row only.
  const recommendation = useMemo(
    () => (isExpanded && vehicles.length > 0 ? recommendVehicles({ order, vehicles }) : null),
    [isExpanded, order, vehicles],
  );

  return (
    <>
      <tr className={`cursor-pointer transition-colors hover:bg-slate-50/80 ${isExpanded ? "bg-slate-50/60" : ""}`} onClick={onToggle}>
        <td className="px-2 py-3 text-center text-slate-400">
          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </td>
        <td className="px-3 py-3 font-semibold text-slate-800">{order.orderNumber}</td>
        <td className="px-3 py-3">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-slate-700">{order.shop.name}</span>
            {order.importantCustomer && <Star size={12} className="shrink-0 text-amber-500" aria-label="Important customer" />}
          </div>
          <div className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-400">
            <MapPin size={10} />
            {order.shop.location}
          </div>
          <div className="mt-1">
            <GPSStatus gps={order.shop.gps} status={order.shop.gpsStatus} showCoordinates={false} label="GPS" />
          </div>
        </td>
        <td className="px-3 py-3 text-right font-semibold text-slate-700">{requirementLabel(order)}</td>
        <td className="px-3 py-3"><PriorityBadge priority={order.priority} /></td>
        <td className="px-3 py-3">
          {order.importantCustomer ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">Important</span>
          ) : (
            <span className="text-xs text-slate-400">Regular</span>
          )}
        </td>
        <td className="px-3 py-3 whitespace-nowrap text-slate-600">{order.deadlineLabel}</td>
        <td className="px-3 py-3">
          {assignment ? (
            <div>
              <div className="font-medium text-slate-700">{assignment.vehicleNo}</div>
              <div className="text-[11px] text-slate-400">{assignment.tripNo}</div>
            </div>
          ) : (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">Unassigned</span>
          )}
        </td>
        <td className="px-3 py-3"><StatusBadge status={order.status} /></td>
        <td className="px-3 py-3 text-center">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpen();
            }}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-600 transition-colors hover:bg-slate-100"
            title="View details"
          >
            <Eye size={12} />
          </button>
        </td>
      </tr>

      {isExpanded && (
        <tr className="bg-slate-50/60">
          <td colSpan={10} className="px-6 py-4">
            <div className="grid grid-cols-1 gap-x-8 gap-y-1 md:grid-cols-2 lg:grid-cols-3">
              <DetailRow label="Bird Type" value={order.birdType} />
              <DetailRow label="Birds" value={order.birds.toLocaleString("en-IN")} />
              <DetailRow label="Boxes" value={order.boxes || "—"} />
              <DetailRow label="Expected Weight" value={order.expectedWeightKg != null ? `${order.expectedWeightKg.toLocaleString("en-IN")} kg` : "—"} />
              <DetailRow label="Delivery Date" value={formatDeliveryDate(order.deliveryDate)} />
              <DetailRow label="Deadline" value={`${order.deadlineLabel} (${order.deadlineTime})`} />
              <DetailRow label="Important Customer" value={order.importantCustomer ? "Yes" : "No"} />
              <DetailRow label="Shop Address" value={formatAddress(order.shop.address)} />
              <DetailRow label="Pickup / Farm" value={order.pickupSource ? `${order.pickupSource.farmName} · ${order.pickupSource.location}` : "Not assigned"} />
              <DetailRow
                label="Recommended Vehicle"
                value={
                  recommendation?.recommended ? (
                    <span className="inline-flex items-center gap-1 text-brand-700">
                      <Sparkles size={12} />
                      {recommendation.recommended.vehicle.vehicleNo}
                      <span className="text-slate-400">({recommendation.recommended.tier})</span>
                    </span>
                  ) : (
                    "—"
                  )
                }
              />
              <DetailRow label="Planning State" value={recommendation?.recommended?.planningState ?? "—"} />
              <DetailRow label="Remarks" value={order.remarks || "—"} />
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export default memo(OrderTable);
