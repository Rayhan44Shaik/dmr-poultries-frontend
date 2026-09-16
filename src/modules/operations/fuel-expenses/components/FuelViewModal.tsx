// src/modules/operations/fuel-expenses/components/FuelViewModal.tsx
//
// Fuel record view — the same global-view shell as the Trip List and Maintenance view
// (AppShellModal: overlay below the header, ESC to close, fade + scale panel).
// Two-panel split layout:
// - LEFT: Generous expanded sidebar (w-96) listing every approved fuel entry of this vehicle
//   (newest first), filterable by source (Trip / Manual), with roving keyboard navigation,
//   GPS indicators with address tooltip, and receipt thumbnail previews.
// - RIGHT: Full detail breakdown — identity, vehicle, driver, odometer, quantity, rate,
//   total cost, bunk, full-width GPS address block, receipt lightbox and operator remarks.
// - FOOTER: PDF export (bill + vehicle history), in-view Edit (if pending) and Close.

import React, { useState, useRef, useMemo, useCallback } from "react";
import { 
  X, 
  Truck, 
  User, 
  MapPin,
  MessageSquare,
  Fuel,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  FileDown,
  IndianRupee,
  Pencil,
  Image as ImageIcon,
  Building2,
} from "lucide-react";
import AppShellModal from "../../../../ui/AppShellModal";
import type { FuelExpense } from "../types/fuelExpense";
import { formatVehicleNumber } from "../../../../utils/format";
import { formatTripListDay } from "../../vehicle-trips/utils/formatTripListDay";
import { localizeTripViewText } from "../../vehicle-trips/utils/tripViewLocalization";
import { TripNoBadge } from "../../vehicle-trips/components/TripNoBadge";
import { GpsAddressText } from "../../vehicle-trips/components/GpsAddressText";
import { BillPreviewLink } from "../../vehicle-trips/components/Step_5/BillPreviewLink";
import { ScopedI18nProvider, useI18n, translateStatus } from "../../../../i18n";
import { ViewLanguageToggle } from "../../../../ui/ViewLanguageToggle";
import { uiActionIconMotionClass, uiPdfButtonClass } from "../../../../shared/ui/uiTokens";
import { exportToPDF } from "../../../../utils/exportUtils";
import MasterDropdown from "../../../masters/components/MasterDropdown";

export interface FuelViewModalProps {
  isOpen: boolean;
  bill: FuelExpense | null;
  vehicles?: any[];
  /** Every fuel record of this vehicle till now (newest first) — shown in the left panel */
  vehicleBills?: FuelExpense[];
  /** Set when the record can still be edited — shows the in-view Edit action. */
  canEdit?: boolean;
  /** Edit from inside the view — closes the modal and loads the form. */
  onEdit?: (bill: FuelExpense) => void;
  onClose: () => void;
}

function FuelViewModalContent({
  isOpen,
  bill,
  vehicles = [],
  vehicleBills = [],
  canEdit = false,
  onEdit,
  onClose,
}: FuelViewModalProps) {
  const { t, language, toggleLanguage } = useI18n();
  const [sourceFilter, setSourceFilter] = useState("");
  const [pdfBusy, setPdfBusy] = useState(false);

  // The record whose details are displayed. Clicking a row in the vehicle's
  // history swaps it in — identical to Maintenance ViewModal.
  const [active, setActive] = useState<FuelExpense | null>(bill);
  const [lastBill, setLastBill] = useState<FuelExpense | null>(bill);

  if (bill !== lastBill) {
    setLastBill(bill);
    setActive(bill);
  }

  // Find vehicle record for formatting if available
  const currentRecord = active || bill;
  const vehicleObj = currentRecord
    ? vehicles.find(
        (v: any) =>
          String(v.id) === String(currentRecord.vehicleId) ||
          String(v.vehicleNumber || "").toLowerCase() === String(currentRecord.vehicleNo || "").toLowerCase()
      )
    : null;

  const rawVehicleNo = vehicleObj?.vehicleNumber || currentRecord?.vehicleNo || "";
  const vehicleNumber = formatVehicleNumber(rawVehicleNo);

  /** LEFT PANEL list — every APPROVED fuel entry of this vehicle,
   *  newest first, narrowable by source (Trip / Manual). */
  const approvedHistory = useMemo(() => {
    if (!vehicleBills.length && currentRecord) return [currentRecord];
    return vehicleBills
      .filter((r) => {
        const isDeleted = r.deleted === true || r.status === "Deleted";
        if (isDeleted && r.id !== currentRecord?.id) return false;
        const isTrip = r.sourceType === "TRIP" || !!r.tripNo;
        const isApproved = isTrip || r.status === "Approved";
        if (!isApproved && r.id !== currentRecord?.id) return false;

        if (sourceFilter === "TRIP" && !isTrip) return false;
        if (sourceFilter === "MANUAL" && isTrip) return false;
        return true;
      })
      .sort((a, b) => new Date(b.date || b.createdDate || 0).getTime() - new Date(a.date || a.createdDate || 0).getTime());
  }, [vehicleBills, currentRecord, sourceFilter]);

  // Roving focus for the left list — ArrowUp/Down moves the active record.
  const listRefs = useRef(new Map<string, HTMLButtonElement>());
  const moveActive = (fromId: string, step: 1 | -1) => {
    const index = approvedHistory.findIndex((r) => String(r.id) === fromId);
    const next = approvedHistory[index + step];
    if (!next) return;
    setActive(next);
    const element = listRefs.current.get(String(next.id));
    if (element) {
      element.focus();
      element.scrollIntoView({ block: "nearest" });
    }
  };

  const handleDownloadPdf = useCallback(async () => {
    if (!currentRecord || pdfBusy) return;
    setPdfBusy(true);
    try {
      const isTrip = currentRecord.sourceType === "TRIP" || !!currentRecord.tripNo || !!currentRecord.tripId;
      const isDeleted = currentRecord.deleted === true || currentRecord.status === "Deleted";
      const statusStr = isDeleted ? "Deleted" : isTrip ? "Approved (Trip)" : currentRecord.status;

      const headers = ["Field", "Value"];
      const rows = [
        ["Bill Number", currentRecord.billNo],
        ["Date", formatTripListDay(currentRecord.date, language)],
        ["Vehicle", vehicleNumber],
        ["Driver", currentRecord.driverName || "—"],
        ["Source", isTrip ? "Trip Diesel" : "Manual Entry"],
        ["Linked Trip", currentRecord.tripNo || "—"],
        ["Meter Reading", currentRecord.meterReading > 0 ? `${currentRecord.meterReading.toLocaleString("en-IN")} KM` : "—"],
        ["Diesel Quantity", `${currentRecord.litres.toFixed(2)} Litres`],
        ["Rate / Litre", `₹ ${currentRecord.rate.toFixed(2)}`],
        ["Total Amount", `₹ ${currentRecord.amount.toFixed(2)}`],
        ["Petrol Bunk", currentRecord.petrolBunk || "—"],
        ["Status", statusStr],
        ["Remarks", currentRecord.remarks || "—"],
      ];

      exportToPDF(
        `Fuel Bill — ${currentRecord.billNo}`,
        headers,
        rows,
        `Fuel_Bill_${currentRecord.billNo}_${currentRecord.date || "record"}`,
        {
          subtitle: `Vehicle: ${vehicleNumber}  |  Status: ${statusStr}`,
          summary: [
            { label: "Quantity", value: `${currentRecord.litres.toFixed(2)} L` },
            { label: "Rate", value: `₹ ${currentRecord.rate.toFixed(2)}/L` },
            { label: "Total Cost", value: `₹ ${currentRecord.amount.toFixed(2)}` },
            { label: "Meter", value: currentRecord.meterReading > 0 ? `${currentRecord.meterReading.toLocaleString("en-IN")} KM` : "—" },
          ],
        }
      );
    } finally {
      setPdfBusy(false);
    }
  }, [currentRecord, pdfBusy, language, vehicleNumber]);

  if (!isOpen || !currentRecord) return null;

  const isDeleted = currentRecord.deleted === true || currentRecord.status === "Deleted";
  const isTrip = currentRecord.sourceType === "TRIP" || !!currentRecord.tripNo || !!currentRecord.tripId;
  const isApproved = !isDeleted && (isTrip || currentRecord.status === "Approved");

  const vehicleDisplay = localizeTripViewText(vehicleNumber, language);
  const driverDisplay = localizeTripViewText(currentRecord.driverName || "—", language);
  const bunkDisplay = localizeTripViewText(currentRecord.petrolBunk || "—", language);

  const statusLabel = isDeleted
    ? translateStatus(t, "Deleted")
    : isApproved
    ? isTrip
      ? t("ops.fuel.approved_trip_completion")
      : translateStatus(t, "Approved")
    : translateStatus(t, "Pending");

  const statusPillClass = isDeleted
    ? "text-rose-700 bg-rose-50 border-rose-200"
    : isApproved
    ? "text-emerald-700 bg-emerald-50 border-emerald-200"
    : "text-blue-700 bg-blue-50 border-blue-200";

  const statusIcon = isDeleted ? (
    <AlertCircle size={13} className="text-rose-600" />
  ) : isApproved ? (
    <CheckCircle2 size={13} className="text-emerald-600" />
  ) : (
    <Clock size={13} className="text-blue-500" />
  );

  const hasGpsCoords =
    currentRecord.gpsLat != null &&
    currentRecord.gpsLon != null &&
    Number.isFinite(Number(currentRecord.gpsLat)) &&
    Number.isFinite(Number(currentRecord.gpsLon)) &&
    !(Number(currentRecord.gpsLat) === 0 && Number(currentRecord.gpsLon) === 0);

  const showEdit = Boolean(canEdit && onEdit && !isApproved && !isDeleted);

  return (
    <AppShellModal open={isOpen} onClose={onClose} panelClassName="max-w-6xl" ariaLabelledBy="fuel-view-title">
      <div className="flex max-h-[calc(100vh-96px)] flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xl animate-scale-in">
        
        {/* ── Header — Identity + Vehicle + Status Pill + Language Toggle + Close ── */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-gradient-to-r from-slate-50/80 via-white to-slate-50/80 px-6 py-4">
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border border-emerald-100 bg-emerald-50/80 text-emerald-600 shadow-inner">
              <Fuel className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 id="fuel-view-title" className="truncate text-base font-bold tracking-tight text-slate-800">
                {t("ops.fuel.bill_details", { billNo: currentRecord.billNo })}
              </h2>
              <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                <Truck size={13} className="flex-shrink-0 text-slate-400" />
                <span>{vehicleDisplay}</span>
                <span className="text-slate-300">·</span>
                <User size={13} className="flex-shrink-0 text-slate-400" />
                <span>{driverDisplay}</span>
              </p>
            </div>
          </div>

          <div className="flex flex-shrink-0 items-center gap-2.5">
            {/* Status Pill */}
            <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-bold shadow-sm ${statusPillClass}`}>
              {statusIcon}
              <span>{statusLabel}</span>
            </span>

            {/* Language Switcher */}
            <ViewLanguageToggle
              language={language}
              onToggle={toggleLanguage}
              tone="emerald"
              labelMode="target"
              ariaLabel={t("ops.fuel.popup_language_toggle")}
            />

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              aria-label={t("common.close")}
              className="group relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition-all hover:-translate-y-0.5 hover:border-red-100 hover:bg-red-50 hover:text-red-500 active:scale-95 cursor-pointer"
            >
              <span className={`inline-flex ${uiActionIconMotionClass.close}`}><X size={16} /></span>
            </button>
          </div>
        </div>

        {/* ── Body — Split Layout: Left Expanded Sidebar (w-96) + Right (Active record details) ── */}
        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          
          {/* ── LEFT PANEL — Generous sidebar with every approved fuel entry of this vehicle ── */}
          <aside className="flex w-full flex-shrink-0 flex-col border-b border-slate-100 bg-slate-50/40 lg:w-[380px] lg:border-b-0 lg:border-r">
            <div className="flex items-center justify-between px-4 pt-4">
              <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <Truck size={13} className="flex-shrink-0 text-slate-400" />
                <span>{t("fleet.maintenance_view.all_records") || "All Records"}</span>
              </p>
              <span className="rounded-full bg-white px-2.5 py-0.5 text-[11px] font-bold tabular-nums text-slate-600 ring-1 ring-slate-200 shadow-xs">
                {approvedHistory.length}
              </span>
            </div>

            {/* Source filter dropdown */}
            <div className="px-3 pt-2.5">
              <MasterDropdown
                hideLabel
                label={t("ops.fuel.source") || "Source"}
                value={sourceFilter}
                options={[
                  { value: "", label: t("common.all") },
                  { value: "TRIP", label: t("ops.fuel.trip_diesel") || "Trip Diesel" },
                  { value: "MANUAL", label: t("ops.fuel.manual_bill") || "Manual Bill" },
                ]}
                onChange={(next) => setSourceFilter(next || "")}
                placeholder={t("ops.fuel.source") || "Source"}
                allowClear
                className="w-full"
              />
            </div>

            {/* Scrollable list of vehicle fuel entries */}
            <div className="max-h-64 min-h-0 flex-1 overflow-y-auto p-3 lg:max-h-none space-y-2">
              {approvedHistory.length === 0 ? (
                <p className="py-8 text-center text-xs font-medium text-slate-400">
                  {t("ops.fuel.no_records") || "No records found"}
                </p>
              ) : (
                approvedHistory.map((rec) => {
                  const isSelected = String(rec.id) === String(currentRecord.id);
                  const isRecTrip = rec.sourceType === "TRIP" || !!rec.tripNo;
                  const hasGps = rec.gpsLat != null && rec.gpsLon != null && !(Number(rec.gpsLat) === 0 && Number(rec.gpsLon) === 0);
                  const hasImg = Boolean(rec.image);

                  return (
                    <button
                      key={rec.id}
                      ref={(element) => {
                        if (element && rec.id) listRefs.current.set(String(rec.id), element);
                        else if (rec.id) listRefs.current.delete(String(rec.id));
                      }}
                      type="button"
                      onClick={() => setActive(rec)}
                      onKeyDown={(event) => {
                        if (event.key === "ArrowDown") {
                          event.preventDefault();
                          moveActive(String(rec.id), 1);
                        } else if (event.key === "ArrowUp") {
                          event.preventDefault();
                          moveActive(String(rec.id), -1);
                        }
                      }}
                      className={`group flex w-full flex-col rounded-xl border p-3 text-left transition-all ${
                        isSelected
                          ? "border-emerald-500 bg-emerald-50/80 shadow-sm ring-1 ring-emerald-400 border-l-4 border-l-emerald-600"
                          : "border-slate-200/80 bg-white hover:border-slate-300 hover:bg-slate-50/80"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slate-800">
                          {formatTripListDay(rec.date || rec.createdDate, language)}
                        </span>
                        <span
                          className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-bold border ${
                            isRecTrip
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-blue-50 text-blue-700 border-blue-200"
                          }`}
                        >
                          {isRecTrip ? rec.tripNo || t("ops.fuel.trip_diesel") : t("ops.fuel.manual_entry")}
                        </span>
                      </div>

                      {/* Bill No & Bunk Name */}
                      <div className="mt-1 flex items-center justify-between gap-1 text-xs">
                        <span className="font-mono text-[11px] font-bold text-slate-700 truncate max-w-[130px]">
                          {rec.billNo}
                        </span>
                        <span className="text-[11px] text-slate-500 truncate max-w-[160px] text-right">
                          {rec.petrolBunk || "—"}
                        </span>
                      </div>

                      {/* Quantity, Cost & Feature Badges (GPS, Photo) */}
                      <div className="mt-1.5 flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold tabular-nums text-blue-600">
                            {rec.litres.toFixed(2)} L
                          </span>
                          <span className="text-slate-300">·</span>
                          <span className="font-bold tabular-nums text-emerald-700">
                            ₹{rec.amount.toFixed(2)}
                          </span>
                        </div>

                        <div className="flex items-center gap-1">
                          {hasGps && (
                            <span 
                              className="inline-flex items-center text-emerald-600 bg-emerald-50 rounded p-0.5 border border-emerald-100" 
                              title={`GPS: ${Number(rec.gpsLat).toFixed(4)}°N, ${Number(rec.gpsLon).toFixed(4)}°E`}
                            >
                              <MapPin size={11} />
                            </span>
                          )}
                          {hasImg && (
                            <span 
                              className="inline-flex items-center text-blue-600 bg-blue-50 rounded p-0.5 border border-blue-100" 
                              title={t("ops.fuel.receipt_document")}
                            >
                              <ImageIcon size={11} />
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </aside>

          {/* ── RIGHT PANEL — Full Details of the active record ── */}
          <div className="min-w-0 flex-1 overflow-y-auto p-6 space-y-4">
            
            {/* Identity & 2-Column Key Metrics / Attribute Pairs */}
            <section className="animate-fade-in-up">
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {(() => {
                  const rows: [string, React.ReactNode][] = [
                    [t("ops.fuel.bill_no"), <span className="font-mono font-bold text-slate-800">{currentRecord.billNo || "—"}</span>],
                    [t("common.date"), formatTripListDay(currentRecord.date || currentRecord.createdDate, language)],
                    [t("common.vehicle"), vehicleDisplay],
                    [t("common.driver"), driverDisplay],
                    [
                      t("ops.fuel.source"),
                      <span className="inline-flex items-center gap-1 font-semibold text-slate-800">
                        {isTrip ? t("ops.fuel.trip_diesel") : t("ops.fuel.manual_bill")}
                      </span>,
                    ],
                    [
                      t("ops.fuel.source_linked_trip"),
                      currentRecord.tripNo ? <TripNoBadge tripNo={currentRecord.tripNo} /> : <span className="text-slate-400">—</span>,
                    ],
                    [
                      t("ops.fuel.odometer_meter"),
                      currentRecord.meterReading > 0 ? (
                        <span className="tabular-nums font-bold text-slate-800">
                          {currentRecord.meterReading.toLocaleString("en-IN")} KM
                        </span>
                      ) : (
                        <span className="text-slate-400">{t("ops.fuel.not_recorded")}</span>
                      ),
                    ],
                    [
                      t("ops.fuel.litres"),
                      <span className="tabular-nums font-bold text-blue-600">{currentRecord.litres.toFixed(2)} L</span>,
                    ],
                    [
                      t("ops.fuel.rate_per_l"),
                      <span className="tabular-nums font-bold text-slate-700">₹ {currentRecord.rate.toFixed(2)}</span>,
                    ],
                    [
                      t("ops.fuel.total_cost"),
                      <span className="tabular-nums font-extrabold text-emerald-600">₹ {currentRecord.amount.toFixed(2)}</span>,
                    ],
                    [
                      t("ops.fuel.petrol_bunk"),
                      <span className="font-medium text-slate-800">{bunkDisplay}</span>,
                    ],
                    [t("common.status"), statusLabel],
                  ];

                  const half = Math.ceil(rows.length / 2);
                  const column = (items: [string, React.ReactNode][], first: boolean) => (
                    <dl className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                      {items.map(([label, value], index) => (
                        <div
                          key={label}
                          className={`flex items-start justify-between gap-4 px-4 py-2.5 ${
                            index > 0 ? "border-t border-slate-100" : ""
                          } ${first ? "lg:border-r lg:border-slate-100" : ""} hover:bg-slate-50/60 transition-colors`}
                        >
                          <dt className="w-28 flex-shrink-0 text-[11px] font-bold uppercase tracking-wider text-slate-400 pt-0.5">
                            {label}
                          </dt>
                          <dd className="min-w-0 flex-1 break-words text-right text-[13px] font-bold text-slate-800">
                            {value}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  );

                  return (
                    <>
                      {column(rows.slice(0, half), true)}
                      {column(rows.slice(half), false)}
                    </>
                  );
                })()}
              </div>
            </section>

            {/* GPS Location & Address Card matching Step 2 & Step 5 */}
            <section className="animate-fade-in-up" style={{ animationDelay: "40ms" }}>
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
                <span className="text-[12px] uppercase font-bold text-slate-500 flex items-center gap-1.5 mb-2">
                  <span className="h-6 w-6 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center shrink-0">
                    <MapPin size={13} />
                  </span>
                  <span>{t("ops.trip.field.gps_address") || "GPS Location & Address"}</span>
                </span>
                {hasGpsCoords ? (
                  <div className="space-y-1">
                    <p className="text-[13px] font-semibold text-slate-800 break-words leading-relaxed">
                      <GpsAddressText
                        lat={currentRecord.gpsLat}
                        lon={currentRecord.gpsLon}
                        fallback={t("ops.trip.location_captured")}
                      />
                    </p>
                    <div className="text-[11px] font-mono text-emerald-600 font-semibold pt-1">
                      GPS: {Number(currentRecord.gpsLat).toFixed(6)}°N, {Number(currentRecord.gpsLon).toFixed(6)}°E
                    </div>
                  </div>
                ) : (
                  <p className="text-xs font-semibold text-slate-400 italic">
                    {t("ops.trip.not_captured") || "Location not captured"}
                  </p>
                )}
              </div>
            </section>

            {/* Total Fuel Cost Band */}
            <section className="animate-fade-in-up" style={{ animationDelay: "80ms" }}>
              <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-100 bg-gradient-to-r from-emerald-50/80 via-white to-emerald-50/50 px-4 py-3">
                <span className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                  <IndianRupee size={15} className="flex-shrink-0" />
                  {t("ops.fuel.total_fuel_cost")}
                </span>
                <span className="text-lg font-bold tabular-nums text-emerald-700">
                  ₹ {Number(currentRecord.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </section>

            {/* Receipt Document Card with Preview Lightbox */}
            <section className="animate-fade-in-up" style={{ animationDelay: "120ms" }}>
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 shadow-xs">
                    <FileText size={20} />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-800">{t("ops.fuel.receipt_document")}</div>
                    <div className="text-[11px] text-slate-400">{t("ops.fuel.receipt_document_hint")}</div>
                  </div>
                </div>

                <div className="flex items-center gap-3 self-end sm:self-center">
                  {currentRecord.image ? (
                    <div className="flex items-center gap-2.5">
                      <img
                        src={currentRecord.image}
                        alt="Receipt thumbnail"
                        className="h-10 w-10 object-cover rounded-lg border border-slate-200 bg-slate-50"
                      />
                      <BillPreviewLink
                        href={currentRecord.image}
                        fileName={currentRecord.imageName || `${currentRecord.billNo}.png`}
                      />
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400 font-medium italic">
                      {t("ops.fuel.not_uploaded")}
                    </span>
                  )}
                </div>
              </div>
            </section>

            {/* Remarks Callout (if any) */}
            {currentRecord.remarks && (
              <section className="animate-fade-in-up" style={{ animationDelay: "160ms" }}>
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
                  <div className="flex items-start gap-2.5">
                    <MessageSquare size={16} className="text-emerald-600 mt-0.5 flex-shrink-0" />
                    <div className="min-w-0">
                      <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        {t("ops.fuel.remarks_operator_notes")}
                      </div>
                      <p className="text-xs sm:text-sm text-slate-700 font-medium leading-relaxed">
                        {localizeTripViewText(currentRecord.remarks, language)}
                      </p>
                    </div>
                  </div>
                </div>
              </section>
            )}

          </div>
        </div>

        {/* ── Footer — PDF Export, Edit inside the view, Close ── */}
        <div className="flex items-center justify-end gap-3 rounded-b-2xl border-t border-slate-100 bg-gradient-to-r from-slate-50/80 via-white to-slate-50/80 px-6 py-4 shrink-0">
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={pdfBusy}
            className={`group relative ${uiPdfButtonClass} disabled:opacity-60 cursor-pointer`}
            aria-label="PDF"
          >
            {pdfBusy ? (
              <span className="inline-flex h-4 w-4 animate-spin rounded-full border-2 border-rose-200 border-t-rose-500" aria-hidden="true" />
            ) : (
              <span className={`inline-flex ${uiActionIconMotionClass.pdf}`}><FileDown size={15} /></span>
            )}
            <span>PDF</span>
          </button>

          {showEdit && (
            <button
              type="button"
              onClick={() => onEdit?.(currentRecord)}
              className="group relative inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-6 py-2.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-blue-700 active:scale-95 cursor-pointer"
            >
              <span className={`inline-flex ${uiActionIconMotionClass.edit}`}><Pencil size={15} /></span>
              <span>{t("common.edit")}</span>
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="group relative inline-flex items-center gap-2 rounded-2xl bg-slate-100 px-6 py-2.5 text-xs font-semibold text-slate-700 transition-all hover:bg-slate-200 active:scale-95 cursor-pointer"
            aria-label={t("common.close")}
          >
            <span className={`inline-flex ${uiActionIconMotionClass.close}`}><X size={15} /></span>
            <span>{t("common.close")}</span>
          </button>
        </div>

      </div>
    </AppShellModal>
  );
}

export function FuelViewModal(props: FuelViewModalProps) {
  const { language } = useI18n();
  return (
    <ScopedI18nProvider initialLanguage={language}>
      <FuelViewModalContent {...props} />
    </ScopedI18nProvider>
  );
}

export default React.memo(FuelViewModal);
