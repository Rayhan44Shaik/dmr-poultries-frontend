// src/modules/order/components/OrderHeader.tsx
// Page header: title, subtitle and primary actions.

import { PackageSearch, Plus, RefreshCw } from "lucide-react";

interface OrderHeaderProps {
  onNewOrder: () => void;
  onRefresh: () => void;
  refreshing?: boolean;
}

export default function OrderHeader({ onNewOrder, onRefresh, refreshing = false }: OrderHeaderProps) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-slate-200/80 bg-white px-6 py-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
          <PackageSearch size={26} />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Orders</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Manage shop requirements, priorities, vehicle assignments and delivery routes.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onRefresh}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50"
        >
          <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
          Refresh
        </button>
        <button
          type="button"
          onClick={onNewOrder}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-brand-700"
        >
          <Plus size={15} />
          New Order
        </button>
      </div>
    </div>
  );
}
