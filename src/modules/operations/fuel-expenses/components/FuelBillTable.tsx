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
  XCircle,
  Route,
  Clock,
  Sparkles,
} from "lucide-react";
import type { FuelExpense, FuelSortKey } from "../types/fuelExpense";
import type { FuelQuickTab } from "../utils/filterFuelExpenses";
import { formatVehicleNumber } from "../../../../utils/format";
import { useI18n } from "../../../../i18n";
import BrandMark from "../../../../ui/BrandMark";

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
  onReject?: (bill: FuelExpense) => void;
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
    trip: number;
    manual: number;
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
  onReject,
  canEditDelete,
  startIndex = 0,
  sortBy = null,
  sortDir = "asc",
  onSortChange,
  activeTab = "ALL",
  onTabChange,
  tabCounts = { all: 0, pending: 0, approved: 0, trip: 0, manual: 0 },
}: Props) {
  const { t } = useI18n();
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

  const sortable = (key: FuelSortKey, content: React.ReactNode, center = false, right = false) => {
    if (!onSortChange) return content;
    const active = sortBy === key;
    return (
      <button
        type="button"
        onClick={() => onSortChange(key)}
        aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
        className={`group/sort flex items-center gap-1.5 w-full uppercase tracking-wider font-bold text-[11.5px] transition-colors hover:text-emerald-700 ${
          center ? "justify-center" : right ? "justify-end" : "justify-start"
        } ${active ? "text-emerald-700" : "text-slate-600"}`}
      >
        {content}
        <SortArrows active={active} dir={sortDir} />
      </button>
    );
  };

  const formatDate = (d: string) => {
    if (!d) return "—";
    const date = new Date(d);
    return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  };

  const tabs: { id: FuelQuickTab; label: string; count: number; tone: "slate" | "amber" | "emerald" | "indigo" | "violet" }[] = [
    { id: "ALL", label: "All Bills", count: tabCounts.all, tone: "slate" },
    { id: "PENDING", label: "Pending Approval", count: tabCounts.pending, tone: "amber" },
    { id: "APPROVED", label: "Approved", count: tabCounts.approved, tone: "emerald" },
    { id: "TRIP", label: "Trip Diesel", count: tabCounts.trip, tone: "indigo" },
    { id: "MANUAL", label: "Manual Bills", count: tabCounts.manual, tone: "violet" },
  ];

  return (
    <div className="w-full">
      {/* ── Table Card Top Bar with DMR Brand Logo & Status Pills ── */}
      <div className="border-b border-slate-200/80 bg-gradient-to-r from-emerald-50/50 via-white to-blue-50/40 px-4 py-3.5 sm:px-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          
          {/* Brand Mark & Title */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-slate-200/80 p-1">
              <BrandMark size="xs" variant="plain" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold tracking-tight text-slate-800">
                  Fuel Expenses Register
                </h3>
                <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                  {tabCounts.all} Total
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Fleet diesel consumption, meter readings & bunk receipts
              </p>
            </div>
          </div>

          {/* Quick Status & Source Filter Toggle Pills */}
          {onTabChange && (
            <div className="flex items-center gap-1.5 overflow-x-auto rounded-xl bg-slate-100/90 p-1 ring-1 ring-slate-200/60 max-w-full">
              {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => onTabChange(tab.id)}
                    className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all duration-150 ${
                      isActive
                        ? "bg-white text-slate-800 shadow-sm ring-1 ring-slate-200/80"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
                    }`}
                  >
                    {tab.id === "PENDING" && (
                      <span className="relative flex h-2 w-2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
                      </span>
                    )}
                    {tab.id === "APPROVED" && (
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    )}
                    {tab.id === "TRIP" && (
                      <Route size={13} className="text-indigo-500" />
                    )}
                    {tab.id === "MANUAL" && (
                      <Sparkles size={13} className="text-violet-500" />
                    )}
                    <span>{tab.label}</span>
                    <span
                      className={`ml-0.5 rounded-full px-1.5 py-0.2 text-[10px] font-bold tabular-nums ${
                        isActive
                          ? "bg-slate-100 text-slate-800"
                          : "bg-white/80 text-slate-500"
                      }`}
                    >
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Selected Row Actions Toolbar (Floating bar if row selected) */}
        {selectedBill && (
          <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-blue-50/90 border border-blue-200/80 px-3.5 py-2 text-xs animate-in fade-in slide-in-from-top-1 duration-150">
            <div className="flex items-center gap-2 font-semibold text-blue-900">
              <span className="flex h-2 w-2 rounded-full bg-blue-600" />
              <span>Selected Bill:</span>
              <span className="font-bold text-blue-950 font-mono">{selectedBill.billNo}</span>
              <span className="text-slate-400">|</span>
              <span className="text-blue-800">{formatVehicleNumber(selectedBill.vehicleNo)}</span>
              <span className="text-slate-400">|</span>
              <span className="text-emerald-700 font-bold">₹ {selectedBill.amount.toFixed(2)}</span>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              {onView && (
                <button
                  type="button"
                  onClick={() => onView(selectedBill)}
                  className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1 font-semibold text-blue-700 shadow-sm border border-blue-200 hover:bg-blue-50 transition"
                  title="View Bill Details"
                >
                  <Eye size={14} />
                  <span>View</span>
                </button>
              )}

              {onEdit && (
                <button
                  type="button"
                  onClick={() => onEdit(selectedBill)}
                  disabled={canEditDelete ? !canEditDelete(selectedBill) : false}
                  className={`inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1 font-semibold shadow-sm border transition ${
                    !canEditDelete || canEditDelete(selectedBill)
                      ? "text-emerald-700 border-emerald-200 hover:bg-emerald-50 cursor-pointer"
                      : "text-slate-400 border-slate-200 opacity-60 cursor-not-allowed"
                  }`}
                  title={
                    canEditDelete && !canEditDelete(selectedBill)
                      ? "Cannot edit bills older than 10 days"
                      : "Edit Fuel Bill"
                  }
                >
                  <Pencil size={14} />
                  <span>Edit</span>
                </button>
              )}

              {onDelete && (
                <button
                  type="button"
                  onClick={() => onDelete(selectedBill)}
                  disabled={canEditDelete ? !canEditDelete(selectedBill) : false}
                  className={`inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1 font-semibold shadow-sm border transition ${
                    !canEditDelete || canEditDelete(selectedBill)
                      ? "text-rose-700 border-rose-200 hover:bg-rose-50 cursor-pointer"
                      : "text-slate-400 border-slate-200 opacity-60 cursor-not-allowed"
                  }`}
                  title={
                    canEditDelete && !canEditDelete(selectedBill)
                      ? "Cannot delete bills older than 10 days"
                      : "Delete Fuel Bill"
                  }
                >
                  <Trash2 size={14} />
                  <span>Delete</span>
                </button>
              )}

              {selectedBill.status === "Pending" && selectedBill.sourceType !== "TRIP" && (
                <>
                  {onApprove && (
                    <button
                      type="button"
                      onClick={() => onApprove(selectedBill)}
                      className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 font-semibold text-white shadow-sm hover:bg-emerald-700 transition"
                      title="Approve Fuel Bill"
                    >
                      <CheckCircle size={14} />
                      <span>Approve</span>
                    </button>
                  )}
                  {onReject && (
                    <button
                      type="button"
                      onClick={() => onReject(selectedBill)}
                      className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-2.5 py-1 font-semibold text-white shadow-sm hover:bg-rose-700 transition"
                      title="Reject Fuel Bill"
                    >
                      <XCircle size={14} />
                      <span>Reject</span>
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Responsive Table ── */}
      <div className="w-full overflow-x-auto">
        <table className="min-w-full text-[13px] text-left border-collapse">
          <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600">
            <tr className="whitespace-nowrap">
              <th className="px-3.5 py-3.5 text-center text-[11.5px] font-bold uppercase tracking-wider w-10">
                #
              </th>
              <th className="px-3.5 py-3.5 text-left text-[11.5px] font-bold uppercase tracking-wider">
                {sortable("billNo", (
                  <div className="flex items-center gap-1.5">
                    <Hash size={13} className="text-slate-400 flex-shrink-0" />
                    <span>Bill No</span>
                  </div>
                ))}
              </th>
              <th className="px-3.5 py-3.5 text-left text-[11.5px] font-bold uppercase tracking-wider">
                {sortable("date", (
                  <div className="flex items-center gap-1.5">
                    <Calendar size={13} className="text-blue-500 flex-shrink-0" />
                    <span>Date</span>
                  </div>
                ))}
              </th>
              <th className="px-3.5 py-3.5 text-left text-[11.5px] font-bold uppercase tracking-wider">
                {sortable("sourceType", (
                  <div className="flex items-center gap-1.5">
                    <Layers size={13} className="text-indigo-500 flex-shrink-0" />
                    <span>Source</span>
                  </div>
                ))}
              </th>
              <th className="px-3.5 py-3.5 text-left text-[11.5px] font-bold uppercase tracking-wider">
                {sortable("tripNo", (
                  <div className="flex items-center gap-1.5">
                    <Route size={13} className="text-violet-500 flex-shrink-0" />
                    <span>Trip No</span>
                  </div>
                ))}
              </th>
              <th className="px-3.5 py-3.5 text-left text-[11.5px] font-bold uppercase tracking-wider">
                {sortable("vehicleNo", (
                  <div className="flex items-center gap-1.5">
                    <Truck size={13} className="text-emerald-500 flex-shrink-0" />
                    <span>{t("common.vehicle")}</span>
                  </div>
                ))}
              </th>
              <th className="px-3.5 py-3.5 text-left text-[11.5px] font-bold uppercase tracking-wider">
                {sortable("driverName", (
                  <div className="flex items-center gap-1.5">
                    <User size={13} className="text-slate-500 flex-shrink-0" />
                    <span>{t("common.driver")}</span>
                  </div>
                ))}
              </th>
              <th className="px-3.5 py-3.5 text-right text-[11.5px] font-bold uppercase tracking-wider">
                {sortable("meterReading", (
                  <div className="flex items-center justify-end gap-1.5">
                    <Gauge size={13} className="text-cyan-500 flex-shrink-0" />
                    <span>Meter (KM)</span>
                  </div>
                ), false, true)}
              </th>
              <th className="px-3.5 py-3.5 text-right text-[11.5px] font-bold uppercase tracking-wider">
                {sortable("litres", (
                  <div className="flex items-center justify-end gap-1.5">
                    <Droplets size={13} className="text-blue-500 flex-shrink-0" />
                    <span>Litres</span>
                  </div>
                ), false, true)}
              </th>
              <th className="px-3.5 py-3.5 text-right text-[11.5px] font-bold uppercase tracking-wider">
                {sortable("rate", (
                  <div className="flex items-center justify-end gap-1.5">
                    <IndianRupee size={13} className="text-amber-500 flex-shrink-0" />
                    <span>Rate (₹/L)</span>
                  </div>
                ), false, true)}
              </th>
              <th className="px-3.5 py-3.5 text-right text-[11.5px] font-bold uppercase tracking-wider">
                {sortable("amount", (
                  <div className="flex items-center justify-end gap-1.5">
                    <IndianRupee size={13} className="text-emerald-500 flex-shrink-0" />
                    <span>Amount (₹)</span>
                  </div>
                ), false, true)}
              </th>
              <th className="px-3.5 py-3.5 text-left text-[11.5px] font-bold uppercase tracking-wider">
                {sortable("petrolBunk", (
                  <div className="flex items-center gap-1.5">
                    <MapPin size={13} className="text-rose-500 flex-shrink-0" />
                    <span>Petrol Bunk</span>
                  </div>
                ))}
              </th>
              <th className="px-3.5 py-3.5 text-center text-[11.5px] font-bold uppercase tracking-wider">
                <span>Receipt</span>
              </th>
              <th className="px-3.5 py-3.5 text-center text-[11.5px] font-bold uppercase tracking-wider">
                {sortable("status", (
                  <div className="flex items-center justify-center gap-1.5">
                    <Clock size={13} className="text-slate-400 flex-shrink-0" />
                    <span>Status</span>
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
                <td colSpan={14} className="py-14 text-center text-slate-400 text-sm font-medium">
                  No fuel bills found matching the selected filters.
                </td>
              </tr>
            ) : (
              bills.map((bill, index) => {
                const isSelected = bill.id === selectedId;
                const serialNo = startIndex + index + 1;
                const isPending = bill.status === "Pending";
                const isTrip = bill.sourceType === "TRIP";
                const gpsText =
                  bill.gpsLat != null && bill.gpsLon != null
                    ? `GPS: ${bill.gpsLat.toFixed(4)}, ${bill.gpsLon.toFixed(4)}`
                    : null;

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
                        ? "bg-blue-50/80 border-l-4 border-l-blue-400 ring-1 ring-inset ring-blue-200"
                        : isPending
                        ? `bg-amber-50/25 hover:bg-amber-50/50 ${index % 2 === 0 ? "" : "bg-opacity-40"}`
                        : `hover:bg-slate-50/70 ${index % 2 === 0 ? "bg-white" : "bg-slate-50/30"}`
                    }`}
                  >
                    {/* Index / Checkbox */}
                    <td className="px-3.5 py-3.5 text-center text-xs font-semibold text-slate-500 w-10">
                      {isSelected ? (
                        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white shadow-sm">
                          <Check size={12} strokeWidth={3} />
                        </span>
                      ) : (
                        serialNo
                      )}
                    </td>

                    {/* Bill No */}
                    <td className="px-3.5 py-3.5 font-bold text-emerald-700 text-xs whitespace-nowrap font-mono">
                      <div className="flex items-center gap-1.5">
                        <span className={`h-1.5 w-1.5 rounded-full ${isPending ? "bg-amber-500" : "bg-emerald-500"}`} />
                        <span>{bill.billNo}</span>
                      </div>
                    </td>

                    {/* Date */}
                    <td className="px-3.5 py-3.5 text-xs font-medium text-slate-700 whitespace-nowrap">
                      {formatDate(bill.date)}
                    </td>

                    {/* Source (TRIP vs MANUAL) */}
                    <td className="px-3.5 py-3.5 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wider ${
                          isTrip
                            ? "bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-600/20"
                            : "bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-400/20"
                        }`}
                      >
                        {isTrip ? <Route size={11} className="text-indigo-500" /> : <Sparkles size={11} className="text-violet-500" />}
                        {bill.sourceType || "MANUAL"}
                      </span>
                    </td>

                    {/* Trip No */}
                    <td className="px-3.5 py-3.5 text-xs font-medium text-slate-600 whitespace-nowrap">
                      {bill.tripNo ? (
                        <span className="font-mono text-indigo-700 bg-indigo-50/60 px-1.5 py-0.5 rounded border border-indigo-100">
                          {bill.tripNo}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>

                    {/* Vehicle */}
                    <td className="px-3.5 py-3.5 font-semibold text-slate-800 text-xs whitespace-nowrap">
                      <span className="rounded-md bg-slate-100 px-2 py-1 text-slate-700 ring-1 ring-inset ring-slate-200">
                        {formatVehicleNumber(bill.vehicleNo)}
                      </span>
                    </td>

                    {/* Driver */}
                    <td className="px-3.5 py-3.5 text-xs text-slate-700 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <User size={13} className="text-slate-400" />
                        <span>{bill.driverName || "—"}</span>
                      </div>
                    </td>

                    {/* Meter (KM) */}
                    <td className="px-3.5 py-3.5 text-right text-xs font-medium text-slate-700 tabular-nums whitespace-nowrap">
                      {bill.meterReading > 0 ? `${bill.meterReading.toLocaleString()} km` : "—"}
                    </td>

                    {/* Litres */}
                    <td className="px-3.5 py-3.5 text-right text-xs font-bold text-blue-700 tabular-nums whitespace-nowrap">
                      {bill.litres.toFixed(2)} L
                    </td>

                    {/* Rate */}
                    <td className="px-3.5 py-3.5 text-right text-xs font-medium text-slate-700 tabular-nums whitespace-nowrap">
                      ₹ {bill.rate.toFixed(2)}
                    </td>

                    {/* Total Amount */}
                    <td className="px-3.5 py-3.5 text-right text-xs font-extrabold text-emerald-600 tabular-nums whitespace-nowrap">
                      ₹ {bill.amount.toFixed(2)}
                    </td>

                    {/* Petrol Bunk & GPS */}
                    <td className="px-3.5 py-3.5 text-xs text-slate-700 max-w-[160px] truncate" title={bill.petrolBunk}>
                      <div className="flex items-center gap-1">
                        <MapPin size={13} className="text-rose-500 shrink-0" />
                        <span className="truncate">{bill.petrolBunk || "—"}</span>
                        {gpsText && (
                          <span className="text-[10px] text-emerald-600 font-medium" title={gpsText}>
                            (GPS)
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Receipt Image */}
                    <td className="px-3.5 py-3.5 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      {bill.image ? (
                        <a
                          href={bill.image}
                          download={`${bill.billNo}.png`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-700 hover:bg-blue-100 transition ring-1 ring-inset ring-blue-600/20"
                          title="View / Download Receipt"
                        >
                          <FileImage size={13} />
                          <span>Receipt</span>
                        </a>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="px-3.5 py-3.5 text-center whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                          bill.status === "Approved"
                            ? "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20"
                            : bill.status === "Rejected"
                            ? "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-600/20"
                            : "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20"
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            bill.status === "Approved"
                              ? "bg-emerald-500"
                              : bill.status === "Rejected"
                              ? "bg-rose-500"
                              : "bg-amber-500 animate-pulse"
                          }`}
                        />
                        <span>{bill.sourceType === "TRIP" && bill.status === "Approved" ? "AUTO APPROVED" : bill.status}</span>
                      </span>
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
