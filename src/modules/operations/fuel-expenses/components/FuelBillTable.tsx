import React, { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  ArrowDown,
  ArrowUp,
  Calendar,
  CheckCircle,
  Eye,
  FileImage,
  Fuel,
  Gauge,
  Hash,
  IndianRupee,
  MapPin,
  Pencil,
  Trash2,
  Truck,
  UserRound,
  Droplets,
  ExternalLink,
  Loader2,
  Route,
} from "lucide-react";
import type { FuelExpense, FuelSortKey } from "../types/fuelExpense";
import { fuelTripLabel, fuelTripLoads, hasFuelLoadBreakdown } from "../utils/fuelSummary";
import type { FuelQuickTab } from "../utils/filterFuelExpenses";
import { formatVehicleNumber } from "../../../../utils/format";
import { formatTripListDay } from "../../vehicle-trips/utils/formatTripListDay";
import { localizeTripViewText } from "../../vehicle-trips/utils/tripViewLocalization";
import { BillPreviewLink } from "../../vehicle-trips/components/Step_5/BillPreviewLink";
import { tableSelectedRowClass } from "../../../../shared/ui/tableRowSelection";
import { useTableRowSelection } from "../../../../shared/ui/useTableRowSelection";
import { RowSelectMark } from "../../../../shared/ui/RowSelectMark";
import { useI18n } from "../../../../i18n";
import { uiActionIconMotionClass } from "../../../../shared/ui/uiTokens";
import { reverseGeocode } from "../../vehicle-trips/utils/reverseGeocode";
import { googleMapsUrl, resolveFuelGps } from "../utils/fuelGps";

interface Props {
  bills: FuelExpense[];
  isLoading?: boolean;
  refreshing?: boolean;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onView?: (bill: FuelExpense) => void;
  onEdit?: (bill: FuelExpense) => void;
  onDelete?: (bill: FuelExpense) => void;
  onApprove?: (bill: FuelExpense) => void;
  startIndex?: number;
  sortBy?: FuelSortKey | null;
  sortDir?: "asc" | "desc";
  onSortChange?: (key: FuelSortKey) => void;
  activeTab?: FuelQuickTab;
  onTabChange?: (tab: FuelQuickTab) => void;
  tabCounts?: { all: number; pending: number; approved: number; deleted: number };
  includeMasterBunks?: boolean;
  onIncludeMasterBunksChange?: (next: boolean) => void;
  filteredTotals?: {
    records: number;
    litres: number;
    amount: number;
    distance: number | null;
    mileage: number | null;
  } | null;
}

function SortArrows({ active, dir }: { active: boolean; dir?: "asc" | "desc" }) {
  const base = "h-3.5 w-3.5 shrink-0 transition-colors";
  const on = "text-emerald-600";
  const off = "text-slate-400 group-hover/sort:text-slate-600";
  return (
    <span className="inline-flex shrink-0 items-center gap-0.5" aria-hidden="true">
      <ArrowUp size={13} strokeWidth={2.7} className={`${base} ${active && dir === "asc" ? on : off}`} />
      <ArrowDown size={13} strokeWidth={2.7} className={`${base} ${active && dir === "desc" ? on : off}`} />
    </span>
  );
}

function PetrolBunkToggle({
  includeMasterBunks,
  onChange,
}: {
  includeMasterBunks: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        <Fuel size={13} className={includeMasterBunks ? "text-emerald-600" : "text-amber-500"} />
        Petrol
      </span>
      <div
        role="radiogroup"
        aria-label="Petrol bunks"
        className="relative isolate grid h-9 w-[214px] grid-cols-2 rounded-full bg-slate-100/90 p-1 ring-1 ring-slate-200/70"
      >
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-full shadow-sm ring-1 transition-[left,background-color] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            includeMasterBunks
              ? "left-1 bg-emerald-50 ring-emerald-200"
              : "left-[calc(50%+1px)] bg-amber-50 ring-amber-200"
          }`}
        />
        <button
          type="button"
          role="radio"
          aria-checked={includeMasterBunks}
          onClick={() => onChange(true)}
          className={`relative z-10 rounded-full text-[11px] font-bold tracking-wide transition-colors duration-200 ${
            includeMasterBunks ? "text-emerald-800" : "text-slate-500 hover:text-slate-700"
          }`}
        >
          All bunks
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={!includeMasterBunks}
          onClick={() => onChange(false)}
          className={`relative z-10 rounded-full text-[11px] font-bold tracking-wide transition-colors duration-200 ${
            !includeMasterBunks ? "text-amber-800" : "text-slate-500 hover:text-slate-700"
          }`}
        >
          Others
        </button>
      </div>
    </div>
  );
}

function BunkGpsTooltip({
  bunk,
  address,
  lat,
  lon,
}: {
  bunk: string;
  address?: string;
  lat?: number | null;
  lon?: number | null;
}) {
  const { t } = useI18n();
  const gps = resolveFuelGps(lat, lon, address);
  const hasGps = gps.lat != null && gps.lon != null;
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const [placeName, setPlaceName] = useState(gps.placeName);
  const [locating, setLocating] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setPlaceName(gps.placeName);
  }, [gps.placeName]);

  useEffect(() => {
    if (!position || gps.lat == null || gps.lon == null) return;
    let cancelled = false;
    setLocating(!gps.placeName);
    void reverseGeocode(gps.lat, gps.lon).then(({ address: resolved }) => {
      if (cancelled) return;
      if (resolved) setPlaceName(resolved);
      setLocating(false);
    });
    return () => {
      cancelled = true;
    };
  }, [position, gps.lat, gps.lon, gps.placeName]);

  const clearHide = () => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  };

  const openTooltip = (element: HTMLElement) => {
    if (!hasGps && !gps.placeName) return;
    clearHide();
    const rect = element.getBoundingClientRect();
    const width = 300;
    const estimatedHeight = 176;
    const top = rect.bottom + estimatedHeight + 12 <= window.innerHeight ? rect.bottom + 8 : rect.top - estimatedHeight - 8;
    setPosition({
      left: Math.max(12, Math.min(window.innerWidth - width - 12, rect.left + rect.width / 2 - width / 2)),
      top: Math.max(8, top),
    });
  };

  const scheduleHide = () => {
    clearHide();
    hideTimer.current = setTimeout(() => setPosition(null), 280);
  };

  const mapsUrl = hasGps ? googleMapsUrl(gps.lat!, gps.lon!) : "";

  return (
    <span className="inline-flex max-w-full items-center" onMouseLeave={scheduleHide} onMouseEnter={clearHide}>
      <span
        tabIndex={hasGps || gps.placeName ? 0 : -1}
        aria-label={bunk}
        onMouseEnter={(event) => openTooltip(event.currentTarget)}
        onFocus={(event) => openTooltip(event.currentTarget)}
        onBlur={scheduleHide}
        className="max-w-full cursor-default truncate outline-none"
      >
        {bunk || "—"}
      </span>
      {position &&
        createPortal(
          <span
            role="tooltip"
            style={{ left: position.left, top: position.top, width: 300 }}
            className="fixed z-[9999] rounded-xl border border-slate-200 bg-white p-3 text-left text-[11px] font-medium text-slate-700 shadow-2xl"
            onMouseEnter={clearHide}
            onMouseLeave={scheduleHide}
          >
            <span className="mb-2 block border-b border-slate-100 pb-2 font-bold text-slate-700">Petrol bunk GPS</span>
            <span className="flex items-center justify-between gap-5 rounded-md px-1.5 py-1.5 odd:bg-slate-50">
              <span>Bunk</span>
              <span className="font-bold text-slate-900">{bunk || "—"}</span>
            </span>
            {hasGps ? (
              <>
                <span className="mt-0.5 flex items-start gap-2 rounded-md bg-slate-50 px-1.5 py-1.5 leading-5 text-slate-700">
                  {locating ? <Loader2 size={12} className="mt-0.5 shrink-0 animate-spin text-emerald-600" /> : <MapPin size={12} className="mt-0.5 shrink-0 text-rose-500" />}
                  <span className="font-semibold text-slate-800">
                    {locating ? t("ops.trip.locating") : placeName || t("ops.trip.location_captured")}
                  </span>
                </span>
                <span className="flex items-center justify-between gap-5 rounded-md px-1.5 py-1.5">
                  <span>GPS</span>
                  <span className="font-bold tabular-nums text-slate-900">
                    {gps.lat!.toFixed(6)}°N, {gps.lon!.toFixed(6)}°E
                  </span>
                </span>
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(event) => event.stopPropagation()}
                  className="mt-1 inline-flex items-center gap-1 rounded-md px-1.5 py-1 font-semibold text-emerald-700 hover:bg-emerald-50 hover:underline"
                >
                  <ExternalLink size={11} />
                  {t("masters.shops.location.open_maps")}
                </a>
              </>
            ) : (
              <span className="block rounded-md px-1.5 py-1.5 text-slate-500">{t("ops.trip.not_captured")}</span>
            )}
          </span>,
          document.body,
        )}
    </span>
  );
}

/**
 * Linked-trip cell in the Trip List load idiom: a plain trip number for a
 * single-load (or unlinked) bill, and the same dotted-underline +
 * floating-card breakdown once the linked trip has two or more loads. Each
 * load row names its DC/farm context, and the card identifies this bill's
 * own diesel entry within the trip.
 */
function FuelTripLoadCell({ bill }: { bill: FuelExpense }) {
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const loads = fuelTripLoads(bill);
  const showBreakdown = hasFuelLoadBreakdown(bill);
  const label = fuelTripLabel(bill);
  if (!showBreakdown) {
    return <span className="font-semibold text-slate-700">{label}</span>;
  }
  const openTooltip = (element: HTMLElement) => {
    const rect = element.getBoundingClientRect();
    const estimatedHeight = 60 + loads.length * 32;
    const top =
      rect.bottom + estimatedHeight + 12 <= window.innerHeight ? rect.bottom + 8 : rect.top - estimatedHeight - 8;
    setPosition({
      left: Math.max(12, Math.min(window.innerWidth - 280 - 12, rect.left + rect.width / 2 - 140)),
      top: Math.max(8, top),
    });
  };
  return (
    <span className="inline-flex items-center justify-start" onMouseLeave={() => setPosition(null)}>
      <button
        type="button"
        aria-label={`${label} by load`}
        onMouseEnter={(event) => openTooltip(event.currentTarget)}
        onFocus={(event) => openTooltip(event.currentTarget)}
        onBlur={() => setPosition(null)}
        className="rounded border-b border-dotted border-current px-0.5 font-bold text-emerald-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
      >
        {label} · {loads.length} loads
      </button>
      {position &&
        createPortal(
          <span
            role="tooltip"
            style={{ left: position.left, top: position.top }}
            className="pointer-events-none fixed z-[9999] w-[280px] rounded-xl border border-slate-200 bg-white p-3 text-left text-[11px] font-medium text-slate-700 shadow-2xl"
          >
            <span className="mb-2 block border-b border-slate-100 pb-2 font-bold text-slate-700">
              {label} by load
            </span>
            {loads.map((load) => (
              <span
                key={load.load}
                className="flex items-center justify-between gap-5 rounded-md px-1.5 py-1.5 odd:bg-slate-50"
              >
                <span>Load {load.load}</span>
                <span className="text-right font-bold text-slate-900">
                  {load.farmName?.trim() || "—"}
                  <span className="block font-semibold tabular-nums text-slate-500">
                    DC {Number(load.dcWeight ?? 0).toFixed(2)} kg · {Math.round(Number(load.birds ?? 0)).toLocaleString()} birds
                  </span>
                </span>
              </span>
            ))}
            {bill.tripFuelEntryIndex != null && (
              <span className="mt-1 block rounded-md bg-emerald-50 px-1.5 py-1.5 font-semibold text-emerald-800">
                This bill: diesel entry #{bill.tripFuelEntryIndex}
              </span>
            )}
          </span>,
          document.body,
        )}
    </span>
  );
}

export function FuelBillTable({
  bills,
  isLoading = false,
  refreshing = false,
  selectedId,
  onSelect,
  onView,
  onEdit,
  onDelete,
  onApprove,
  startIndex = 0,
  sortBy = null,
  sortDir = "asc",
  onSortChange,
  activeTab = "ALL",
  onTabChange,
  tabCounts = { all: 0, pending: 0, approved: 0, deleted: 0 },
  includeMasterBunks = true,
  onIncludeMasterBunksChange,
  filteredTotals,
}: Props) {
  const { t, language } = useI18n();
  const selectedBill = bills.find((bill) => bill.id === selectedId) || null;

  // Single shared selection: click toggles, deleted rows are skipped,
  // Enter opens the bill, Escape clears.
  const selection = useTableRowSelection<FuelExpense>({
    rows: bills,
    getId: (bill) => bill.id,
    isRowSelectable: (bill) => !(bill.deleted === true || bill.status === "Deleted"),
    selectedId,
    toggleOnReselect: true,
    allowEscapeClear: true,
    getRowLabel: (bill) => `Fuel bill ${bill.billNo || bill.id}`,
    onSelect: (bill) => onSelect(bill.id),
    onDeselect: () => onSelect(null),
    onPrimaryAction: (bill) => {
      onSelect(bill.id);
      onView?.(bill);
    },
  });

  const sortable = (key: FuelSortKey, content: ReactNode, center = false) => {
    if (!onSortChange) return content;
    const active = sortBy === key;
    return (
      <button
        type="button"
        onClick={() => onSortChange(key)}
        aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
        className={`group/sort flex w-full items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider transition-colors hover:text-emerald-700 ${
          center ? "justify-center" : ""
        } ${active ? "text-emerald-700" : "text-slate-700"}`}
      >
        {content}
        <SortArrows active={active} dir={sortDir} />
      </button>
    );
  };

  const selectedTabCount =
    activeTab === "ALL"
      ? tabCounts.all
      : activeTab === "PENDING"
        ? tabCounts.pending
        : activeTab === "APPROVED"
          ? tabCounts.approved
          : tabCounts.deleted;

  const tabs = [
    { id: "ALL" as const, label: t("common.all") },
    { id: "PENDING" as const, label: t("common.pending") },
    { id: "APPROVED" as const, label: t("common.approved") },
    { id: "DELETED" as const, label: t("common.deleted") },
  ];

  const isSelectedDeleted = selectedBill?.deleted === true || selectedBill?.status === "Deleted";
  const isTripSelected = selectedBill?.sourceType === "TRIP" || !!selectedBill?.tripNo || !!selectedBill?.tripId;
  const isSelectedApproved = !isSelectedDeleted && (selectedBill?.status === "Approved" || isTripSelected);
  const isSelectedPending = Boolean(
    selectedBill && !isSelectedDeleted && !isTripSelected && !isSelectedApproved && selectedBill.status === "Pending",
  );

  return (
    <div className="w-full">
      <div className="flex flex-col gap-3 border-b border-slate-100 bg-gradient-to-r from-emerald-50/60 via-white to-emerald-50/40 px-6 py-3.5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-100 bg-emerald-50/70 text-emerald-500 shadow-inner">
              <Fuel className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold tracking-tight text-slate-800">{t("ops.fuel.table_title")}</h3>
          </div>
          <span className="inline-flex items-center justify-center rounded-full border border-slate-200/80 bg-slate-100 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-slate-600 shadow-sm">
            {selectedTabCount}
          </span>
          {onTabChange && (
            <div className="ml-1 flex items-center overflow-hidden rounded-lg border border-slate-200/80 bg-slate-50 p-0.5 shadow-sm">
              {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                const activeClass =
                  tab.id === "ALL"
                    ? "bg-slate-200/80 text-slate-800 shadow-sm font-bold"
                    : tab.id === "PENDING"
                      ? "bg-orange-50/80 text-orange-500 shadow-sm font-bold"
                      : tab.id === "APPROVED"
                        ? "bg-emerald-50/80 text-emerald-600 shadow-sm font-bold"
                        : "bg-rose-50/80 text-rose-500 shadow-sm font-bold";
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => onTabChange(tab.id)}
                    aria-pressed={isActive}
                    className={`inline-flex items-center rounded-md px-4 py-1.5 text-xs font-semibold transition-all sm:px-5 ${
                      isActive ? activeClass : "bg-transparent text-slate-500 hover:bg-slate-200/50 hover:text-slate-800"
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {onIncludeMasterBunksChange ? (
            <PetrolBunkToggle includeMasterBunks={includeMasterBunks} onChange={onIncludeMasterBunksChange} />
          ) : null}
          {selectedBill ? (
            <div className="flex flex-wrap items-center gap-2">
              {onView && (
                <button type="button" onClick={() => onView(selectedBill)} className="group relative inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50/80 px-3 text-xs font-semibold text-emerald-700 shadow-sm transition-all hover:bg-emerald-100 active:scale-95" title={t("common.view")}>
                  <span className={`inline-flex ${uiActionIconMotionClass.view}`}><Eye size={13} /></span>
                  <span>{t("common.view")}</span>
                </button>
              )}
              {isSelectedPending && onApprove && (
                <button type="button" onClick={() => onApprove(selectedBill)} className="group relative inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-xl bg-emerald-600 px-3 text-xs font-semibold text-white transition-all hover:bg-emerald-700 active:scale-95" title={t("common.approve")}>
                  <span className={`inline-flex ${uiActionIconMotionClass.approve}`}><CheckCircle size={13} /></span>
                  <span>{t("common.approve")}</span>
                </button>
              )}
              {isSelectedPending && onDelete && (
                <button type="button" onClick={() => onDelete(selectedBill)} className="group relative inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 text-xs font-semibold text-rose-600 shadow-sm transition-all hover:bg-rose-100 active:scale-95" title={t("common.delete")}>
                  <span className={`inline-flex ${uiActionIconMotionClass.delete}`}><Trash2 size={13} /></span>
                  <span>{t("common.delete")}</span>
                </button>
              )}
              {isSelectedPending && onEdit && (
                <button type="button" onClick={() => onEdit(selectedBill)} className="group relative inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-100 px-3 text-xs font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-200 active:scale-95" title={t("common.edit")}>
                  <span className={`inline-flex ${uiActionIconMotionClass.edit}`}><Pencil size={13} /></span>
                  <span>{t("common.edit")}</span>
                </button>
              )}
            </div>
          ) : null}
        </div>
      </div>

      <div className="relative overflow-x-auto" aria-busy={isLoading || refreshing}>
        {refreshing && (
          <div aria-hidden="true" className="absolute inset-x-0 top-0 z-10 h-0.5 overflow-hidden bg-transparent">
            <div className={`h-full w-full animate-pulse ${includeMasterBunks ? "bg-emerald-300/80" : "bg-amber-300/80"}`} />
          </div>
        )}
        <table className="min-w-full border-collapse text-left text-[13px]">
          <thead className="border-b border-slate-200 bg-slate-50/80">
            <tr className="whitespace-nowrap text-slate-700">
              <th className="px-4 py-4 text-center text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <div className="flex items-center justify-center gap-1.5"><Hash size={14} className="text-slate-400" /> #</div>
              </th>
              <th className="px-4 py-4 text-left">
                {sortable("billNo", <div className="flex items-center gap-1.5"><Fuel size={14} className="shrink-0 text-emerald-500" /><span>Bill No.</span></div>)}
              </th>
              <th className="px-4 py-4 text-left">
                {sortable("date", <div className="flex items-center gap-1.5"><Calendar size={14} className="shrink-0 text-blue-500" /><span>Day</span></div>)}
              </th>
              <th className="px-4 py-4 text-left">
                {sortable("tripNo", <div className="flex items-center gap-1.5"><Route size={14} className="shrink-0 text-teal-600" /><span>Trip / Load</span></div>)}
              </th>
              <th className="px-4 py-4 text-left">
                {sortable("vehicleNo", <div className="flex items-center gap-1.5"><Truck size={14} className="shrink-0 text-indigo-500" /><span>Vehicle</span></div>)}
              </th>
              <th className="px-4 py-4 text-left">
                {sortable("supervisorName", <div className="flex items-center gap-1.5"><UserRound size={14} className="shrink-0 text-violet-500" /><span>Supervisor</span></div>)}
              </th>
              <th className="px-4 py-4 text-center">
                {sortable("meterReading", <div className="flex items-center justify-center gap-1.5"><Gauge size={14} className="shrink-0 text-amber-500" /><span>Meter</span></div>, true)}
              </th>
              <th className="px-4 py-4 text-center">
                {sortable("litres", <div className="flex items-center justify-center gap-1.5"><Droplets size={14} className="shrink-0 text-cyan-600" /><span>Litres</span></div>, true)}
              </th>
              <th className="px-4 py-4 text-center">
                {sortable("rate", <div className="flex items-center justify-center gap-1.5"><IndianRupee size={14} className="shrink-0 text-violet-600" /><span>Price</span></div>, true)}
              </th>
              <th className="px-4 py-4 text-center">
                {sortable("amount", <div className="flex items-center justify-center gap-1.5"><IndianRupee size={14} className="shrink-0 text-emerald-600" /><span>Amount</span></div>, true)}
              </th>
              <th className="px-4 py-4 text-left">
                {sortable("petrolBunk", <div className="flex items-center gap-1.5"><MapPin size={14} className="shrink-0 text-rose-500" /><span>Bunk</span></div>)}
              </th>
              <th className="px-4 py-4 text-center text-[11px] font-bold uppercase tracking-wider text-slate-700">
                <div className="flex items-center justify-center gap-1.5"><FileImage size={14} className="text-indigo-500" /><span>Receipt</span></div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading && !bills.length ? (
              <tr>
                <td colSpan={12} className="py-12 text-center text-sm font-medium text-slate-400">
                  <span className="inline-flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-emerald-600" aria-hidden="true" />
                    {t("ops.fuel.loading")}
                  </span>
                </td>
              </tr>
            ) : bills.length === 0 ? (
              <tr>
                <td colSpan={12} className="py-12 text-center text-[13px] font-medium text-slate-400">{t("ops.fuel.no_records")}</td>
              </tr>
            ) : (
              bills.map((bill, index) => {
                const isSelected = bill.id === selectedId;
                const isDeleted = bill.deleted === true || bill.status === "Deleted";
                return (
                  <tr
                    key={bill.id}
                    {...selection.getRowProps(bill, index)}
                    onDoubleClick={() => onView?.(bill)}
                    className={`cursor-pointer border-l-4 border-l-transparent outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-400 ${
                      isDeleted
                        ? "border-l-red-400 bg-red-50/50 hover:bg-red-50/80"
                        : isSelected
                          ? tableSelectedRowClass
                          : "hover:bg-slate-50/80"
                    }`}
                  >
                    <td className="px-4 py-5 text-center text-[13px] font-semibold text-slate-500">
                      <RowSelectMark selected={isSelected && !isDeleted} serialNo={startIndex + index + 1} label={`Fuel bill ${bill.billNo || bill.id} selected`} />
                    </td>
                    <td className="px-4 py-5 text-[13px] font-semibold whitespace-nowrap">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onView?.(bill);
                        }}
                        className={`rounded-md underline-offset-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
                          isDeleted ? "cursor-not-allowed text-slate-400 line-through" : "cursor-pointer text-emerald-700 hover:text-emerald-900 hover:underline"
                        }`}
                      >
                        {bill.billNo || "—"}
                      </button>
                    </td>
                    <td className="whitespace-nowrap px-4 py-5 text-[13px] font-medium text-slate-600">{formatTripListDay(bill.date, language)}</td>
                    <td className="whitespace-nowrap px-4 py-5 text-[13px]"><FuelTripLoadCell bill={bill} /></td>
                    <td className="whitespace-nowrap px-4 py-5 text-[13px] font-semibold text-slate-700">{localizeTripViewText(formatVehicleNumber(bill.vehicleNo), language)}</td>
                    <td className="whitespace-nowrap px-4 py-5 text-[13px]">
                      <div className="font-semibold text-slate-700">{localizeTripViewText(bill.supervisorName || "—", language)}</div>
                      <div className="mt-0.5 text-[11px] font-semibold text-slate-500">{localizeTripViewText(bill.driverName || "—", language)}</div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-5 text-center text-[13px] font-bold tabular-nums text-slate-700">
                      {bill.meterReading > 0 ? bill.meterReading.toLocaleString() : "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-5 text-center text-[13px] font-bold tabular-nums text-cyan-700">{Number(bill.litres || 0).toFixed(2)}</td>
                    <td className="whitespace-nowrap px-4 py-5 text-center text-[13px] font-bold tabular-nums text-violet-600">{Number(bill.rate || 0).toFixed(2)}</td>
                    <td className="whitespace-nowrap px-4 py-5 text-center text-[13px] font-bold tabular-nums text-slate-700">{Number(bill.amount || 0).toFixed(2)}</td>
                    <td className="max-w-[220px] px-4 py-5 text-[13px] font-semibold text-slate-700">
                      <BunkGpsTooltip
                        bunk={localizeTripViewText(bill.petrolBunk || "—", language)}
                        address={bill.gpsAddress}
                        lat={bill.gpsLat}
                        lon={bill.gpsLon}
                      />
                    </td>
                    <td className="whitespace-nowrap px-4 py-5 text-center" onClick={(event) => event.stopPropagation()}>
                      {bill.image ? (
                        <BillPreviewLink href={bill.image} fileName={bill.imageName || `${bill.billNo}.png`} />
                      ) : (
                        <span className="text-[13px] text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
          {filteredTotals && filteredTotals.records > 0 && <tfoot className="border-t-2 border-slate-200 bg-slate-50/90"><tr>
            <td className="px-4 py-4 text-center font-bold text-slate-500">Σ</td>
            <td colSpan={5} className="px-4 py-4 text-left"><div className="text-sm font-extrabold text-emerald-700">Overall Total</div><div className="text-[11px] font-medium text-slate-500">{filteredTotals.records} filtered bills · not just this page</div><div className="mt-1 text-[11px] font-bold tabular-nums text-slate-600">Total Distance: {filteredTotals.distance != null ? `${filteredTotals.distance.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} km` : "—"} · Avg Mileage: {filteredTotals.mileage != null ? `${filteredTotals.mileage.toFixed(2)} km/L` : "—"}</div></td>
            <td className="px-4 py-4 text-center text-slate-400">—</td>
            <td className="px-4 py-4 text-center text-sm font-extrabold tabular-nums text-cyan-700">{filteredTotals.litres.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} L</td>
            <td className="px-4 py-4 text-center text-slate-400">—</td>
            <td className="px-4 py-4 text-center text-sm font-extrabold tabular-nums text-emerald-700">₹{filteredTotals.amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            <td colSpan={2} />
          </tr></tfoot>}
        </table>
      </div>
    </div>
  );
}

export default React.memo(FuelBillTable);
