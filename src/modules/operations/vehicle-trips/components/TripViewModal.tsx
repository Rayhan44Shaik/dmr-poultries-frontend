// src/modules/operations/vehicle-trips/components/TripViewModal.tsx
// Shared read-only Trip View shell. Recent and History use dedicated wrappers.
// Steps 1–5 embed the same locked Trip Entry components (shared fonts/layout).
// Email/WhatsApp bulk actions are enabled only by the Trip History wrapper.

import React, { useState } from "react";
import {
  FileText,
  Mail,
  ShieldCheck,
  AlertCircle,
  Loader2,
  UserCheck,
  FileDown,
} from "lucide-react";
import { WhatsAppIcon } from "../../../../ui/WhatsAppIcon";
import type { Trip } from "../types/trip";
import type { Shop } from "../../../masters/shops/types/shop";
import type { BirdType } from "../../../masters/bird-types/types/birdType";
import {
  getTripWizardCompletedMask,
  isTripWizardComplete,
  TRIP_STEP_LABELS,
  getNextIncompleteTripStep,
} from "../../../../shared/trip";
import { generateTripReportPDF, type TripReportEmailInfo } from "../utils/generateTripPDF";
import { useTripDeliveryEmails } from "../hooks/useTripDeliveryEmails";
import { useTripDeliveryWhatsApps } from "../hooks/useTripDeliveryWhatsApps";
import { cleanDeliveryShopName } from "../utils/shopDisplayName";
import { useI18n } from "../../../../i18n";
import StepStart from "./StepStart";
import StepFarm from "./StepFarm";
import StepPickup from "./StepPickup";
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
  /** Delivery communication state belongs to Trip History, not Recent Activity. */
  showCommunicationStatus?: boolean;
}

/** No-op helpers so locked step components stay read-only in Recent view. */
const noop = () => {};
const noopAsyncFalse = async () => false;
const noopFalse = () => false;

/**
 * Recent / Trip List step views embed the SAME locked step components as Trip Entry
 * so layout + fonts match exactly (shared StepKpiCard typography).
 */
function Step1View({ trip }: { trip: Trip }) {
  const viewTrip: Trip = { ...trip, startStepSubmitted: true };
  return (
    <StepStart
      tripId={trip.id}
      tripNo={trip.tripNo}
      startTime={trip.startTime || ""}
      startStepSubmitted
      loadSnapshot={viewTrip}
      updateTrip={noop}
      submitStartStep={noopAsyncFalse}
      vehicleOptions={[]}
      employeeOptions={[]}
      editable={false}
      canEdit={false}
      clearForm={noop}
      subscribeHeaderSaveStatus={() => noop}
      getHeaderSaveStatus={() => "idle"}
    />
  );
}

function Step2View({ trip, birdTypes }: { trip: Trip; birdTypes: BirdType[] }) {
  const viewTrip: Trip = { ...trip, farmStepSubmitted: true };
  return (
    <StepFarm
      trip={viewTrip}
      setTrip={noop as React.Dispatch<React.SetStateAction<Trip>>}
      updateTrip={noop}
      submitFarmStep={noopFalse}
      farms={[]}
      birdTypes={birdTypes}
      editable={false}
      canEdit={false}
      clearForm={noop}
    />
  );
}

function Step3View({ trip }: { trip: Trip }) {
  const viewTrip: Trip = { ...trip, pickupStepSubmitted: true };
  return (
    <StepPickup
      trip={viewTrip}
      setTrip={noop as React.Dispatch<React.SetStateAction<Trip>>}
      updateTrip={noop}
      updateBoxDetails={noop}
      submitPickupStep={noopFalse}
      editable={false}
      canEdit={false}
      clearForm={noop}
    />
  );
}

function Step4View({
  trip,
  shops,
  birdTypes,
  showCommunicationStatus,
  emailState,
  whatsappState,
}: {
  trip: Trip;
  shops: Shop[];
  birdTypes: BirdType[];
  showCommunicationStatus: boolean;
  emailState: ReturnType<typeof useTripDeliveryEmails>;
  whatsappState: ReturnType<typeof useTripDeliveryWhatsApps>;
}) {
  const viewTrip: Trip = { ...trip, deliveryStepSubmitted: true };
  const deliveries = Array.isArray(trip.deliveries) ? trip.deliveries : [];
  return (
    <StepDeliveries
      rows={deliveries}
      setRows={noop as React.Dispatch<React.SetStateAction<typeof deliveries>>}
      shops={shops}
      birdTypes={birdTypes}
      trip={viewTrip}
      updateDeliveries={noop}
      submitDeliveriesStep={noopFalse}
      clearForm={noop}
      canEdit={false}
      editable={false}
      boxDetails={trip.boxDetails || []}
      persistedDeliveries={deliveries}
      showCommunicationStatus={showCommunicationStatus}
      emailEffectiveStatus={emailState.effectiveStatus}
      emailBusyIds={emailState.busyIds}
      emailIsBulkSending={emailState.isBulkSending}
      emailSendCountFor={emailState.sendCountFor}
      emailFailureReasonFor={emailState.failureReasonFor}
      onSendOneEmail={(delivery) => void emailState.sendOne(delivery)}
      whatsappEffectiveStatus={whatsappState.effectiveStatus}
      whatsappBusyIds={whatsappState.busyIds}
      whatsappIsBulkSending={whatsappState.isBulkSending}
      whatsappSendCountFor={whatsappState.sendCountFor}
      whatsappFailureReasonFor={whatsappState.failureReasonFor}
      onSendOneWhatsApp={(delivery) => void whatsappState.sendOne(delivery)}
    />
  );
}


function Step5View({ trip }: { trip: Trip }) {
  const viewTrip: Trip = {
    ...trip,
    expensesStepSubmitted: true,
    endStepSubmitted: true,
  };
  return (
    <StepEnd
      trip={viewTrip}
      updateTrip={noop}
      canEdit={false}
      editable={false}
      clearForm={noop}
      onCancel={noop}
    />
  );
}



function TripViewModal({
  open,
  trip,
  onClose,
  shops,
  birdTypes,
  initialStep,
  showCommunicationStatus = true,
}: Props) {
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

  const emailState = useTripDeliveryEmails(trip, shops, { enabled: showCommunicationStatus });
  const whatsappState = useTripDeliveryWhatsApps(trip, shops, { enabled: showCommunicationStatus });

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
              shopName: cleanDeliveryShopName(delivery.shopName) || delivery.shopName,
              status: emailState.effectiveStatus(delivery.id),
            })),
          }
        : null;
    await generateTripReportPDF(trip, emailInfo);
  };

  const firstEmailFailure = showCommunicationStatus
    ? (trip.deliveries || []).reduce<string | null>((message, delivery) => {
        if (message) return message;
        const reason = emailState.failureReasonFor(delivery.id);
        if (!reason) return null;
        const shopName = cleanDeliveryShopName(delivery.shopName) || delivery.shopName || t("ops.trip.shops");
        return `${shopName}: ${reason}`;
      }, null)
    : null;

  const firstWhatsAppFailure = showCommunicationStatus
    ? (trip.deliveries || []).reduce<string | null>((message, delivery) => {
        if (message) return message;
        const reason = whatsappState.failureReasonFor(delivery.id);
        if (!reason) return null;
        const shopName = cleanDeliveryShopName(delivery.shopName) || delivery.shopName || t("ops.trip.shops");
        return `${shopName}: ${reason}`;
      }, null)
    : null;

  /** Each step embeds the locked Trip Entry component (same layout + fonts). */
  const emptyStep = (
    <div className="mt-8 text-center p-12 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 text-sm">
      {t("ops.trip.select_completed_step")}
    </div>
  );

  const renderStepContent = () => {
    switch (safeViewStepIndex) {
      case 0:
        return isStartCompleted ? <Step1View trip={trip} /> : emptyStep;
      case 1:
        return trip.farmStepSubmitted
          ? <Step2View trip={trip} birdTypes={birdTypes} />
          : emptyStep;
      case 2:
        return trip.pickupStepSubmitted ? <Step3View trip={trip} /> : emptyStep;
      case 3:
        return isDeliveryCompleted
          ? (
              <Step4View
                trip={trip}
                shops={shops}
                birdTypes={birdTypes}
                showCommunicationStatus={showCommunicationStatus}
                emailState={emailState}
                whatsappState={whatsappState}
              />
            )
          : emptyStep;
      case 4:
        return isEndCompleted ? <Step5View trip={trip} /> : emptyStep;
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
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-400/20 text-white shrink-0">
                <FileText className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap min-w-0">
                  <h2 className="text-lg md:text-xl font-bold text-slate-800 tracking-tight truncate">
                    {trip.tripNo || t("ops.trip.trip_details")}
                  </h2>
                  {firstEmailFailure && (
                    <span className="inline-flex max-w-full sm:max-w-[360px] items-center gap-1 rounded-full border border-red-100 bg-red-50/90 px-2.5 py-0.5 text-[10px] font-semibold text-red-600" title={firstEmailFailure} role="alert">
                      <AlertCircle size={11} className="shrink-0" />
                      <span className="truncate">{t("ops.trip.email")}: {firstEmailFailure}</span>
                    </span>
                  )}
                  {firstWhatsAppFailure && (
                    <span className="inline-flex max-w-full sm:max-w-[360px] items-center gap-1 rounded-full border border-red-100 bg-red-50/90 px-2.5 py-0.5 text-[10px] font-semibold text-red-600" title={firstWhatsAppFailure} role="alert">
                      <AlertCircle size={11} className="shrink-0" />
                      <span className="truncate">{t("ops.trip.whatsapp")}: {firstWhatsAppFailure}</span>
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-wrap mt-1.5">
                  {isCompleted ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500 text-white px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider shrink-0">
                      <ShieldCheck size={11} /> {t("ops.trip.submitted_locked")}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50/80 text-amber-500 border border-amber-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider shrink-0">
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
                  <UserCheck size={12} className="text-emerald-500" />
                  {t("ops.trip.approved_by")}: {trip.approvedBy}
                </span>
              )}
            </div>
          </div>

          {/* Bottom row: Email/WhatsApp counts + Actions */}
          {isCompleted && (
            <div className="px-6 md:px-8 pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-slate-100/50">
              <div className="flex items-center gap-3 flex-wrap">
                {showCommunicationStatus && emailCounts.total > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-red-100 bg-red-50/80 px-2.5 py-1 text-xs font-medium text-red-600" role="status" aria-live="polite">
                    <Mail size={12} className="text-red-500" />
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
                {showCommunicationStatus && whatsappCounts.total > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-[#25D366]/25 bg-[#25D366]/10 px-2.5 py-1 text-xs font-medium text-[#128C7E]" role="status" aria-live="polite">
                    <WhatsAppIcon size={12} className="text-[#25D366]" />
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

              <div className="flex items-center gap-3 flex-wrap justify-end shrink-0">
                {showCommunicationStatus && emailCounts.total > 0 && (
                  <button
                    type="button"
                    onClick={() => void emailState.sendAll()}
                    disabled={emailState.isBulkSending}
                    className="inline-flex items-center gap-2.5 rounded-xl border border-red-100 bg-red-50/90 hover:bg-red-100 px-4 py-2 text-xs font-semibold text-red-600 shadow-sm shadow-red-100/60 transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
                    title={t("ops.trip.send_email_all")}
                  >
                    {emailState.isBulkSending ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Mail size={14} />
                    )}
                    {emailState.isBulkSending ? `${t("ops.trip.sending")}...` : t("ops.trip.send_all_email")}
                  </button>
                )}
                {showCommunicationStatus && whatsappCounts.total > 0 && (
                  <button
                    type="button"
                    onClick={() => void whatsappState.sendAll()}
                    disabled={whatsappState.isBulkSending}
                    className="inline-flex items-center gap-2.5 rounded-xl border border-[#25D366] bg-[#25D366] hover:bg-[#1ebe5d] px-4 py-2 text-xs font-semibold text-white shadow-md shadow-[#25D366]/25 transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
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
                  className="inline-flex items-center justify-center rounded-xl border border-red-100 bg-red-50/70 hover:bg-red-50/80 p-2 text-red-500 shadow-sm transition-all active:scale-95"
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

/** Recent Activity view: read-only Trip steps without communication counters. */
export function RecentTripViewModal(props: Props) {
  return <TripViewModal {...props} showCommunicationStatus={false} />;
}

/** Trip History/List view: includes email and WhatsApp delivery counters/actions. */
export function TripHistoryViewModal(props: Props) {
  return <TripViewModal {...props} showCommunicationStatus />;
}

export default React.memo(TripHistoryViewModal);
