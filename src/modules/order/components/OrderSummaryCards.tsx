// src/modules/order/components/OrderSummaryCards.tsx
// Dashboard summary cards for the Order page.

import { memo } from "react";
import {
  Activity,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Siren,
  Truck,
} from "lucide-react";
import type { OrderSummary } from "../utils/summary";

function Card({
  label,
  value,
  icon,
  iconClass,
  isLoading,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  iconClass: string;
  isLoading: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-slate-200/80 bg-white px-4 py-3.5 shadow-sm">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
        {isLoading ? (
          <div className="mt-1.5 h-5 w-10 animate-pulse rounded bg-slate-100" />
        ) : (
          <p className="mt-0.5 text-2xl font-bold text-slate-800">{value.toLocaleString("en-IN")}</p>
        )}
      </div>
      <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${iconClass}`}>{icon}</div>
    </div>
  );
}

function OrderSummaryCards({ summary, isLoading }: { summary: OrderSummary; isLoading: boolean }) {
  const cards = [
    { label: "Total Orders", value: summary.total, icon: <ClipboardList size={18} />, iconClass: "bg-slate-100 text-slate-600" },
    { label: "Pending", value: summary.pending, icon: <Clock3 size={18} />, iconClass: "bg-sky-50 text-sky-600" },
    { label: "Urgent", value: summary.urgent, icon: <Siren size={18} />, iconClass: "bg-rose-50 text-rose-600" },
    { label: "Assigned", value: summary.assigned, icon: <Truck size={18} />, iconClass: "bg-blue-50 text-blue-600" },
    { label: "In Delivery", value: summary.inDelivery, icon: <Activity size={18} />, iconClass: "bg-amber-50 text-amber-600" },
    { label: "Completed", value: summary.completed, icon: <CheckCircle2 size={18} />, iconClass: "bg-emerald-50 text-emerald-600" },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
      {cards.map((c) => (
        <Card key={c.label} label={c.label} value={c.value} icon={c.icon} iconClass={c.iconClass} isLoading={isLoading} />
      ))}
    </div>
  );
}

export default memo(OrderSummaryCards);
