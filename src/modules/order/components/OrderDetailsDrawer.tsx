// src/modules/order/components/OrderDetailsDrawer.tsx
// Slide-in detail drawer for a single order.

import { X } from "lucide-react";
import type { Order } from "../types/orderTypes";
import PriorityBadge from "./PriorityBadge";
import StatusBadge from "./StatusBadge";
import GPSStatus from "./GPSStatus";
import { distanceForOrder } from "../utils/routeUtils";
import { formatDeliveryDate, formatDistanceKm, formatEtaMinutes } from "../utils/orderFormat";

interface OrderDetailsDrawerProps {
  order: Order | null;
  onClose: () => void;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-slate-100 px-6 py-5 first:border-t-0">
      <h3 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">{title}</h3>
      {children}
    </section>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5">
      <span className="text-xs text-slate-400">{label}</span>
      <span className="text-right text-xs font-medium text-slate-700">{value}</span>
    </div>
  );
}

export default function OrderDetailsDrawer({ order, onClose }: OrderDetailsDrawerProps) {
  if (!order) return null;
  const distance = distanceForOrder(order);
  const assignment = order.vehicleAssignment;

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} />
      <aside className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-white shadow-pop">
        <div className="flex items-center justify-between border-b border-slate-200/80 px-6 py-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Order</p>
            <h2 className="text-lg font-bold text-slate-800">{order.orderNumber}</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700" aria-label="Close details">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="flex items-center gap-2 px-6 pt-5">
            <PriorityBadge priority={order.priority} />
            <StatusBadge status={order.status} />
            {order.importantCustomer && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
                ★ Important Customer
              </span>
            )}
          </div>

          <Section title="Order Information">
            <Row label="Shop" value={order.shop.name} />
            <Row label="Bird Type" value={order.birdType} />
            <Row label="Birds" value={order.birds.toLocaleString("en-IN")} />
            <Row label="Boxes" value={order.boxes || "—"} />
            <Row label="Requirement" value={order.requirementType} />
            <Row label="Expected Weight" value={order.expectedWeightKg != null ? `${order.expectedWeightKg.toLocaleString("en-IN")} kg` : "—"} />
            <Row label="Delivery Date" value={formatDeliveryDate(order.deliveryDate)} />
            <Row label="Deadline" value={order.deliveryDeadline} />
            <Row label="Window" value={order.deliveryWindow ?? "—"} />
            <Row label="Remarks" value={order.remarks || "—"} />
          </Section>

          <Section title="Location">
            <div className="space-y-3">
              <div>
                <p className="mb-1 text-xs font-semibold text-slate-500">Shop GPS</p>
                <GPSStatus gps={order.shop.gps} status={order.shop.gpsStatus} />
              </div>
              <div>
                <p className="mb-1 text-xs font-semibold text-slate-500">Pickup (Farm) GPS</p>
                {order.pickupSource ? (
                  <GPSStatus gps={order.pickupSource.gps} status={order.pickupSource.gpsStatus} />
                ) : (
                  <p className="text-xs text-slate-400">Not assigned</p>
                )}
              </div>
              <Row label="Distance" value={formatDistanceKm(distance)} />
              <Row label="ETA" value={formatEtaMinutes(distance)} />
            </div>
          </Section>

          <Section title="Assignment">
            {assignment ? (
              <>
                <Row label="Vehicle" value={assignment.vehicleNo} />
                <Row label="Driver" value={assignment.driverName} />
                <Row label="Supervisor" value={assignment.supervisorName} />
                <Row label="Trip" value={assignment.tripNo} />
                <Row label="Pickup Farm" value={assignment.pickupFarm} />
                <Row label="Type" value={assignment.assignmentType} />
              </>
            ) : (
              <p className="text-xs text-slate-400">Awaiting vehicle assignment.</p>
            )}
          </Section>

          <Section title="Route">
            {assignment ? (
              <>
                <Row label="Route Status" value={assignment.routeStatus} />
                <Row label="Orders on trip" value={assignment.orderCount} />
                <Row label="Tracking" value="Prepared — connect GPS backend" />
              </>
            ) : (
              <p className="text-xs text-slate-400">No route planned yet.</p>
            )}
          </Section>
        </div>
      </aside>
    </div>
  );
}
