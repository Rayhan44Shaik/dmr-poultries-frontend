import React, { useCallback, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  ArrowUp,
  ArrowDown,
  Check,
  Hash,
  Calendar,
  Truck,
  Warehouse,
  ShoppingBag,
  Bird,
  Scale,
  IndianRupee,
} from "lucide-react";
import type { Trip } from "../../vehicle-trips/types/trip.ts";
import { formatVehicleNumber } from "../../../../utils/format";
import { useI18n } from "../../../../i18n";
import type { RateEntrySortKey } from "../hooks/useCompletedTrips";
import { displayRateEntryName, formatRateEntryDay } from "../utils/rateEntryDisplay";

interface Props {
  trips: Trip[];
  onEnterRate: (trip: Trip) => void;
  onModifyRate: (trip: Trip) => void;
  children?: ReactNode;
  selectedRowId?: number | null;
  onRowClick?: (trip: Trip) => void;
  /** Select without toggling, used by keyboard row navigation. */
  onRowSelect?: (trip: Trip) => void;
  startIndex?: number;
  sortBy?: RateEntrySortKey | null;
  sortDir?: "asc" | "desc";
  onSortChange?: (key: RateEntrySortKey) => void;
}

type LoadMetricItem = { load: number; value: string };

function LoadMetricValue({
  value,
  items,
  label,
  valueClassName,
  focusRingClassName,
}: {
  value: ReactNode;
  items: LoadMetricItem[];
  label: string;
  valueClassName: string;
  focusRingClassName: string;
}) {
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const showBreakdown = items.length === 2;
  const open = (element: HTMLElement) => {
    const rect = element.getBoundingClientRect();
    const width = 230;
    const height = 54 + items.length * 32;
    setPosition({
      left: Math.max(12, Math.min(window.innerWidth - width - 12, rect.left + rect.width / 2 - width / 2)),
      top: rect.bottom + height + 12 <= window.innerHeight ? rect.bottom + 8 : Math.max(8, rect.top - height - 8),
    });
  };
  return (
    <span className="inline-flex" onMouseLeave={() => setPosition(null)}>
      {showBreakdown ? <button type="button" onMouseEnter={(event) => open(event.currentTarget)} onFocus={(event) => open(event.currentTarget)} onBlur={() => setPosition(null)} className={`rounded border-b border-dotted border-current px-0.5 font-bold focus:outline-none focus:ring-2 ${focusRingClassName}`} aria-label={`${label} by load`}>{value}</button> : <span>{value}</span>}
      {showBreakdown && position && createPortal(<span role="tooltip" style={position} className="pointer-events-none fixed z-[9999] w-[230px] rounded-xl border border-slate-200 bg-white p-3 text-left text-[11px] font-medium text-slate-700 shadow-2xl"><span className="mb-2 block border-b border-slate-100 pb-2 font-bold">{label} by load</span>{items.map((item) => <span key={item.load} className="flex items-center justify-between rounded-md px-1.5 py-1.5 odd:bg-slate-50"><span>Load {item.load}</span><span className={`font-bold ${valueClassName}`}>{item.value}</span></span>)}</span>, document.body)}
    </span>
  );
}

function RateAmountCell({ trip }: { trip: Trip }) {
  const items = (trip.rateEntryLoadAmounts ?? []).map((item) => ({
    load: item.load,
    value: `₹ ${Math.round(item.amount).toLocaleString("en-IN")}`,
  }));
  const total = !trip.ratesEntered ? "—" : `₹ ${Math.round(trip.rateEntryTotalAmount ?? 0).toLocaleString("en-IN")}`;
  return (
    <td className="px-4 py-4 text-center text-[13px] font-bold text-emerald-700 whitespace-nowrap">
      <LoadMetricValue value={total} items={items} label="Amount" valueClassName="text-emerald-700" focusRingClassName="focus:ring-emerald-300" />
    </td>
  );
}

function SortArrows({ active, dir }: { active: boolean; dir?: "asc" | "desc" }) {
  const base = "h-3.5 w-3.5 shrink-0 transition-colors";
  const on = "text-emerald-600";
  const off = "text-slate-400 group-hover/sort:text-slate-600";
  return (
    <span className="inline-flex items-center gap-0.5 shrink-0" aria-hidden="true">
      <ArrowUp size={13} strokeWidth={2.7} className={`${base} ${active && dir === "asc" ? on : off}`} />
      <ArrowDown size={13} strokeWidth={2.7} className={`${base} ${active && dir === "desc" ? on : off}`} />
    </span>
  );
}

function CompletedTripsTable({
  trips,
  children,
  selectedRowId = null,
  onRowClick,
  onRowSelect,
  startIndex = 0,
  sortBy = null,
  sortDir = "asc",
  onSortChange,
}: Props) {
  const { t, language } = useI18n();
  const rowRefs = useRef(new Map<number, HTMLTableRowElement>());

  const selectRow = useCallback(
    (trip: Trip) => onRowSelect?.(trip) ?? onRowClick?.(trip),
    [onRowClick, onRowSelect],
  );

  const handleRowKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTableRowElement>, rowIndex: number) => {
      // Let the Enter Rates / Modify Rates button keep its own keyboard action.
      if (event.target !== event.currentTarget) return;
      const currentTrip = trips[rowIndex];
      if (!currentTrip) return;
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        selectRow(currentTrip);
        return;
      }
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      event.preventDefault();
      const nextTrip = trips[rowIndex + (event.key === "ArrowDown" ? 1 : -1)];
      if (!nextTrip) return;
      selectRow(nextTrip);
      requestAnimationFrame(() => rowRefs.current.get(nextTrip.id)?.focus());
    },
    [selectRow, trips],
  );

  const sortable = (key: RateEntrySortKey, content: React.ReactNode, center = false) => {
    if (!onSortChange) return content;
    const active = sortBy === key;
    return (
      <button
        type="button"
        onClick={() => onSortChange(key)}
        aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
        className={`group/sort flex items-center gap-2 w-full uppercase tracking-wider font-bold text-[12px] transition-colors hover:text-emerald-700 ${
          center ? "justify-center" : ""
        } ${active ? "text-emerald-700" : ""}`}
      >
        {content}
        <SortArrows active={active} dir={sortDir} />
      </button>
    );
  };

  return (
    <div className="w-full overflow-x-auto">
      <table className="min-w-full text-[13px] text-left border-collapse">
        <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600">
          <tr className="whitespace-nowrap">
            <th className="px-4 py-4 text-center text-[12px] font-bold uppercase tracking-wider w-10">#</th>
            <th className="px-4 py-4 text-left text-[12px] font-bold uppercase tracking-wider">
              {sortable("tripNo", <div className="flex items-center gap-1.5"><Hash size={14} className="text-slate-400 flex-shrink-0" /><span>{t("operations.trip_no")}</span></div>)}
            </th>
            <th className="px-4 py-4 text-left text-[12px] font-bold uppercase tracking-wider">
              {sortable("tripDate", <div className="flex items-center gap-1.5"><Calendar size={14} className="text-blue-500 flex-shrink-0" /><span>{t("ops.rate.col.day")}</span></div>)}
            </th>
            <th className="px-4 py-4 text-left text-[12px] font-bold uppercase tracking-wider">
              {sortable("vehicleNo", <div className="flex items-center gap-1.5"><Truck size={14} className="text-indigo-500 flex-shrink-0" /><span>{t("common.vehicle")}</span></div>)}
            </th>
            <th className="px-4 py-4 text-left text-[12px] font-bold uppercase tracking-wider">
              {sortable("sourceFarm", <div className="flex items-center gap-1.5"><Warehouse size={14} className="text-amber-500 flex-shrink-0" /><span>{t("ops.trip.source_farm")}</span></div>)}
            </th>
            <th className="px-4 py-4 text-center text-[12px] font-bold uppercase tracking-wider">
              {sortable("totalShops", <div className="flex items-center justify-center gap-1.5"><ShoppingBag size={14} className="text-cyan-500 flex-shrink-0" /><span>{t("ops.trip.shops")}</span></div>, true)}
            </th>
            <th className="px-4 py-4 text-center text-[12px] font-bold uppercase tracking-wider">
              {sortable("totalBirds", <div className="flex items-center justify-center gap-1.5"><Bird size={14} className="text-blue-500 flex-shrink-0" /><span>{t("common.birds")}</span></div>, true)}
            </th>
            <th className="px-4 py-4 text-center text-[12px] font-bold uppercase tracking-wider">
              {sortable("totalWeight", <div className="flex items-center justify-center gap-1.5"><Scale size={14} className="text-orange-500 flex-shrink-0" /><span>{t("ops.trip.weight_kg")}</span></div>, true)}
            </th>
            <th className="px-4 py-4 text-center text-[12px] font-bold uppercase tracking-wider">
              <div className="flex items-center justify-center gap-1.5"><IndianRupee size={14} className="shrink-0 text-emerald-500" /><span>{t("ops.rate.modal.amount")}</span></div>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {trips.length === 0 ? (
            <tr>
              <td colSpan={9} className="py-12 text-center text-slate-400 text-[13px] font-medium">
                {t("ops.rate.no_waiting_trips")}
              </td>
            </tr>
          ) : (
            trips.map((trip, index) => {
              const serialNo = startIndex + index + 1;
              const isSelected = trip.id === selectedRowId;
              const totalShops = trip.totalShops ?? 0;
              const loadMetrics = trip.rateEntryLoadAmounts ?? [];
              const shopLoadItems = loadMetrics.map((item) => ({ load: item.load, value: Number(item.shops || 0).toLocaleString("en-IN") }));
              const birdLoadItems = loadMetrics.map((item) => ({ load: item.load, value: Number(item.birds || 0).toLocaleString("en-IN") }));
              const weightLoadItems = loadMetrics.map((item) => ({ load: item.load, value: `${Number(item.weight || 0).toFixed(2)} kg` }));

              return (
                <tr
                  key={trip.id}
                  ref={(element) => {
                    if (element) rowRefs.current.set(trip.id, element);
                    else rowRefs.current.delete(trip.id);
                  }}
                  tabIndex={onRowClick || onRowSelect ? 0 : undefined}
                  onClick={() => onRowClick?.(trip)}
                  onKeyDown={(event) => handleRowKeyDown(event, index)}
                  aria-selected={isSelected}
                  className={`${onRowClick || onRowSelect ? "cursor-pointer" : ""} outline-none border-t transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-400 ${
                    isSelected
                      ? "bg-emerald-50/60 border-l-4 border-l-emerald-300 ring-1 ring-inset ring-emerald-200"
                      : `${index % 2 === 0 ? "bg-white" : "bg-slate-50/20"} hover:bg-slate-50/60`
                  }`}
                >
                  <td className="px-4 py-4 text-center text-[13px] text-slate-500 font-medium w-10">
                    {isSelected ? <Check size={16} className="inline text-emerald-600" /> : serialNo}
                  </td>
                  {/* Keep 2d logo in header but working start from name S */}
                  <td className="px-4 py-4 pl-9 font-bold text-emerald-600 text-[13px] whitespace-nowrap">{trip.tripNo}</td>
                  <td className="px-4 py-4 pl-9 text-[13px] font-medium text-slate-600 whitespace-nowrap">
                    {formatRateEntryDay(trip.tripDate, language)}
                  </td>
                  <td className="px-4 py-4 pl-9 text-[13px] font-medium text-slate-700 whitespace-nowrap">
                    {displayRateEntryName(formatVehicleNumber(trip.vehicleNo), language)}
                    {trip.isRentedVehicle ? <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">Rental</span> : null}
                  </td>
                  <td className="px-4 py-4 pl-9 text-[13px] text-slate-600 font-medium whitespace-nowrap">
                    {displayRateEntryName(trip.sourceFarm, language)}
                  </td>
                  <td className="px-4 py-4 text-center whitespace-nowrap">
                    <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[12px] font-bold text-slate-700">
                      <LoadMetricValue value={totalShops} items={shopLoadItems} label="Shops" valueClassName="text-cyan-700" focusRingClassName="focus:ring-cyan-300" />
                    </span>
                  </td>
                  <td className="px-4 py-4 text-center text-[13px] font-bold text-blue-600 whitespace-nowrap">
                    <LoadMetricValue value={trip.totalBirds.toLocaleString()} items={birdLoadItems} label="Birds" valueClassName="text-blue-700" focusRingClassName="focus:ring-blue-300" />
                  </td>
                  <td className="px-4 py-4 text-center text-[13px] font-bold text-amber-600 whitespace-nowrap">
                    <LoadMetricValue value={trip.totalWeight.toFixed(2)} items={weightLoadItems} label="Wt (kg)" valueClassName="text-amber-700" focusRingClassName="focus:ring-amber-300" />
                  </td>
                  <RateAmountCell trip={trip} />
                </tr>
              );
            })
          )}
        </tbody>
      </table>
      {children && <div className="border-t border-slate-200 bg-slate-50/50 px-3 py-2">{children}</div>}
    </div>
  );
}

export default React.memo(CompletedTripsTable);
