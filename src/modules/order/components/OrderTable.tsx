// src/modules/order/components/OrderTable.tsx
// Main orders table with horizontal scrolling and expandable rows.

import { memo, useState } from "react";
import { ChevronDown, ChevronRight, Eye, MapPin } from "lucide-react";
import type { Order } from "../types/orderTypes";
import PriorityBadge from "./PriorityBadge";
import StatusBadge from "./StatusBadge";
import GPSStatus from "./GPSStatus";
import { distanceForOrder } from "../utils/routeUtils";
import { formatDeliveryDate, formatDistanceKm, formatTravelMinutes } from "../utils/orderFormat";

interface OrderTableProps {
  orders: Order[];
  isLoading: boolean;
  onOpenDetails: (order: Order) => void;
}

function CustomerType({ important }: { important: boolean }) {
  if (!important) return <span className="text-xs text-slate-400">Regular</span>;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
      ★ Important
    </span>
  );
}

function OrderTable({ orders, isLoading, onOpenDetails }: OrderTableProps) {
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
        <thead className="border-b border-slate-200/70 bg-slate-50/80">
          <tr className="whitespace-nowrap text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
            <th className="w-8 px-2 py-3" />
            <th className="px-3 py-3">Order No</th>
            <th className="px-3 py-3">Shop</th>
            <th className="px-3 py-3">Bird Type</th>
            <th className="px-3 py-3 text-right">Birds</th>
            <th className="px-3 py-3 text-right">Boxes</th>
            <th className="px-3 py-3">Priority</th>
            <th className="px-3 py-3">Customer</th>
            <th className="px-3 py-3">Delivery Date</th>
            <th className="px-3 py-3">Deadline</th>
            <th className="px-3 py-3">Pickup / Farm</th>
            <th className="px-3 py-3">Vehicle</th>
            <th className="px-3 py-3 text-right">Distance</th>
            <th className="px-3 py-3">ETA</th>
            <th className="px-3 py-3">Status</th>
            <th className="px-3 py-3 text-center">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {orders.map((order) => {
            const isExpanded = expanded === order.id;
            const distance = distanceForOrder(order);
            return (
              <FragmentRow
                key={order.id}
                order={order}
                distance={distance}
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
  distance,
  isExpanded,
  onToggle,
  onOpen,
}: {
  order: Order;
  distance: number | null;
  isExpanded: boolean;
  onToggle: () => void;
  onOpen: () => void;
}) {
  return (
    <>
      <tr
        className={`cursor-pointer transition-colors hover:bg-slate-50/80 ${isExpanded ? "bg-slate-50/60" : ""}`}
        onClick={onToggle}
      >
        <td className="px-2 py-3 text-center text-slate-400">
          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </td>
        <td className="px-3 py-3 font-semibold text-slate-800">{order.orderNumber}</td>
        <td className="px-3 py-3">
          <div className="font-semibold text-slate-700">{order.shop.name}</div>
          <div className="flex items-center gap-1 text-[11px] text-slate-400">
            <MapPin size={10} />
            {order.shop.location}
          </div>
        </td>
        <td className="px-3 py-3 text-slate-600">{order.birdType}</td>
        <td className="px-3 py-3 text-right font-semibold text-slate-700">{order.birds.toLocaleString("en-IN")}</td>
        <td className="px-3 py-3 text-right text-slate-600">{order.boxes || "—"}</td>
        <td className="px-3 py-3"><PriorityBadge priority={order.priority} /></td>
        <td className="px-3 py-3"><CustomerType important={order.importantCustomer} /></td>
        <td className="px-3 py-3 whitespace-nowrap text-slate-600">{formatDeliveryDate(order.deliveryDate)}</td>
        <td className="px-3 py-3 whitespace-nowrap text-slate-600">{order.deadlineLabel}</td>
        <td className="px-3 py-3 text-slate-600">
          {order.pickupSource ? (
            <span className="inline-flex items-center gap-1.5">
              {order.pickupSource.farmName}
              <span className="text-[10px] text-slate-400">({order.pickupSource.location})</span>
            </span>
          ) : (
            <span className="text-slate-400">Not assigned</span>
          )}
        </td>
        <td className="px-3 py-3 text-slate-600">
          {order.vehicleAssignment ? (
            <div>
              <div className="font-medium text-slate-700">{order.vehicleAssignment.vehicleNo}</div>
              <div className="text-[11px] text-slate-400">{order.vehicleAssignment.driverName}</div>
            </div>
          ) : (
            <span className="text-slate-400">—</span>
          )}
        </td>
        <td className="px-3 py-3 text-right font-medium text-slate-600">
          {distance != null ? formatDistanceKm(distance) : <span className="text-slate-400">Pending</span>}
        </td>
        <td className="px-3 py-3 text-slate-600">{formatTravelMinutes(distance != null ? Math.round((distance / 40) * 60) : null)}</td>
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
            View
          </button>
        </td>
      </tr>

      {isExpanded && (
        <tr className="bg-slate-50/60">
          <td colSpan={16} className="px-6 py-4">
            <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-xs text-slate-600 md:grid-cols-4">
              <div>
                <span className="font-semibold text-slate-400">Requirement</span>
                <p>{order.requirementType}</p>
              </div>
              <div>
                <span className="font-semibold text-slate-400">Expected Weight</span>
                <p>{order.expectedWeightKg != null ? `${order.expectedWeightKg.toLocaleString("en-IN")} kg` : "—"}</p>
              </div>
              <div>
                <span className="font-semibold text-slate-400">Delivery Window</span>
                <p>{order.deliveryWindow ?? "—"}</p>
              </div>
              <div>
                <span className="font-semibold text-slate-400">Address</span>
                <p>
                  {order.shop.address.line1}, {order.shop.address.city}, {order.shop.address.pinCode}
                </p>
              </div>
              <div className="col-span-2">
                <span className="font-semibold text-slate-400">Shop GPS</span>
                <div className="mt-1">
                  <GPSStatus gps={order.shop.gps} status={order.shop.gpsStatus} />
                </div>
              </div>
              <div className="col-span-2">
                <span className="font-semibold text-slate-400">Remarks</span>
                <p>{order.remarks || "—"}</p>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export default memo(OrderTable);
