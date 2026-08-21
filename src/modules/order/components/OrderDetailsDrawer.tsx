// src/modules/order/components/OrderDetailsDrawer.tsx
// Slide-in detail drawer for a single order.

import { X } from "lucide-react";
import type { Order } from "../types/orderTypes";
import PriorityBadge from "./PriorityBadge";
import StatusBadge from "./StatusBadge";
import GPSStatus from "./GPSStatus";
import AddressBlock from "./AddressBlock";
import { distanceForOrder } from "../utils/routeUtils";
import { mockRouteCalculationService, DEFAULT_AVG_SPEED_KMH } from "../services/routeCalculationService";
import { formatAddress, formatDeliveryDate, formatDistanceKm, formatTravelMinutes } from "../utils/orderFormat";
import { formatClock, parseHHmm } from "../utils/businessTime";
import { classifyBuffer, classifyFeasibility } from "../utils/feasibility";

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

const FEASIBILITY_LABEL: Record<string, { text: string; className: string }> = {
  "Can Meet": { text: "✓ Can Meet", className: "text-emerald-700 bg-emerald-50 border-emerald-200" },
  "At Risk": { text: "⚠ At Risk", className: "text-amber-700 bg-amber-50 border-amber-200" },
  "Cannot Meet": { text: "✕ Cannot Meet", className: "text-rose-700 bg-rose-50 border-rose-200" },
  Unknown: { text: "—", className: "text-slate-500 bg-slate-50 border-slate-200" },
};

export default function OrderDetailsDrawer({ order, onClose }: OrderDetailsDrawerProps) {
  if (!order) return null;
  const distance = distanceForOrder(order);
  const assignment = order.vehicleAssignment;

  // Delivery calculation (single-leg, pickup → shop).
  const departureMinutes = assignment?.departureTime ? parseHHmm(assignment.departureTime) : null;
  const travelMinutes = distance != null ? mockRouteCalculationService.estimateTravelMinutes(distance) : null;
  const arrivalMinutes = departureMinutes != null && travelMinutes != null ? departureMinutes + travelMinutes : null;
  const deadlineMinutes = parseHHmm(order.deadlineTime);
  const bufferMinutes =
    arrivalMinutes != null && deadlineMinutes != null ? deadlineMinutes - arrivalMinutes : null;
  const feasibility = classifyFeasibility(bufferMinutes);
  const bufferState = classifyBuffer(bufferMinutes);
  const feas = FEASIBILITY_LABEL[feasibility] ?? FEASIBILITY_LABEL.Unknown;

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
          <div className="flex flex-wrap items-center gap-2 px-6 pt-5">
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
            <Row label="Address" value={formatAddress(order.shop.address)} />
            <Row label="Bird Type" value={order.birdType} />
            <Row label="Birds" value={order.birds.toLocaleString("en-IN")} />
            <Row label="Boxes" value={order.boxes || "—"} />
            <Row label="Requirement" value={order.requirementType} />
            <Row label="Expected Weight" value={order.expectedWeightKg != null ? `${order.expectedWeightKg.toLocaleString("en-IN")} kg` : "—"} />
            <Row label="Remarks" value={order.remarks || "—"} />
          </Section>

          <Section title="Delivery">
            <Row label="Date" value={formatDeliveryDate(order.deliveryDate)} />
            <Row label="Deadline" value={`${order.deadlineLabel} (${order.deadlineTime})`} />
            <Row label="Window" value={order.deliveryWindow ?? "—"} />
          </Section>

          <Section title="Location">
            <AddressBlock title="Shop" address={order.shop.address} gps={order.shop.gps} gpsStatus={order.shop.gpsStatus} />
            <div className="mt-3">
              {order.pickupSource ? (
                <AddressBlock title="Pickup (Farm)" address={order.pickupSource.address} gps={order.pickupSource.gps} gpsStatus={order.pickupSource.gpsStatus} />
              ) : (
                <p className="text-xs text-slate-400">Pickup not assigned.</p>
              )}
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
                <Row label="Departure" value={assignment.departureTime} />
                <Row label="Type" value={assignment.assignmentType} />
              </>
            ) : (
              <p className="text-xs text-slate-400">Awaiting vehicle assignment.</p>
            )}
          </Section>

          <Section title="Calculation">
            <Row label="Distance" value={formatDistanceKm(distance)} />
            <Row label="Travel Time" value={formatTravelMinutes(travelMinutes)} />
            <Row label="Predicted Arrival" value={arrivalMinutes != null ? formatClock(arrivalMinutes) : "—"} />
            <Row label="Buffer" value={bufferMinutes != null ? `${bufferMinutes} min (${bufferState})` : "—"} />
            <Row
              label="Deadline Status"
              value={<span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${feas.className}`}>{feas.text}</span>}
            />
            <p className="mt-2 text-[11px] text-slate-400">
              Frontend road estimate — average speed assumption {DEFAULT_AVG_SPEED_KMH} km/h. Real road routing not yet connected.
            </p>
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

          <Section title="Tracking">
            <GPSStatus gps={order.shop.gps} status={order.shop.gpsStatus} label="Shop GPS" />
            <p className="mt-2 text-[11px] text-slate-400">Live tracking requires a GPS backend.</p>
          </Section>
        </div>
      </aside>
    </div>
  );
}
