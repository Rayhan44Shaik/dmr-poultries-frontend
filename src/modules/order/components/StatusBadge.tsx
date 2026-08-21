// src/modules/order/components/StatusBadge.tsx
// Readable order status badge with a stable colour ramp.

import type { OrderStatus } from "../types/orderTypes";

const TONES: Record<OrderStatus, string> = {
  Draft: "bg-slate-100 text-slate-600 border-slate-200",
  Pending: "bg-sky-50 text-sky-700 border-sky-200",
  Confirmed: "bg-indigo-50 text-indigo-700 border-indigo-200",
  "Awaiting Assignment": "bg-violet-50 text-violet-700 border-violet-200",
  Assigned: "bg-blue-50 text-blue-700 border-blue-200",
  "Pickup Pending": "bg-cyan-50 text-cyan-700 border-cyan-200",
  "Picked Up": "bg-teal-50 text-teal-700 border-teal-200",
  "Route Planned": "bg-emerald-50 text-emerald-700 border-emerald-200",
  "In Transit": "bg-amber-50 text-amber-700 border-amber-200",
  Arrived: "bg-lime-50 text-lime-700 border-lime-200",
  Delivered: "bg-green-50 text-green-700 border-green-200",
  Cancelled: "bg-rose-50 text-rose-700 border-rose-200",
};

export default function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-semibold ${TONES[status]}`}>
      {status}
    </span>
  );
}
