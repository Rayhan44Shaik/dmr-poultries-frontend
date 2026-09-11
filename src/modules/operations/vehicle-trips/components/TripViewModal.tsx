// src/modules/operations/vehicle-trips/components/TripViewModal.tsx
// Read-only Trip View for Recent / Trip List.
// Step 4 uses the same locked StepDeliveries layout as Trip Entry after submit.
// Step 5 uses the same locked StepEnd layout. Email/WhatsApp bulk actions stay
// in the modal header for completed trips.

import React, { useState } from "react";
import {
  FileText,
  Mail,
  ShieldCheck,
  Send,
  Loader2,
  Clock,
  UserCheck,
  FileDown,
  Calendar,
  Truck,
  User,
  Gauge,
  Wallet,
  Users,
  Package,
} from "lucide-react";
import { WhatsAppIcon } from "../../../../ui/WhatsAppIcon";
import type { Trip } from "../types/trip";
import type { Shop } from "../../../masters/shops/types/shop";
import type { BirdType } from "../../../masters/bird-types/types/birdType";
import {
  getTripWizardCompletedMask,
  isTripWizardComplete,
  TRIP_STEP_LABELS,
  TRIP_STEP_KEYS,
} from "../../../../shared/trip";
import { generateTripReportPDF, type TripReportEmailInfo } from "../utils/generateTripPDF";
import { useTripDeliveryEmails } from "../hooks/useTripDeliveryEmails";
import { useTripDeliveryWhatsApps } from "../hooks/useTripDeliveryWhatsApps";
import { FarmStepView, PickupStepView } from "./TripStepViews";
import { StepKpiCard } from "./WizardControls";
import { getNextIncompleteTripStep } from "../../../../shared/trip";
import { useI18n } from "../../../../i18n";
import StepEnd from "./Step_5/StepEnd";
import StepDeliveries from "./StepDeliveries";

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

/**
 * Read-only Step 5 for Recent / Trip List view — same detailed submitted layout
 * as the locked Expenses form (summary boxes, full expense tables, diesel with
 * GPS address + fuel bill image preview). No edit controls.
 */
function Step5View({ trip }: { trip: Trip }) {
  // Force the locked submitted path inside StepEnd (expenses already done).
  const viewTrip: Trip = {
    ...trip,
    expensesStepSubmitted: true,
    endStepSubmitted: true,
  };
  return (
    <StepEnd
      trip={viewTrip}
      updateTrip={() => {}}
      canEdit={false}
      editable={false}
      clearForm={() => {}}
      onCancel={() => {}}
    />
  );
}

/**
 * Read-only Step 4 for Recent / Trip List view — exact same locked submitted
 * layout as Trip Entry Step 4 (KPIs, shop cards, PDF). No edit controls.
 */
function Step4View({
  trip,
  shops,
  birdTypes,
}: {
  trip: Trip;
  shops: Shop[];
  birdTypes: BirdType[];
}) {
  const viewTrip: Trip = {
    ...trip,
    deliveryStepSubmitted: true,
  };
  const deliveries = Array.isArray(trip.deliveries) ? trip.deliveries : [];
  return (
    <StepDeliveries
      rows={deliveries}
      setRows={() => {}}
      shops={shops}
      birdTypes={birdTypes}
      trip={viewTrip}
      updateDeliveries={() => {}}
      submitDeliveriesStep={() => false}
      clearForm={() => {}}
      canEdit={false}
      editable={false}
      boxDetails={trip.boxDetails || []}
      persistedDeliveries={deliveries}
    />
  );
}



function TripViewModal({ open, trip, onClose, shops, birdTypes, initialStep }: Props) {
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
        // Same locked submitted layout as Trip Entry Step 4.
        return <Step4View trip={trip} shops={shops} birdTypes={birdTypes} />;
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