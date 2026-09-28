import React, { useCallback, useRef, useState } from "react";
import { Check, Hash, Calendar, Truck, User, UserCog, Warehouse, ShoppingBag, Bird, Scale, HeartPulse, ArrowUp, ArrowDown, Layers3 } from "lucide-react";
import type { Trip } from "../types/trip";
import type { TripListSortKey } from "../utils/filterTripList";
import { formatTripListDay } from "../utils/formatTripListDay";
import { localizeTripViewText } from "../utils/tripViewLocalization";
import { formatVehicleNumber } from "../../../../utils/format";
import { useI18n } from "../../../../i18n";
import { createPortal } from "react-dom";
import { sumFlattenedDieselLitres } from "../../../../shared/trip/calculations";

export type TripSortKey = TripListSortKey;

interface Props {
  trips: Trip[];
  /** Keep the table surface informative while its server records are loading. */
  isLoading?: boolean;
  selectedRowId?: number | null;
  onRowClick: (trip: Trip) => void;
  /** Select without toggling, used by keyboard row navigation. */
  onRowSelect?: (trip: Trip) => void;
  startIndex?: number;
  sortBy?: TripSortKey | null;
  sortDir?: "asc" | "desc";
  onSortChange?: (key: TripSortKey) => void;
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

type TripListLoadMetricKey = "birds" | "weight" | "weightLoss" | "mortality" | "shops";

/** Loads backing the per-load breakdown, mirroring Recent Trip Activity. */
function tripListLoads(trip: Trip) {
  return (trip.loadSummaries ?? []).filter((load) => load.load > 0);
}

function openBreakdownTooltip(element: HTMLElement, rows: number, width: number, setPosition: (position: { left: number; top: number } | null) => void) {
  const rect = element.getBoundingClientRect();
  const estimatedHeight = 54 + rows * 32;
  const top = rect.bottom + estimatedHeight + 12 <= window.innerHeight ? rect.bottom + 8 : rect.top - estimatedHeight - 8;
  setPosition({ left: Math.max(12, Math.min(window.innerWidth - width - 12, rect.left + rect.width / 2 - width / 2)), top: Math.max(8, top) });
}

/**
 * Metric cell (Birds / Weight / W.L. / Mortality / Shops) with the same
 * modern per-load breakdown tooltip as Recent Trip Activity: plain value for
 * a single load, dotted-underline button + floating card once loads > 1.
 */
function TripListMetricCell({
  trip,
  metric,
  value,
  className,
}: {
  trip: Trip;
  metric: TripListLoadMetricKey;
  value: string;
  className: string;
}) {
  const [tooltipPosition, setTooltipPosition] = useState<{ left: number; top: number } | null>(null);
  const loads = tripListLoads(trip);
  const showBreakdown = loads.length > 1;
  const unit = metric === "weight" || metric === "weightLoss" ? " kg" : metric === "shops" ? " shops" : "";
  const label =
    metric === "weightLoss" ? "W.L" : metric === "mortality" ? "Mortality" : metric === "weight" ? "Weight" : metric === "shops" ? "Shops" : "Birds";
  const format = (amount: number) =>
    metric === "birds" || metric === "mortality" || metric === "shops"
      ? Math.round(amount).toLocaleString()
      : Number(amount || 0).toFixed(2);
  const loadValue = (load: { birds: number; weight: number; mortality: number; weightLoss: number; shops: number }) =>
    metric === "birds" ? load.birds : metric === "weight" ? load.weight : metric === "mortality" ? load.mortality : metric === "weightLoss" ? Math.max(0, load.weightLoss) : load.shops;

  return (
    <td className={`px-4 py-5 text-center text-[13px] font-bold whitespace-nowrap ${className}`}>
      <span className="inline-flex items-center justify-center" onMouseLeave={() => setTooltipPosition(null)}>
        {showBreakdown ? <button type="button" aria-label={`${label} by load`} onMouseEnter={(event) => openBreakdownTooltip(event.currentTarget, loads.length, 220, setTooltipPosition)} onFocus={(event) => openBreakdownTooltip(event.currentTarget, loads.length, 220, setTooltipPosition)} onBlur={() => setTooltipPosition(null)} className="rounded border-b border-dotted border-current px-0.5 font-bold focus:outline-none focus:ring-2 focus:ring-blue-300">{value}</button> : <span>{value}</span>}
        {showBreakdown && tooltipPosition && createPortal(
          <span role="tooltip" style={{ left: tooltipPosition.left, top: tooltipPosition.top }} className="pointer-events-none fixed z-[9999] w-[220px] rounded-xl border border-slate-200 bg-white p-3 text-left text-[11px] font-medium text-slate-700 shadow-2xl">
            <span className="mb-2 block border-b border-slate-100 pb-2 font-bold text-slate-700">{label} by load</span>
            {loads.map((load) => <span key={load.load} className="flex items-center justify-between gap-5 rounded-md px-1.5 py-1.5 odd:bg-slate-50"><span>Load {load.load}</span><span className="font-bold text-slate-900">{format(loadValue(load))}{unit}</span></span>)}
          </span>, document.body)}
      </span>
    </td>
  );
}

function TripMasterTable({
  trips,
  isLoading = false,
  selectedRowId,
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
    (trip: Trip) => (onRowSelect ? onRowSelect(trip) : onRowClick(trip)),
    [onRowClick, onRowSelect],
  );

  const handleRowKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTableRowElement>, rowIndex: number) => {
      // Let controls inside a row keep their normal keyboard behaviour.
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

  const sortable = (key: TripSortKey, content: React.ReactNode, center = false) => {
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
                {sortable("tripNo", <div className="flex items-center gap-1.5">
                  <Hash size={14} className="text-slate-400 flex-shrink-0" />
                  <span>{t("operations.trip_no")}</span>
                </div>)}
              </th>
              <th className="px-4 py-4 text-left text-[12px] font-bold uppercase tracking-wider">
                {sortable("tripDate", <div className="flex items-center gap-1.5">
                  <Calendar size={14} className="text-blue-500 flex-shrink-0" />
                  <span>{t("ops.trip.day")}</span>
                </div>)}
              </th>
              <th className="px-4 py-4 text-left text-[12px] font-bold uppercase tracking-wider">
                {sortable("vehicleNo", <div className="flex items-center gap-1.5">
                  <Truck size={14} className="text-indigo-500 flex-shrink-0" />
                  <span>{t("common.vehicle")}</span>
                </div>)}
              </th>
              <th className="px-4 py-4 text-left text-[12px] font-bold uppercase tracking-wider">
                {sortable("driverName", <div className="flex items-center gap-1.5">
                  <User size={14} className="text-emerald-500 flex-shrink-0" />
                  <span>{t("common.driver")}</span>
                </div>)}
              </th>
              <th className="px-4 py-4 text-left text-[12px] font-bold uppercase tracking-wider">
                {sortable("supervisorName", <div className="flex items-center gap-1.5">
                  <UserCog size={14} className="text-purple-500 flex-shrink-0" />
                  <span>{t("common.supervisor")}</span>
                </div>)}
              </th>
              <th className="px-4 py-4 text-left text-[12px] font-bold uppercase tracking-wider">
                {sortable("sourceFarm", <div className="flex items-center gap-1.5">
                  <Warehouse size={14} className="text-amber-500 flex-shrink-0" />
                  <span>{t("ops.trip.source_farm")}</span>
                </div>)}
              </th>
              <th className="px-4 py-4 text-center text-[12px] font-bold uppercase tracking-wider">
                {sortable("totalShops", <div className="flex items-center justify-center gap-1.5">
                  <ShoppingBag size={14} className="text-cyan-500 flex-shrink-0" />
                  <span>{t("ops.trip.shops")}</span>
                </div>, true)}
              </th>
              <th className="px-4 py-4 text-center text-[12px] font-bold uppercase tracking-wider">
                {sortable("totalBirds", <div className="flex items-center justify-center gap-1.5">
                  <Bird size={14} className="text-blue-500 flex-shrink-0" />
                  <span>{t("common.birds")}</span>
                </div>, true)}
              </th>
              <th className="px-4 py-4 text-center text-[12px] font-bold uppercase tracking-wider">
                {sortable("totalWeight", <div className="flex items-center justify-center gap-1.5">
                  <Scale size={14} className="text-orange-500 flex-shrink-0" />
                  <span>{t("ops.trip.weight_kg")}</span>
                </div>, true)}
              </th>
              <th className="px-4 py-4 text-center text-[12px] font-bold uppercase tracking-wider">
                <div className="flex items-center justify-center gap-1.5"><Scale size={14} className="text-orange-500" /><span>W.L</span></div>
              </th>
              <th className="px-4 py-4 text-center text-[12px] font-bold uppercase tracking-wider">
                {sortable("totalMortality", <div className="flex items-center justify-center gap-1.5">
                  <HeartPulse size={14} className="text-rose-500 flex-shrink-0" />
                  <span>{t("operations.mortality_count")}</span>
                </div>, true)}
              </th>
              <th className="px-4 py-4 text-center text-[12px] font-bold uppercase tracking-wider">
                <div className="flex items-center justify-center gap-1.5"><Layers3 size={14} className="text-indigo-500" /><span>Load</span></div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <tr>
                <td colSpan={13} className="py-16 text-center text-sm font-medium text-slate-400">
                  <span className="inline-flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-emerald-600" aria-hidden="true" />
                    {t("ops.trip.loading_trip_list")}
                  </span>
                </td>
              </tr>
            ) : trips.length === 0 ? (
              <tr>
                <td colSpan={13} className="py-12 text-center text-slate-400 text-[13px] font-medium">
                  {t("ops.trip.no_completed_trips")}
                </td>
              </tr>
            ) : (
              trips.map((trip, index) => {
                const isSelected = trip.id === selectedRowId;
                const serialNo = startIndex + index + 1;
                // Per-load breakdown tooltips are only meaningful when the
                // trip actually has more than one load.
                const loadCount = Math.max(1, trip.submittedLoadCount ?? trip.loadSummaries?.length ?? 1);
                return (
                  <tr
                    key={trip.id}
                    ref={(element) => {
                      if (element) rowRefs.current.set(trip.id, element);
                      else rowRefs.current.delete(trip.id);
                    }}
                    tabIndex={0}
                    onClick={() => onRowClick(trip)}
                    onKeyDown={(event) => handleRowKeyDown(event, index)}
                    aria-selected={isSelected}
                    className={`cursor-pointer outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-400 ${
                      isSelected
                        ? "bg-blue-50/70 border-l-4 border-l-blue-300 ring-1 ring-inset ring-blue-200"
                        : `hover:bg-slate-50/60 ${index % 2 === 0 ? "bg-white" : "bg-slate-50/20"}`
                    }`}
                  >
                    <td className="px-4 py-5 text-center text-[13px] text-slate-500 font-medium w-10">
                      {isSelected ? <Check size={16} className="text-blue-500 inline" /> : serialNo}
                    </td>
                    {/* Keep logo in header, but working start from name of columns — S for Supervisor etc. */}
                    <td className="px-4 py-5 pl-9 font-bold text-emerald-600 text-[13px] whitespace-nowrap">{localizeTripViewText(trip.tripNo, language)}</td>
                    <td className="px-4 py-5 pl-9 text-[13px] font-medium text-slate-600 whitespace-nowrap">{formatTripListDay(trip.tripDate, language)}</td>
                    <td className="px-4 py-5 pl-9 text-[13px] font-medium text-slate-700 whitespace-nowrap">
                      <div>{localizeTripViewText(formatVehicleNumber(trip.vehicleNo), language)}</div>
                      <div className="mt-0.5 text-[10px] font-semibold text-cyan-600">{sumFlattenedDieselLitres(trip as Trip & Record<string, unknown>).toFixed(2)} L</div>
                    </td>
                    <td className="px-4 py-5 pl-9 text-[13px] text-slate-600 whitespace-nowrap">{localizeTripViewText(trip.driverName, language) || "-"}</td>
                    <td className="px-4 py-5 pl-9 text-[13px] text-slate-600 whitespace-nowrap">{localizeTripViewText(trip.supervisorName, language)}</td>
                    <td className="px-4 py-5 pl-9 text-[13px] text-slate-600 font-medium whitespace-nowrap">{localizeTripViewText(trip.sourceFarm, language)}</td>
                    <TripListMetricCell trip={trip} metric="shops" value={String(trip.totalShops)} className="text-slate-700" />
                    <TripListMetricCell trip={trip} metric="birds" value={trip.totalBirds.toLocaleString()} className="text-blue-600" />
                    <TripListMetricCell trip={trip} metric="weight" value={trip.totalWeight.toFixed(2)} className="text-amber-600" />
                    <TripListMetricCell trip={trip} metric="weightLoss" value={Math.max(0, Number(trip.weightLoss || 0)).toFixed(2)} className="text-orange-600" />
                    <TripListMetricCell trip={trip} metric="mortality" value={String(trip.totalMortality)} className="text-rose-600" />
                    <td className="px-4 py-5 text-center text-[13px] font-bold text-indigo-600 whitespace-nowrap">{loadCount}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
    </div>
  );
}

export default React.memo(TripMasterTable);
