// src/modules/order/components/OrderTabs.tsx
// Segmented tab navigation for the single Orders workspace.

import type { LucideIcon } from "lucide-react";
import { ClipboardList, Route, Truck, AlertTriangle, PackageCheck } from "lucide-react";

export type OrderTabKey = "orders" | "assignment" | "trips" | "planning" | "exceptions";

interface OrderTabDef {
  key: OrderTabKey;
  label: string;
  icon: LucideIcon;
  badge?: number;
}

const ORDER_TABS: OrderTabDef[] = [
  { key: "orders", label: "Orders", icon: ClipboardList },
  { key: "assignment", label: "Shop Assignment", icon: PackageCheck },
  { key: "trips", label: "Vehicle Trips", icon: Truck },
  { key: "planning", label: "Delivery Planning", icon: Route },
  { key: "exceptions", label: "Exceptions", icon: AlertTriangle },
];

interface OrderTabsProps {
  active: OrderTabKey;
  onChange: (tab: OrderTabKey) => void;
  badges?: Partial<Record<OrderTabKey, number>>;
}

export default function OrderTabs({ active, onChange, badges }: OrderTabsProps) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto rounded-xl border border-slate-200/80 bg-white p-1 shadow-sm">
      {ORDER_TABS.map((tab) => {
        const Icon = tab.icon;
        const isActive = active === tab.key;
        const badge = badges?.[tab.key] ?? 0;
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onChange(tab.key)}
            className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors ${
              isActive
                ? "bg-brand-600 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            <Icon size={14} />
            {tab.label}
            {badge > 0 && (
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                  isActive ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
                }`}
              >
                {badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
