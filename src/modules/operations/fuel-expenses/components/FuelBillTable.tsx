import React, { useCallback, useRef } from "react";
import {
  Check,
  Hash,
  Calendar,
  Truck,
  User,
  Gauge,
  Droplets,
  IndianRupee,
  MapPin,
  Layers,
  FileImage,
  ArrowUp,
  ArrowDown,
  Eye,
  Pencil,
  Trash2,
  CheckCircle,
  AlertCircle,
  Clock,
  Fuel,
} from "lucide-react";
import type { FuelExpense, FuelSortKey } from "../types/fuelExpense";
import type { FuelQuickTab } from "../utils/filterFuelExpenses";
import { formatVehicleNumber } from "../../../../utils/format";
import { formatTripListDay } from "../../vehicle-trips/utils/formatTripListDay";
import { localizeTripViewText } from "../../vehicle-trips/utils/tripViewLocalization";
import { BillPreviewLink } from "../../vehicle-trips/components/Step_5/BillPreviewLink";
import { GpsAddressText } from "../../vehicle-trips/components/GpsAddressText";
import { useI18n } from "../../../../i18n";
import { uiActionIconMotionClass } from "../../../../shared/ui/uiTokens";

interface Props {
  bills: FuelExpense[];
  isLoading?: boolean;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onRowClick?: (bill: FuelExpense) => void;
  onView?: (bill: FuelExpense) => void;
  onEdit?: (bill: FuelExpense) => void;
  onDelete?: (bill: FuelExpense) => void;
  onApprove?: (bill: FuelExpense) => void;
  canEditDelete?: (bill: FuelExpense) => boolean;
  startIndex?: number;
  sortBy?: FuelSortKey | null;
  sortDir?: "asc" | "desc";
  onSortChange?: (key: FuelSortKey) => void;
  activeTab?: FuelQuickTab;
  onTabChange?: (tab: FuelQuickTab) => void;
  tabCounts?: {
    all: number;
    pending: number;
    approved: number;
  };
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

export function FuelBillTable({
  bills,
  isLoading = false,
  selectedId,
  onSelect,
  onRowClick,
  onView,
  onEdit,
  onDelete,
  onApprove,
  canEditDelete,
  startIndex = 0,
  sortBy = null,
  sortDir = "asc",
  onSortChange,
  activeTab = "ALL",
  onTabChange,
  tabCounts = { all: 0, pending: 0, approved: 0 },
}: Props) {
  const { t, language } = useI18n();
  const rowRefs = useRef(new Map<string, HTMLTableRowElement>());

  const selectedBill = bills.find((b) => b.id === selectedId) || null;

  const handleRowSelect = useCallback(
    (bill: FuelExpense) => {
      if (onRowClick) onRowClick(bill);
      onSelect(selectedId === bill.id ? null : bill.id);
    },
    [onRowClick, onSelect, selectedId]
  );

  const handleRowKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTableRowElement>, rowIndex: number) => {
      if (event.target !== event.currentTarget) return;
      const currentBill = bills[rowIndex];
      if (!currentBill) return;
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        handleRowSelect(currentBill);
        return;
      }
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      event.preventDefault();
      const nextBill = bills[rowIndex + (event.key === "ArrowDown" ? 1 : -1)];
      if (!nextBill) return;
      handleRowSelect(nextBill);
      requestAnimationFrame(() => rowRefs.current.get(nextBill.id)?.focus());
    },
    [handleRowSelect, bills]
  );

  const sortable = (key: FuelSortKey, content: React.ReactNode, center = true) => {
    if (!onSortChange) return content;
    const active = sortBy === key;
    return (
      <button
        type="button"
        onClick={() => onSortChange(key)}
        aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
        className={`group/sort flex items-center gap-1.5 w-full uppercase tracking-wider font-bold text-[12px] transition-colors hover:text-emerald-700 ${
          center ? "justify-center" : "justify-start"
        } ${active ? "text-emerald-700" : "text-slate-600"}`}
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
      : tabCounts.approved;

  const tabs = [
    { id: "ALL" as const, label: "All" },
    { id: "PENDING" as const, label: "Pending" },
    { id: "APPROVED" as const, label: "Approved" },
  ];

  return (
    <div className="w-full">
      {/* ── Table Header matching Trip List Header with Fuel Logo & Active Tab Count beside Title ── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 px-6 py-3 border-b border-slate-100 bg-gradient-to-r from-emerald-50/60 via-white to-emerald-50/40">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-emerald-50/70 border border-emerald-100 flex items-center justify-center text-emerald-500 shadow-inner">
              <Fuel className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-800 tracking-tight">
              Fuel Bill Table
            </h3>
          </div>

          {/* Selected-tab count beside the title */}
          <span className="inline-flex items-center justify-center px-2.5 py-0.5 text-xs font-semibold text-slate-600 bg-slate-100 border border-slate-200/80 rounded-full shadow-sm tabular-nums">
            {selectedTabCount}
          </span>

          {/* Segmented status toggle — labels only with respective colors */}
          {onTabChange && (
            <div className="flex items-center p-0.5 ml-2 border border-slate-200/80 rounded-lg overflow-hidden bg-slate-50 shadow-sm">
              {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                const activeClass =
                  tab.id === "ALL"
                    ? "bg-slate-200/80 text-slate-800 shadow-sm font-bold"
                    : tab.id === "PENDING"
                    ? "bg-orange-50/80 text-orange-500 shadow-sm font-bold"
                    : "bg-emerald-50/80 text-emerald-600 shadow-sm font-bold";

                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => onTabChange(tab.id)}
                    aria-pressed={isActive}
                    className={`inline-flex items-center px-5 py-1.5 text-xs font-semibold rounded-md transition-all ${
                      isActive
                        ? activeClass
                        : "bg-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-200/50"
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Selected Row Actions Bar if a row is selected */}
        {selectedBill && (
          <div className="flex items-center gap-2 animate-in fade-in duration-150">
            {onView && (
              <button
                type="button"
                onClick={() => onView(selectedBill)}
                className="group relative h-8 px-2.5 rounded-xl font-medium text-xs flex items-center gap-1 transition-all shadow-sm bg-emerald-50/70 hover:bg-emerald-50/90 text-emerald-600 border border-emerald-200/60 active:scale-95"
                title="View Bill Details"
              >
                <span className={`inline-flex ${uiActionIconMotionClass.view}`}>
                  <Eye size={13} />
                </span>
                <span>{t("common.view")}</span>
              </button>
            )}

            {selectedBill.sourceType !== "TRIP" && onEdit && (
              <button
                type="button"
                onClick={() => onEdit(selectedBill)}
                disabled={canEditDelete ? !canEditDelete(selectedBill) : false}
                className={`group relative h-8 px-2.5 rounded-xl font-medium text-xs flex items-center gap-1 transition-all shadow-sm ${
                  !canEditDelete || canEditDelete(selectedBill)
                    ? "bg-emerald-50/70 hover:bg-emerald-50/80 text-emerald-600 border border-emerald-200/60 active:scale-95"
                    : "bg-slate-50 text-slate-300 border border-slate-100 cursor-not-allowed"
                }`}
                title="Edit Fuel Bill"
              >
                <span className={`inline-flex ${uiActionIconMotionClass.edit}`}>
                  <Pencil size={13} />
                </span>
                <span>{t("common.edit")}</span>
              </button>
            )}

            {selectedBill.sourceType !== "TRIP" && onDelete && (
              <button
                type="button"
                onClick={() => onDelete(selectedBill)}
                disabled={canEditDelete ? !canEditDelete(selectedBill) : false}
                className={`group relative h-8 px-2.5 rounded-xl font-medium text-xs flex items-center gap-1 transition-all shadow-sm ${
                  !canEditDelete || canEditDelete(selectedBill)
                    ? "bg-rose-50/70 hover:bg-rose-50/80 text-rose-500 border border-rose-200/60 active:scale-95"
                    : "bg-slate-50 text-slate-300 border border-slate-100 cursor-not-allowed"
                }`}
                title="Delete Fuel Bill"
              >
                <span className={`inline-flex ${uiActionIconMotionClass.delete}`}>
                  <Trash2 size={13} />
                </span>
                <span>{t("common.delete")}</span>
              </button>
            )}

            {selectedBill.sourceType !== "TRIP" && selectedBill.status === "Pending" && onApprove && (
              <button
                type="button"
                onClick={() => onApprove(selectedBill)}
                className="group relative h-8 px-2.5 rounded-xl font-medium text-xs flex items-center gap-1 transition-all shadow-sm bg-emerald-600 hover:bg-emerald-700 text-white active:scale-95"
                title="Approve Fuel Bill"
              >
                <span className={`inline-flex ${uiActionIconMotionClass.approve}`}>
                  <CheckCircle size={13} />
                </span>
                <span>Approve</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Table Body matching Trip Master Table styling and typography ── */}
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm text-left border-collapse">
          <thead className="bg-slate-50/75 border-b border-slate-200 text-slate-600">
            <tr className="whitespace-nowrap">
              <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider w-10">#</th>

              {/* Bill No */}
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">
                {sortable("billNo", (
                  <div className="flex items-center gap-1.5">
                    <Hash size={14} className="text-slate-400 flex-shrink-0" />
                    <span>Bill No</span>
                  </div>
                ), false)}
              </th>

              {/* Date */}
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">
                {sortable("date", (
                  <div className="flex items-center gap-1.5">
                    <Calendar size={14} className="text-blue-500 flex-shrink-0" />
                    <span>{t("table.date")}</span>
                  </div>
                ), false)}
              </th>

              {/* Trip No (Trip list matching styling) */}
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">
                {sortable("tripNo", (
                  <div className="flex items-center gap-1.5">
                    <Hash size={14} className="text-emerald-500 flex-shrink-0" />
                    <span>{t("operations.trip_no")}</span>
                  </div>
                ), false)}
              </th>

              {/* Source */}
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">
                {sortable("sourceType", (
                  <div className="flex items-center gap-1.5">
                    <Layers size={14} className="text-indigo-500 flex-shrink-0" />
                    <span>Source</span>
                  </div>
                ), false)}
              </th>

              {/* Vehicle */}
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">
                {sortable("vehicleNo", (
                  <div className="flex items-center gap-1.5">
                    <Truck size={14} className="text-indigo-500 flex-shrink-0" />
                    <span>{t("common.vehicle")}</span>
                  </div>
                ), false)}
              </th>

              {/* Driver */}
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">
                {sortable("driverName", (
                  <div className="flex items-center gap-1.5">
                    <User size={14} className="text-amber-500 flex-shrink-0" />
                    <span>{t("common.driver")}</span>
                  </div>
                ), false)}
              </th>

              {/* Meter Reading (KM) — Middle / Center Aligned */}
              <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider">
                {sortable("meterReading", (
                  <div className="flex items-center justify-center gap-1.5">
                    <Gauge size={14} className="text-teal-500 flex-shrink-0" />
                    <span>Meter (KM)</span>
                  </div>
                ), true)}
              </th>

              {/* Litres — Middle / Center Aligned */}
              <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider">
                {sortable("litres", (
                  <div className="flex items-center justify-center gap-1.5">
                    <Droplets size={14} className="text-blue-500 flex-shrink-0" />
                    <span>Litres</span>
                  </div>
                ), true)}
              </th>

              {/* Rate — Middle / Center Aligned */}
              <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider">
                {sortable("rate", (
                  <div className="flex items-center justify-center gap-1.5">
                    <IndianRupee size={14} className="text-slate-500 flex-shrink-0" />
                    <span>Rate (₹/L)</span>
                  </div>
                ), true)}
              </th>

              {/* Amount — Middle / Center Aligned */}
              <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider">
                {sortable("amount", (
                  <div className="flex items-center justify-center gap-1.5">
                    <IndianRupee size={14} className="text-emerald-500 flex-shrink-0" />
                    <span>Amount (₹)</span>
                  </div>
                ), true)}
              </th>

              {/* Petrol Bunk & GPS with Tooltip */}
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">
                <div className="flex items-center gap-1.5">
                  <MapPin size={14} className="text-rose-500 flex-shrink-0" />
                  <span>Petrol Bunk</span>
                </div>
              </th>

              {/* Receipt / Bill Preview */}
              <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider">
                <div className="flex items-center justify-center gap-1.5">
                  <FileImage size={14} className="text-indigo-500 flex-shrink-0" />
                  <span>Receipt</span>
                </div>
              </th>

              {/* Status */}
              <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider">
                {sortable("status", (
                  <div className="flex items-center justify-center gap-1.5">
                    <CheckCircle size={14} className="text-emerald-500 flex-shrink-0" />
                    <span>{t("common.status")}</span>
                  </div>
                ), true)}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <tr>
                <td colSpan={14} className="py-16 text-center text-sm font-medium text-slate-400">
                  <span className="inline-flex items-center gap-2">
                    <span
                      className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-emerald-600"
                      aria-hidden="true"
                    />
                    Loading fuel expenses register...
                  </span>
                </td>
              </tr>
            ) : bills.length === 0 ? (
              <tr>
                <td colSpan={14} className="py-16 text-center text-slate-400 text-sm font-medium">
                  <Fuel size={24} className="mx-auto mb-2 text-slate-300" />
                  No fuel bills found matching the selected filters.
                </td>
              </tr>
            ) : (
              bills.map((bill, index) => {
                const isSelected = bill.id === selectedId;
                const serialNo = startIndex + index + 1;
                const isTrip = bill.sourceType === "TRIP" || !!bill.tripNo;
                const isApproved = isTrip || bill.status === "Approved";
                const isPending = !isTrip && bill.status === "Pending";
                const isRejected = !isTrip && bill.status === "Rejected";

                return (
                  <tr
                    key={bill.id}
                    ref={(el) => {
                      if (el) rowRefs.current.set(bill.id, el);
                      else rowRefs.current.delete(bill.id);
                    }}
                    tabIndex={0}
                    onClick={() => handleRowSelect(bill)}
                    onKeyDown={(e) => handleRowKeyDown(e, index)}
                    aria-selected={isSelected}
                    className={`cursor-pointer outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-400 ${
                      isSelected
                        ? "bg-blue-50/70 border-l-4 border-l-blue-300 ring-1 ring-inset ring-blue-200"
                        : "hover:bg-slate-50/80"
                    }`}
                  >
                    {/* Index / Checkbox */}
                    <td className="px-4 py-3 text-center text-xs font-semibold text-slate-500 w-10">
                      {isSelected ? (
                        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white shadow-sm">
                          <Check size={12} strokeWidth={3} />
                        </span>
                      ) : (
                        serialNo
                      )}
                    </td>

                    {/* Bill No */}
                    <td className="px-4 py-3 font-bold text-slate-700 text-xs whitespace-nowrap">
                      {bill.billNo}
                    </td>

                    {/* Date */}
                    <td className="px-4 py-3 text-xs font-medium text-slate-600 whitespace-nowrap">
                      {formatTripListDay(bill.date, language)}
                    </td>

                    {/* Trip No (Trip list matching typography and emerald styling) */}
                    <td className="px-4 py-3 font-bold text-emerald-500 text-xs whitespace-nowrap">
                      {bill.tripNo ? (
                        localizeTripViewText(bill.tripNo, language)
                      ) : (
                        <span className="text-slate-400 font-normal">—</span>
                      )}
                    </td>

                    {/* Source */}
                    <td className="px-4 py-3 text-xs font-medium text-slate-700 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wider ${
                          isTrip
                            ? "bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-600/20"
                            : "bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-400/20"
                        }`}
                      >
                        {isTrip ? "Trip" : "Manual"}
                      </span>
                    </td>

                    {/* Vehicle */}
                    <td className="px-4 py-3 text-xs font-medium text-slate-700 whitespace-nowrap">
                      {localizeTripViewText(formatVehicleNumber(bill.vehicleNo), language)}
                    </td>

                    {/* Driver */}
                    <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">
                      {localizeTripViewText(bill.driverName || "—", language)}
                    </td>

                    {/* Meter (KM) — Middle / Center Aligned */}
                    <td className="px-4 py-3 text-center text-xs font-medium text-slate-700 tabular-nums whitespace-nowrap">
                      {bill.meterReading > 0 ? bill.meterReading.toLocaleString() : "—"}
                    </td>

                    {/* Litres — Middle / Center Aligned */}
                    <td className="px-4 py-3 text-center text-xs font-bold text-blue-500 tabular-nums whitespace-nowrap">
                      {bill.litres.toFixed(2)}
                    </td>

                    {/* Rate — Middle / Center Aligned */}
                    <td className="px-4 py-3 text-center text-xs font-medium text-slate-700 tabular-nums whitespace-nowrap">
                      {bill.rate.toFixed(2)}
                    </td>

                    {/* Total Amount — Middle / Center Aligned */}
                    <td className="px-4 py-3 text-center text-xs font-bold text-emerald-600 tabular-nums whitespace-nowrap">
                      {bill.amount.toFixed(2)}
                    </td>

                    {/* Petrol Bunk & GPS with Tooltip */}
                    <td className="px-4 py-3 text-xs text-slate-600 max-w-[200px]">
                      <div className="font-medium text-slate-800 truncate" title={bill.petrolBunk}>
                        {bill.petrolBunk || "—"}
                      </div>
                      {bill.gpsLat != null && bill.gpsLon != null && (
                        <div className="mt-0.5" title={`GPS: ${bill.gpsLat.toFixed(5)}, ${bill.gpsLon.toFixed(5)}`}>
                          <GpsAddressText
                            lat={bill.gpsLat}
                            lon={bill.gpsLon}
                            className="text-[11px] text-emerald-600 font-medium"
                            maxLines={1}
                          />
                        </div>
                      )}
                    </td>

                    {/* Receipt / Bill Preview Link with Hover Popup & Full Lightbox */}
                    <td className="px-4 py-3 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      {bill.image ? (
                        <BillPreviewLink
                          href={bill.image}
                          fileName={bill.imageName || `${bill.billNo}.png`}
                        />
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>

                    {/* Status with respective colors matching Trip List */}
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      {isApproved ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold tracking-wide shadow-sm bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle size={12} />
                          <span>Approved</span>
                        </span>
                      ) : isPending ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold tracking-wide shadow-sm bg-orange-50 text-orange-700 border border-orange-200">
                          <Clock size={12} />
                          <span>Pending</span>
                        </span>
                      ) : isRejected ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold tracking-wide shadow-sm bg-rose-50 text-rose-700 border border-rose-200">
                          <AlertCircle size={12} />
                          <span>Rejected</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold tracking-wide shadow-sm bg-slate-100 text-slate-700 border border-slate-200">
                          <span>{bill.status}</span>
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default React.memo(FuelBillTable);
