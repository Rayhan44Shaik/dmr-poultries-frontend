// src/modules/operations/vehicle-trips/components/TripViewModal.tsx
// Read-only Trip View. Never reuses editable Step wizard controls.
// Completed trips are reviewed through the 5-step wizard — each step shows
// ONLY its own persisted data. Incomplete trips keep the existing read-only
// step presentation. Email status (Send All Mail → Total / Sent / Failed)
// is per-shop and stays visible after the batch finishes.

import React, { useState } from "react";
import {
  FileText,
  Mail,
  ShieldCheck,
  Send,
  Loader2,
  Clock,
  UserCheck,
  Receipt,
  FileDown,
  Calendar,
  Truck,
  User,
  Gauge,
  Ticket,
  Wallet,
  Users,
  Package,
  MapPin,
  Fuel,
} from "lucide-react";
import { WhatsAppIcon } from "../../../../ui/WhatsAppIcon";
import type { Trip, ShopDelivery } from "../types/trip";
import type { Shop } from "../../../masters/shops/types/shop";
import type { BirdType } from "../../../masters/bird-types/types/birdType";
import {
  getTripWizardCompletedMask,
  isTripWizardComplete,
  TRIP_STEP_LABELS,
  TRIP_STEP_KEYS,
} from "../../../../shared/trip";
import { generateShopPDF } from "../utils/generateShopPDF";
import { generateTripReportPDF, type TripReportEmailInfo } from "../utils/generateTripPDF";
import { useTripDeliveryEmails } from "../hooks/useTripDeliveryEmails";
import { useTripDeliveryWhatsApps } from "../hooks/useTripDeliveryWhatsApps";
import TripViewShopCards from "./TripViewShopCards";
import { FarmStepView, PickupStepView } from "./TripStepViews";
import { StepKpiCard } from "./WizardControls";
import { getNextIncompleteTripStep } from "../../../../shared/trip";
import { useI18n } from "../../../../i18n";

import TripWizardStepper from "./TripWizardStepper";
import TripFinalKPI from "./TripFinalKPI";

interface Props {
  open: boolean;
  trip: Trip | null;
  onClose: () => void;
  shops: Shop[];
  birdTypes: BirdType[];
  /** Step index (0-based) the modal opens on. Defaults to Step 4 for
   * completed trips / Step 1 otherwise. Farm Payment passes 1 (Step 2 —
   * Farm details) because the farm is what a payment reviewer needs first. */
  initialStep?: number;
}

/** Read-only Step 1 (Trip Start) details — same "Farm Details" format. */
function Step1View({ trip }: { trip: Trip }) {
  const { t } = useI18n();
  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3 shadow-sm">
      <h3 className="text-base sm:text-lg font-bold text-slate-800 flex items-center gap-2 tracking-tight">
        <Clock size={18} className="text-indigo-600" />
        {t("ops.trip.title.start")}
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <StepKpiCard
          icon={Calendar}
          tone="bg-blue-50 text-blue-600"
          label={t("ops.trip.field.trip_date")}
          value={trip.tripDate || "—"}
        />
        <StepKpiCard
          icon={Clock}
          tone="bg-sky-50 text-sky-600"
          label={t("ops.trip.field.start_time")}
          value={trip.startTime || "—"}
        />
        <StepKpiCard
          icon={Truck}
          tone="bg-emerald-50 text-emerald-600"
          label={t("common.vehicle")}
          value={trip.vehicleNo || "—"}
        />
        <StepKpiCard
          icon={UserCheck}
          tone="bg-violet-50 text-violet-600"
          label={t("common.supervisor")}
          value={trip.supervisorName || "—"}
        />
        <StepKpiCard
          icon={User}
          tone="bg-indigo-50 text-indigo-600"
          label={t("common.driver")}
          value={trip.driverName || "—"}
        />
        <StepKpiCard
          icon={Gauge}
          tone="bg-purple-50 text-purple-600"
          label={t("ops.trip.field.opening_meter")}
          value={trip.openingMeter != null ? `${trip.openingMeter} KM` : t("ops.trip.not_entered")}
        />
        <StepKpiCard
          icon={Wallet}
          tone="bg-amber-50 text-amber-600"
          label={t("operations.advance")}
          value={trip.advanceAmount != null ? `₹ ${trip.advanceAmount.toLocaleString()}` : t("ops.trip.not_entered")}
        />
        <StepKpiCard
          icon={Users}
          tone="bg-teal-50 text-teal-600"
          label={t("ops.trip.field.helpers")}
          value={trip.helpers?.join(", ") || "—"}
        />
        <StepKpiCard
          icon={Package}
          tone="bg-cyan-50 text-cyan-600"
          label={t("ops.trip.field.loaders")}
          value={trip.loaders?.join(", ") || "—"}
        />
        <StepKpiCard
          icon={ShieldCheck}
          tone="bg-rose-50 text-rose-600"
          label={t("common.status")}
          value={trip.startStepSubmitted ? t("ops.trip.submitted") : t("ops.trip.not_submitted")}
        />
      </div>
    </section>
  );
}

/** Read-only Step 5 (End / Expenses / Diesel) details. */
function Step5View({ trip }: { trip: Trip }) {
  const { t } = useI18n();
  const totalKm =
    trip.totalKm != null && Number.isFinite(Number(trip.totalKm))
      ? Number(trip.totalKm)
      : Number(trip.closingMeter || 0) - Number(trip.openingMeter || 0);

  const submittedDiesel = Array.isArray(trip.dieselEntries)
    ? trip.dieselEntries.filter((e) => e.submitted !== false)
    : [];
  const totalDieselLitres = submittedDiesel.reduce((acc, e) => acc + Number(e.litres || 0), 0);
  const totalDieselAmount = submittedDiesel.reduce((acc, e) => acc + Number(e.amount || 0), 0);

  const expensePairs: Array<[string, number]> = [
    [t("ops.trip.exp_meals"), Number(trip.meals || 0)],
    [t("ops.trip.exp_loading"), Number(trip.loading || 0)],
    [t("ops.trip.exp_meals_tiffin"), Number(trip.mealsTiffin || 0)],
    [t("ops.trip.exp_vehicle_maintenance"), Number(trip.vehicleMaintenance || 0)],
    [t("ops.trip.exp_tea"), Number(trip.othersRC || 0)],
    [t("ops.trip.exp_driver"), Number(trip.others1Amt || 0)],
    [t("ops.trip.exp_supervisor"), Number(trip.others2Amt || 0)],
    [t("ops.trip.exp_helper_loader"), Number(trip.others3Amt || 0)],
    [t("common.other"), Number(trip.others4Amt || 0)],
    [t("common.other"), Number(trip.others5Amt || 0)],
  ];
  const positiveExpenses = expensePairs.filter(([, amt]) => amt > 0);
  const totalExpenses = positiveExpenses.reduce((acc, [, amt]) => acc + amt, 0);

  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3 shadow-sm">
      <h3 className="text-base sm:text-lg font-bold text-slate-800 flex items-center gap-2 tracking-tight">
        <Receipt size={18} className="text-orange-600" />
        {t("ops.trip.title.expenses")}
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <StepKpiCard
          icon={Gauge}
          tone="bg-purple-50 text-purple-600"
          label={t("ops.trip.field.end_meter")}
          value={trip.closingMeter != null ? `${trip.closingMeter} KM` : t("ops.trip.not_entered")}
        />
        <StepKpiCard
          icon={Ticket}
          tone="bg-amber-50 text-amber-600"
          label={t("ops.trip.delivery_tolls")}
          value={trip.deliveryTolls != null ? String(trip.deliveryTolls) : t("ops.trip.not_entered")}
        />
        <StepKpiCard
          icon={MapPin}
          tone="bg-cyan-50 text-cyan-600"
          label={t("ops.trip.total_distance")}
          value={`${Math.max(0, totalKm)} KM`}
        />
        <StepKpiCard
          icon={Fuel}
          tone="bg-teal-50 text-teal-600"
          label={t("ops.trip.mileage")}
          value={
            trip.mileageKmL != null && Number.isFinite(Number(trip.mileageKmL))
              ? `${Number(trip.mileageKmL).toFixed(2)} km/L`
              : t("ops.trip.not_available")
          }
        />
        <StepKpiCard
          icon={Receipt}
          tone="bg-rose-50 text-rose-600"
          label={t("operations.total_expenses")}
          value={`₹ ${totalExpenses.toFixed(2)}`}
        />
        <StepKpiCard
          icon={Fuel}
          tone="bg-orange-50 text-orange-600"
          label={t("ops.trip.total_diesel")}
          value={`${totalDieselLitres} Ltrs · ₹ ${totalDieselAmount.toFixed(2)}`}
        />
        <StepKpiCard
          icon={ShieldCheck}
          tone="bg-indigo-50 text-indigo-600"
          label={t("common.status")}
          value={isTripWizardComplete(trip) ? t("ops.trip.submitted") : t("ops.trip.not_submitted")}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">{t("operations.general_expenses")}</h4>
          {positiveExpenses.length ? (
            <div className="rounded-xl border border-slate-200/70 overflow-hidden">
              <table className="w-full text-xs">
                <tbody className="divide-y divide-slate-100">
                  {positiveExpenses.map(([label, amt]) => (
                    <tr key={label} className="hover:bg-slate-50/60">
                      <td className="px-3 py-2 text-slate-600">{label}</td>
                      <td className="px-3 py-2 text-right font-semibold text-slate-800 tabular-nums">₹ {amt.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-slate-400">{t("ops.trip.no_expenses_recorded")}</p>
          )}
        </div>
        <div>
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">{t("ops.trip.diesel_fuel")}</h4>
          {submittedDiesel.length ? (
            <div className="overflow-x-auto rounded-xl border border-slate-200/70">
              <table className="w-full text-xs">
                <thead className="bg-slate-50/80">
                  <tr>
                    {[t("table.s_no"), t("ops.trip.litres"), t("common.rate"), t("table.amount"), t("ops.trip.meter"), t("ops.trip.bunk")].map((h) => (
                      <th key={h} className="px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {submittedDiesel.map((e, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/60">
                      <td className="px-3 py-2 text-slate-500">{idx + 1}</td>
                      <td className="px-3 py-2 text-slate-700 tabular-nums">{String(e.litres ?? "")}</td>
                      <td className="px-3 py-2 text-slate-700 tabular-nums">{String(e.rate ?? "")}</td>
                      <td className="px-3 py-2 text-slate-700 tabular-nums">₹ {Number(e.amount ?? 0).toFixed(2)}</td>
                      <td className="px-3 py-2 text-slate-700">{String(e.meter ?? "--")}</td>
                      <td className="px-3 py-2 text-slate-700">{String(e.bunkName || "--")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-slate-400">{t("ops.trip.no_diesel_entries")}</p>
          )}
        </div>
      </div>
    </section>
  );
}



function TripViewModal({ open, trip, onClose, shops, initialStep }: Props) {
  const { t } = useI18n();
  // Completed trips open on Step 4 (Shop Deliveries); incomplete on Step 1.
  // A caller-provided initialStep wins (e.g. Farm Payment opens Step 2).
  const initialViewStep = (trip: Trip | null) => {
    if (initialStep != null) return initialStep;
    return trip && trip.status === "Completed" && isTripWizardComplete(trip) ? 3 : 0;
  };
  const [viewStepIndex, setViewStepIndex] = useState(() => initialViewStep(trip));
  const [lastTripId, setLastTripId] = useState<number | null>(trip?.id ?? null);

  // Reset the selected step when a different trip is opened (render-phase
  // adjustment — the official "adjust state when props change" pattern).
  if (trip && trip.id !== lastTripId) {
    setLastTripId(trip.id);
    setViewStepIndex(initialViewStep(trip));
  }

  const emailState = useTripDeliveryEmails(trip, shops);
  const whatsappState = useTripDeliveryWhatsApps(trip, shops);

  // ─── Early return – ensures trip is never null after this ─────
  if (!open || !trip) return null;

  const isCompleted = trip.status === "Completed" && isTripWizardComplete(trip);

  // ─── STEP STATE FLAGS (backend submitted flags only) ───
  const isStartCompleted = Boolean(trip.startStepSubmitted);
  const isDeliveryCompleted = Boolean(trip.deliveryStepSubmitted);
  const isEndCompleted = isTripWizardComplete(trip);
  const completedMask = getTripWizardCompletedMask(trip);
  // Read-only view: future steps on an incomplete trip stay locked; a completed
  // trip can review every step.
  const maxAllowedViewStep = isTripWizardComplete(trip)
    ? 4
    : getNextIncompleteTripStep(trip);
  const lockedSteps = TRIP_STEP_LABELS.map((_, index) => index > maxAllowedViewStep);
  const safeViewStepIndex = Math.min(Math.max(0, viewStepIndex), maxAllowedViewStep);

  const downloadShopPDF = async (delivery: ShopDelivery) => {
    await generateShopPDF(
      delivery,
      trip.boxDetails || [],
      trip.tripNo,
      trip.vehicleNo,
      trip.supervisorName,
      undefined,
      trip.tripDate,
      undefined,
      undefined,
      delivery.autoCaptureTime,
      trip.driverName
    );
  };

  // ─── Create PDF — professional A4 portrait trip report ────────────
  const downloadTripReport = async () => {
    const emailInfo: TripReportEmailInfo | null =
      emailCounts.total > 0
        ? {
            total: emailCounts.total,
            sent: emailCounts.sent,
            failed: emailCounts.failed,
            pending: emailCounts.pending,
            byShop: (trip.deliveries || []).map((delivery) => ({
              shopName: delivery.shopName,
              status: emailState.effectiveStatus(delivery.id),
            })),
          }
        : null;
    await generateTripReportPDF(trip, emailInfo);
  };

  /**
   * Every step (complete or incomplete) uses the same plain "Farm Details"
   * style: icon + title-case label, KPI cards — never the numbered
   * "1 TRIP DETAILS" wizard header. Steps that have not been submitted yet
   * show a gentle empty-state instead of the editable form.
   */
  const renderStepContent = () => {
    switch (safeViewStepIndex) {
      case 0:
        return isStartCompleted
          ? <Step1View trip={trip} />
          : <div className="mt-8 text-center p-12 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 text-sm">{t("ops.trip.select_completed_step")}</div>;
      case 1:
        return <FarmStepView trip={trip} />;
      case 2:
        return trip.pickupStepSubmitted
          ? <PickupStepView trip={trip} />
          : <div className="mt-8 text-center p-12 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 text-sm">{t("ops.trip.select_completed_step")}</div>;
      case 3:
        if (!isDeliveryCompleted) {
          return <div className="mt-8 text-center p-12 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 text-sm">{t("ops.trip.select_completed_step")}</div>;
        }
        // Completed trips get the email/WhatsApp shop cards; incomplete keep
        // the same shop cards without bulk-send chrome when counts are zero.
        return (
          <TripViewShopCards
            trip={trip}
            shops={shops}
            effectiveStatus={emailState.effectiveStatus}
            busyIds={emailState.busyIds}
            isBulkSending={emailState.isBulkSending}
            bulkProgress={emailState.bulkProgress}
            shopEmailFor={emailState.shopEmailFor}
            sendCountFor={emailState.sendCountFor}
            onSendOne={(delivery) => void emailState.sendOne(delivery)}
            onDownloadPdf={(delivery) => void downloadShopPDF(delivery)}
            emailCounts={emailCounts}
            whatsappEffectiveStatus={whatsappState.effectiveStatus}
            whatsappBusyIds={whatsappState.busyIds}
            whatsappIsBulkSending={whatsappState.isBulkSending}
            shopWhatsAppFor={whatsappState.shopWhatsAppFor}
            whatsappSendCountFor={whatsappState.sendCountFor}
            onSendOneWhatsApp={(delivery) => void whatsappState.sendOne(delivery)}
            whatsappCounts={whatsappCounts}
          />
        );
      case 4:
        return isEndCompleted
          ? <Step5View trip={trip} />
          : <div className="mt-8 text-center p-12 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 text-sm">{t("ops.trip.select_completed_step")}</div>;
      default:
        return null;
    }
  };

  const emailCounts = emailState.counts;
  const whatsappCounts = whatsappState.counts;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 overflow-y-auto animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-7xl max-h-[92vh] overflow-hidden flex flex-col">
        {/* ─── Header ─────────────────────────────────────────────── */}
        <div className="border-b border-slate-100 bg-gradient-to-r from-emerald-50/80 via-white to-emerald-50/80">
          {/* Top row: Trip identity + status */}
          <div className="px-6 md:px-8 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0 flex-1 sm:flex-none">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20 text-white shrink-0">
                <FileText className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <h2 className="text-lg md:text-xl font-bold text-slate-800 tracking-tight truncate">
                  {trip.tripNo || t("ops.trip.trip_details")}
                </h2>
                <div className="flex items-center gap-2 flex-wrap mt-1.5">
                  {isCompleted ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 text-white px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider shrink-0">
                      <ShieldCheck size={11} /> {t("ops.trip.submitted_locked")}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-700 border border-amber-200 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider shrink-0">
                      {trip.status || t("status.pending")}
                    </span>
                  )}
                  <span className="text-xs font-medium text-slate-400">{t("ops.trip.read_only_overview")}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap justify-end shrink-0 w-full sm:w-auto">
              {isCompleted && trip.approvedBy && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 border border-slate-200 shadow-sm shrink-0">
                  <UserCheck size={12} className="text-emerald-600" />
                  {t("ops.trip.approved_by")}: {trip.approvedBy}
                </span>
              )}
            </div>
          </div>

          {/* Bottom row: Email/WhatsApp counts + Actions */}
          {isCompleted && (
            <div className="px-6 md:px-8 pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-slate-100/50">
              <div className="flex items-center gap-3 flex-wrap">
                {emailCounts.total > 0 && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-sky-700" role="status" aria-live="polite">
                    <Mail size={12} className="text-sky-600" />
                    {emailState.isBulkSending ? (
                      <>
                        {t("ops.trip.sending")}... {emailState.bulkProgress?.sent ?? emailCounts.sent} / {emailState.bulkProgress?.total ?? emailCounts.total}
                      </>
                    ) : (
                      <>
                        {emailCounts.total} {t("ops.trip.shops").toLowerCase()} · {emailCounts.sent} {t("common.sent").toLowerCase()}
                        {emailCounts.pending > 0 ? ` · ${emailCounts.pending} ${t("common.pending").toLowerCase()}` : ""}
                        {emailCounts.failed > 0 ? ` · ${emailCounts.failed} ${t("common.failed").toLowerCase()}` : ""}
                      </>
                    )}
                  </span>
                )}
                {whatsappCounts.total > 0 && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-700" role="status" aria-live="polite">
                    <WhatsAppIcon size={12} className="text-green-600" />
                    {whatsappState.isBulkSending ? (
                      <>
                        {t("ops.trip.sending")}... {whatsappState.bulkProgress?.sent ?? whatsappCounts.sent} / {whatsappState.bulkProgress?.total ?? whatsappCounts.total}
                      </>
                    ) : (
                      <>
                        {whatsappCounts.total} {t("ops.trip.shops").toLowerCase()} · {whatsappCounts.sent} {t("common.sent").toLowerCase()}
                        {whatsappCounts.pending > 0 ? ` · ${whatsappCounts.pending} ${t("common.pending").toLowerCase()}` : ""}
                        {whatsappCounts.failed > 0 ? ` · ${whatsappCounts.failed} ${t("common.failed").toLowerCase()}` : ""}
                      </>
                    )}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 flex-wrap justify-end shrink-0">
                {emailCounts.total > 0 && (
                  <button
                    type="button"
                    onClick={() => void emailState.sendAll()}
                    disabled={emailState.isBulkSending}
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-emerald-500/20 transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
                    title={t("ops.trip.send_email_all")}
                  >
                    {emailState.isBulkSending ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Send size={14} />
                    )}
                    {emailState.isBulkSending ? `${t("ops.trip.sending")}...` : t("ops.trip.send_all_email")}
                  </button>
                )}
                {whatsappCounts.total > 0 && (
                  <button
                    type="button"
                    onClick={() => void whatsappState.sendAll()}
                    disabled={whatsappState.isBulkSending}
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-green-500/20 transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
                    title={t("ops.trip.send_whatsapp_all")}
                  >
                    {whatsappState.isBulkSending ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <WhatsAppIcon size={14} />
                    )}
                    {whatsappState.isBulkSending ? `${t("ops.trip.sending")}...` : t("ops.trip.send_all_whatsapp")}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void downloadTripReport()}
                  className="inline-flex items-center justify-center rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 p-2 text-red-700 shadow-sm transition-all active:scale-95"
                  title={t("ops.trip.create_pdf_title")}
                  aria-label={t("ops.trip.create_pdf")}
                >
                  <FileDown size={16} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ─── Body ─────────────────────────────────────────────────── */}
        <div className="py-6 md:py-8 px-4 md:px-8 overflow-y-auto space-y-5 flex-1">
          {/* Trip identity strip — the trip number travels with every step view */}
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 rounded-xl border border-slate-100 bg-slate-50/70 px-4 py-2.5 text-xs">
            <span className="font-bold tracking-tight text-slate-800">{trip.tripNo}</span>
            <span className="text-slate-300">·</span>
            <span className="font-medium text-slate-500">{trip.tripDate}</span>
            {trip.vehicleNo ? (
              <>
                <span className="text-slate-300">·</span>
                <span className="font-medium text-slate-500">{trip.vehicleNo}</span>
              </>
            ) : null}
            {trip.sourceFarm ? (
              <>
                <span className="text-slate-300">·</span>
                <span className="font-medium text-slate-500">{trip.sourceFarm}</span>
              </>
            ) : null}
            <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-white border border-slate-200 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-indigo-600">
              {t("ops.trip.step_label", { step: safeViewStepIndex + 1 })} · {t(`ops.trip.step.${TRIP_STEP_KEYS[safeViewStepIndex]}`)}
            </span>
          </div>
          <TripWizardStepper
            steps={TRIP_STEP_LABELS}
            currentStep={safeViewStepIndex}
            completedMask={completedMask}
            lockedSteps={lockedSteps}
            onStepClick={setViewStepIndex}
            onLockedStepClick={() => {
              if (!isTripWizardComplete(trip)) {
                setViewStepIndex(maxAllowedViewStep);
              }
            }}
          />
          <div key={`${trip.id}-step-${safeViewStepIndex}`} className="animate-fade-in-up">
            {renderStepContent()}
          </div>
          <TripFinalKPI trip={trip} deliveries={trip.deliveries} />
        </div>

        {/* ─── Footer ───────────────────────────────────────────────── */}
        <div className="px-6 md:px-8 py-5 border-t border-slate-100 bg-gradient-to-r from-slate-50/80 via-white to-slate-50/80 flex items-center justify-end gap-3">
          <button onClick={onClose} className="inline-flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-all active:scale-95">
            {t("common.close")}
          </button>
        </div>
      </div>
    </div>
  );
}

export default React.memo(TripViewModal);