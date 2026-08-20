// src/modules/order/components/OrderFilters.tsx
// Search + filters UI for the Order list. Filtering logic lives in
// utils/orderFilters.ts (search matches order number, shop, vehicle, farm and
// driver — never just ids).

import { useMemo } from "react";
import { Filter, Search, X } from "lucide-react";
import type { Order } from "../types/orderTypes";
import { PRIORITIES } from "../utils/orderValidation";
import { EMPTY_FILTERS, ORDER_STATUSES, type OrderFilterState } from "../utils/orderFilters";

interface OrderFiltersProps {
  filters: OrderFilterState;
  onChange: (filters: OrderFilterState) => void;
  orders: Order[];
  resultCount: number;
  totalCount: number;
}

export default function OrderFilters({ filters, onChange, orders, resultCount, totalCount }: OrderFiltersProps) {
  const set = <K extends keyof OrderFilterState>(key: K, value: OrderFilterState[K]) =>
    onChange({ ...filters, [key]: value });

  const { shops, birdTypes, vehicles, pickupLocations } = useMemo(() => {
    const shopSet = new Map<string, string>();
    const birdSet = new Set<string>();
    const vehicleSet = new Set<string>();
    const pickupSet = new Set<string>();
    for (const o of orders) {
      shopSet.set(o.shop.id, o.shop.name);
      birdSet.add(o.birdType);
      if (o.vehicleAssignment) vehicleSet.add(o.vehicleAssignment.vehicleNo);
      if (o.pickupSource) pickupSet.add(o.pickupSource.location);
    }
    return {
      shops: Array.from(shopSet.entries()),
      birdTypes: Array.from(birdSet).sort(),
      vehicles: Array.from(vehicleSet).sort(),
      pickupLocations: Array.from(pickupSet).sort(),
    };
  }, [orders]);

  const hasFilters =
    filters.search !== "" ||
    filters.deliveryDate !== "" ||
    filters.priority !== "" ||
    filters.status !== "" ||
    filters.vehicle !== "" ||
    filters.pickupLocation !== "" ||
    filters.shop !== "" ||
    filters.birdType !== "" ||
    filters.assigned !== "" ||
    filters.importantOnly ||
    filters.urgentOnly;

  const inputClass =
    "h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20";
  const labelClass = "text-[10.5px] font-semibold uppercase tracking-wider text-slate-400";

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {/* Search */}
        <div className="md:col-span-3 xl:col-span-2">
          <label className={labelClass}>Search</label>
          <div className="relative mt-1">
            <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={filters.search}
              onChange={(e) => set("search", e.target.value)}
              placeholder="Order no, shop, vehicle, farm, driver…"
              className={`${inputClass} w-full pl-8`}
            />
          </div>
        </div>

        <div>
          <label className={labelClass}>Delivery Date</label>
          <input type="date" value={filters.deliveryDate} onChange={(e) => set("deliveryDate", e.target.value)} className={`${inputClass} mt-1 w-full`} />
        </div>

        <div>
          <label className={labelClass}>Priority</label>
          <select value={filters.priority} onChange={(e) => set("priority", e.target.value)} className={`${inputClass} mt-1 w-full`}>
            <option value="">All</option>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass}>Status</label>
          <select value={filters.status} onChange={(e) => set("status", e.target.value)} className={`${inputClass} mt-1 w-full`}>
            <option value="">All</option>
            {ORDER_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass}>Vehicle</label>
          <select value={filters.vehicle} onChange={(e) => set("vehicle", e.target.value)} className={`${inputClass} mt-1 w-full`}>
            <option value="">All</option>
            {vehicles.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass}>Pickup Location</label>
          <select value={filters.pickupLocation} onChange={(e) => set("pickupLocation", e.target.value)} className={`${inputClass} mt-1 w-full`}>
            <option value="">All</option>
            {pickupLocations.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass}>Shop</label>
          <select value={filters.shop} onChange={(e) => set("shop", e.target.value)} className={`${inputClass} mt-1 w-full`}>
            <option value="">All</option>
            {shops.map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass}>Bird Type</label>
          <select value={filters.birdType} onChange={(e) => set("birdType", e.target.value)} className={`${inputClass} mt-1 w-full`}>
            <option value="">All</option>
            {birdTypes.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass}>Assignment</label>
          <select value={filters.assigned} onChange={(e) => set("assigned", e.target.value as OrderFilterState["assigned"])} className={`${inputClass} mt-1 w-full`}>
            <option value="">All</option>
            <option value="assigned">Assigned</option>
            <option value="unassigned">Unassigned</option>
          </select>
        </div>
      </div>

      {/* Toggles + clear */}
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
        <button
          type="button"
          onClick={() => set("importantOnly", !filters.importantOnly)}
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
            filters.importantOnly ? "border-amber-300 bg-amber-50 text-amber-700" : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
          }`}
        >
          <Filter size={13} />
          Important customers
        </button>
        <button
          type="button"
          onClick={() => set("urgentOnly", !filters.urgentOnly)}
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
            filters.urgentOnly ? "border-rose-300 bg-rose-50 text-rose-700" : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
          }`}
        >
          <Filter size={13} />
          Urgent only
        </button>

        {hasFilters && (
          <button
            type="button"
            onClick={() => onChange(EMPTY_FILTERS)}
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-rose-600 transition-colors hover:bg-rose-50"
          >
            <X size={13} />
            Clear Filters
          </button>
        )}

        <span className="text-xs font-medium text-slate-400">
          {resultCount} of {totalCount} orders
        </span>
      </div>
    </div>
  );
}
