import React, { useState, useCallback } from "react";
import { 
  X, 
  Truck, 
  User, 
  MessageSquare,
  Fuel,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  FileDown,
  IndianRupee,
} from "lucide-react";
import AppShellModal from "../../../../ui/AppShellModal";
import type { FuelExpense } from "../types/fuelExpense";
import { formatVehicleNumber } from "../../../../utils/format";
import { formatTripListDay } from "../../vehicle-trips/utils/formatTripListDay";
import { localizeTripViewText } from "../../vehicle-trips/utils/tripViewLocalization";
import { TripNoBadge } from "../../vehicle-trips/components/TripNoBadge";
import { GpsAddressText } from "../../vehicle-trips/components/GpsAddressText";
import { BillPreviewLink } from "../../vehicle-trips/components/Step_5/BillPreviewLink";
import { ScopedI18nProvider, useI18n } from "../../../../i18n";
import { ViewLanguageToggle } from "../../../../ui/ViewLanguageToggle";
import { uiActionIconMotionClass, uiPdfButtonClass } from "../../../../shared/ui/uiTokens";
import { exportToPDF } from "../../../../utils/exportUtils";

interface FuelViewModalProps {
  isOpen: boolean;
  bill: FuelExpense | null;
  onClose: () => void;
}

function FuelViewModalContent({ isOpen, bill, onClose }: FuelViewModalProps) {
  const { t, language, toggleLanguage } = useI18n();
  const [pdfBusy, setPdfBusy] = useState(false);

  const handleDownloadPdf = useCallback(async () => {
    if (!bill || pdfBusy) return;
    setPdfBusy(true);
    try {
      const isTrip = bill.sourceType === "TRIP" || !!bill.tripNo || !!bill.tripId;
      const isDeleted = bill.deleted === true || bill.status === "Deleted";
      const statusStr = isDeleted ? "Deleted" : isTrip ? "Approved (Trip)" : bill.status;

      const headers = ["Field", "Value"];
      const rows = [
        ["Bill Number", bill.billNo],
        ["Date", formatTripListDay(bill.date, language)],
        ["Vehicle", formatVehicleNumber(bill.vehicleNo)],
        ["Driver", bill.driverName || "—"],
        ["Source", isTrip ? "Trip Diesel" : "Manual Entry"],
        ["Linked Trip", bill.tripNo || "—"],
        ["Meter Reading", bill.meterReading > 0 ? `${bill.meterReading.toLocaleString("en-IN")} KM` : "—"],
        ["Diesel Quantity", `${bill.litres.toFixed(2)} Litres`],
        ["Rate / Litre", `₹ ${bill.rate.toFixed(2)}`],
        ["Total Amount", `₹ ${bill.amount.toFixed(2)}`],
        ["Petrol Bunk", bill.petrolBunk || "—"],
        ["Status", statusStr],
        ["Remarks", bill.remarks || "—"],
      ];

      exportToPDF(
        `Fuel Bill — ${bill.billNo}`,
        headers,
        rows,
        `Fuel_Bill_${bill.billNo}_${bill.date || "record"}`,
        {
          subtitle: `Vehicle: ${formatVehicleNumber(bill.vehicleNo)}  |  Status: ${statusStr}`,
          summary: [
            { label: "Quantity", value: `${bill.litres.toFixed(2)} L` },
            { label: "Rate", value: `₹ ${bill.rate.toFixed(2)}/L` },
            { label: "Total Cost", value: `₹ ${bill.amount.toFixed(2)}` },
            { label: "Meter", value: bill.meterReading > 0 ? `${bill.meterReading.toLocaleString("en-IN")} KM` : "—" },
          ],
        }
      );
    } finally {
      setPdfBusy(false);
    }
  }, [bill, pdfBusy, language]);

  if (!isOpen || !bill) return null;

  const isDeleted = bill.deleted === true || bill.status === "Deleted";
  const isTrip = bill.sourceType === "TRIP" || !!bill.tripNo || !!bill.tripId;
  const isApproved = !isDeleted && (isTrip || bill.status === "Approved");

  const vehicleDisplay = localizeTripViewText(formatVehicleNumber(bill.vehicleNo), language);
  const driverDisplay = localizeTripViewText(bill.driverName || "—", language);
  const bunkDisplay = localizeTripViewText(bill.petrolBunk || "—", language);

  const statusLabel = isDeleted
    ? t("common.deleted")
    : isApproved
    ? isTrip
      ? t("ops.fuel.approved_trip_completion")
      : t("common.approved")
    : t("common.pending");

  const statusPillClass = isDeleted
    ? "text-rose-700 bg-rose-50 border-rose-200"
    : isApproved
    ? "text-emerald-700 bg-emerald-50 border-emerald-200"
    : "text-orange-700 bg-orange-50 border-orange-200";

  const statusIcon = isDeleted ? (
    <AlertCircle size={13} className="text-rose-600" />
  ) : isApproved ? (
    <CheckCircle2 size={13} className="text-emerald-600" />
  ) : (
    <Clock size={13} className="text-orange-500" />
  );

  // Left column records
  const leftDetails: [string, React.ReactNode][] = [
    [t("ops.fuel.bill_no"), <span className="font-mono font-bold text-slate-800">{bill.billNo}</span>],
    [t("common.date"), formatTripListDay(bill.date, language)],
    [t("common.vehicle"), <span className="font-semibold text-slate-800">{vehicleDisplay}</span>],
    [t("common.driver"), driverDisplay],
    [
      t("ops.fuel.source"),
      <span className="inline-flex items-center gap-1 font-semibold">
        {isTrip ? t("ops.fuel.trip_diesel") : t("ops.fuel.manual_bill")}
      </span>,
    ],
    [
      t("ops.fuel.source_linked_trip"),
      bill.tripNo ? <TripNoBadge tripNo={bill.tripNo} /> : <span className="text-slate-400">—</span>,
    ],
  ];

  // Right column records
  const rightDetails: [string, React.ReactNode][] = [
    [
      t("ops.fuel.odometer_meter"),
      bill.meterReading > 0 ? (
        <span className="tabular-nums font-bold text-slate-800">{bill.meterReading.toLocaleString("en-IN")} KM</span>
      ) : (
        <span className="text-slate-400">{t("ops.fuel.not_recorded")}</span>
      ),
    ],
    [
      t("ops.fuel.litres"),
      <span className="tabular-nums font-bold text-blue-600">{bill.litres.toFixed(2)} L</span>,
    ],
    [
      t("ops.fuel.rate_per_l"),
      <span className="tabular-nums font-bold text-slate-700">₹ {bill.rate.toFixed(2)}</span>,
    ],
    [
      t("ops.fuel.total_cost"),
      <span className="tabular-nums font-extrabold text-emerald-600 text-[14px]">₹ {bill.amount.toFixed(2)}</span>,
    ],
    [
      t("ops.fuel.petrol_bunk"),
      <span className="font-medium text-slate-800">{bunkDisplay}</span>,
    ],
    [
      t("ops.fuel.petrol_bunk_location"),
      bill.gpsLat != null && bill.gpsLon != null ? (
        <GpsAddressText
          lat={bill.gpsLat}
          lon={bill.gpsLon}
          className="text-xs text-emerald-600 font-semibold"
          maxLines={1}
        />
      ) : (
        <span className="text-slate-400">{t("ops.fuel.gps_not_captured")}</span>
      ),
    ],
  ];

  return (
    <AppShellModal open={isOpen} onClose={onClose} panelClassName="max-w-4xl" ariaLabelledBy="fuel-view-title">
      <div className="flex max-h-[calc(100vh-96px)] flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xl animate-scale-in">
        
        {/* ── Header — Identity + Status Pill + Language Toggle + Close ── */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-gradient-to-r from-emerald-50/70 via-white to-emerald-50/60 px-6 py-4">
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-emerald-100 bg-emerald-50/90 text-emerald-600 shadow-inner">
              <Fuel className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 id="fuel-view-title" className="truncate text-base md:text-lg font-bold tracking-tight text-slate-800">
                  {t("ops.fuel.bill_details", { billNo: bill.billNo })}
                </h2>
                <span className="inline-flex items-center rounded-full bg-slate-100 border border-slate-200 px-2.5 py-0.5 text-[10px] font-bold text-slate-600">
                  {isTrip ? t("ops.fuel.trip_auto_approved") : t("ops.fuel.manual_bill")}
                </span>
              </div>
              <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 mt-0.5">
                <Truck size={13} className="flex-shrink-0 text-slate-400" />
                <span>{vehicleDisplay}</span>
                <span className="text-slate-300">·</span>
                <User size={13} className="flex-shrink-0 text-slate-400" />
                <span>{driverDisplay}</span>
              </p>
            </div>
          </div>

          <div className="flex flex-shrink-0 items-center gap-2.5 ml-auto">
            {/* Status Pill */}
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold shadow-xs ${statusPillClass}`}>
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

        {/* ── Scrollable Body Content ── */}
        <div className="overflow-y-auto p-6 md:p-7 space-y-5 bg-slate-50/40 flex-1">
          
          {/* Top Key Metrics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-xs">
              <div className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                {t("ops.fuel.total_fuel_cost")}
              </div>
              <div className="text-lg sm:text-xl font-extrabold text-emerald-600 tabular-nums">
                ₹ {bill.amount.toFixed(2)}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-xs">
              <div className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                {t("ops.fuel.litres_filled")}
              </div>
              <div className="text-lg sm:text-xl font-bold text-slate-800 tabular-nums">
                {bill.litres.toFixed(2)} <span className="text-xs font-semibold text-slate-500">L</span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-xs">
              <div className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                {t("ops.fuel.rate_litre")}
              </div>
              <div className="text-lg sm:text-xl font-bold text-slate-800 tabular-nums">
                ₹ {bill.rate.toFixed(2)}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-xs">
              <div className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                {t("ops.fuel.odometer_reading")}
              </div>
              <div className="text-lg sm:text-xl font-bold text-slate-800 tabular-nums">
                {bill.meterReading > 0 ? `${bill.meterReading.toLocaleString("en-IN")}` : "—"}{" "}
                <span className="text-xs font-semibold text-slate-500">KM</span>
              </div>
            </div>
          </div>

          {/* 2-Column Clean Structured Description List (matching Maintenance & Trip View) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Left Card */}
            <dl className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
              {leftDetails.map(([label, value], index) => (
                <div
                  key={index}
                  className={`flex items-start justify-between gap-4 px-4 py-2.5 ${
                    index > 0 ? "border-t border-slate-100" : ""
                  } hover:bg-slate-50/60 transition-colors`}
                >
                  <dt className="w-32 flex-shrink-0 text-[11px] font-bold uppercase tracking-wider text-slate-400 pt-0.5">
                    {label}
                  </dt>
                  <dd className="min-w-0 flex-1 break-words text-right text-[12.5px] font-medium text-slate-800">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>

            {/* Right Card */}
            <dl className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
              {rightDetails.map(([label, value], index) => (
                <div
                  key={index}
                  className={`flex items-start justify-between gap-4 px-4 py-2.5 ${
                    index > 0 ? "border-t border-slate-100" : ""
                  } hover:bg-slate-50/60 transition-colors`}
                >
                  <dt className="w-32 flex-shrink-0 text-[11px] font-bold uppercase tracking-wider text-slate-400 pt-0.5">
                    {label}
                  </dt>
                  <dd className="min-w-0 flex-1 break-words text-right text-[12.5px] font-medium text-slate-800">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Total Cost Highlight Band */}
          <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200/80 bg-gradient-to-r from-emerald-50/90 via-white to-emerald-50/60 px-5 py-3 shadow-xs">
            <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-800">
              <IndianRupee size={16} className="flex-shrink-0 text-emerald-600" />
              {t("ops.fuel.total_fuel_cost")}
            </span>
            <span className="text-xl font-extrabold tabular-nums text-emerald-700">
              ₹ {bill.amount.toFixed(2)}
            </span>
          </div>

          {/* Receipt Document Viewer Card */}
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
              {bill.image ? (
                <div className="flex items-center gap-2.5">
                  <img
                    src={bill.image}
                    alt="Receipt thumbnail"
                    className="h-10 w-10 object-cover rounded-lg border border-slate-200 bg-slate-50"
                  />
                  <BillPreviewLink
                    href={bill.image}
                    fileName={bill.imageName || `${bill.billNo}.png`}
                  />
                </div>
              ) : (
                <span className="text-xs text-slate-400 font-medium italic">
                  {t("ops.fuel.not_uploaded")}
                </span>
              )}
            </div>
          </div>

          {/* Remarks Callout (if any) */}
          {bill.remarks && (
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
              <div className="flex items-start gap-2.5">
                <MessageSquare size={16} className="text-emerald-600 mt-0.5 flex-shrink-0" />
                <div className="min-w-0">
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    {t("ops.fuel.remarks_operator_notes")}
                  </div>
                  <p className="text-xs sm:text-sm text-slate-700 font-medium leading-relaxed">
                    {localizeTripViewText(bill.remarks, language)}
                  </p>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* ── Footer — PDF Export & Close ── */}
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
