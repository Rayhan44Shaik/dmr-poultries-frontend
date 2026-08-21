// src/modules/order/components/PriorityBadge.tsx
// Priority indicator that never relies on colour alone — always readable text.

import type { OrderPriority } from "../types/orderTypes";

const STYLES: Record<OrderPriority, string> = {
  Normal: "bg-slate-100 text-slate-600 border-slate-200",
  Important: "bg-amber-50 text-amber-700 border-amber-200",
  Urgent: "bg-rose-50 text-rose-700 border-rose-200",
};

const DOTS: Record<OrderPriority, string> = {
  Normal: "bg-slate-400",
  Important: "bg-amber-500",
  Urgent: "bg-rose-500",
};

export default function PriorityBadge({ priority }: { priority: OrderPriority }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${STYLES[priority]}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${DOTS[priority]}`} aria-hidden="true" />
      {priority}
    </span>
  );
}
