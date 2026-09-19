// src/modules/operations/vehicle-trips/components/TripViewModal.tsx
// Shared read-only Trip View shell. Recent and History use dedicated wrappers.
// Steps 1–5 embed the same locked Trip Entry components (shared fonts/layout).
// Email/WhatsApp bulk actions are enabled only by the Trip History wrapper.
// Now uses AppShellModal for neat gaps from header/sidebar/page edges.

import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  FileText,
  Mail,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Loader2,
  UserCheck,
  FileDown,
  X,
} from "lucide-react";
import AppShellModal from "../../../../ui/AppShellModal";
import { WhatsAppIcon } from "../../../../ui/WhatsAppIcon";
import type { Trip, ShopDelivery } from "../types/trip";
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
import { localizeBirdTypesForView, localizeShopsForView, localizeTripForView, localizeTripViewText } from "../utils/tripViewLocalization";
import { uiActionIconMotionClass } from "../../../../shared/ui/uiTokens";
import { ScopedI18nProvider, useI18n } from "../../../../i18n";
import { ActionTooltip } from "../../../../ui/ActionTooltip";
import { ViewLanguageToggle } from "../../../../ui/ViewLanguageToggle";
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
  /** Optional in-view navigation supplied only by Account Analysis. */
  analysisNavigation?: React.ReactNode;
  /** Delivery communication state belongs to Trip History, not Recent Activity. */
  showCommunicationStatus?: boolean;
}

type CommunicationFeedback = {
  id: number;
  channel: "mail" | "whatsapp";
  type: "success" | "error";
  shopName: string;
  message: string;
  count?: number;
};

/** No-op helpers so locked step components stay read-only in Recent view. */
const noop = () => {};
const noopAsyncFalse = async () => false;
const noopFalse = () => false;

/**
 * Recent / Trip List step views embed the SAME locked step components as Trip Entry
 * so layout + fonts match exactly (shared StepKpiCard typography).
 */
function Step1View({ trip, onClose }: { trip: Trip; onClose: () => void }) {
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
      onCancel={onClose}
      clearForm={onClose}
      subscribeHeaderSaveStatus={() => noop}
      getHeaderSaveStatus={() => "idle"}
    />
  );
}

function Step2View({ trip, birdTypes, onClose }: { trip: Trip; birdTypes: BirdType[]; onClose: () => void }) {
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
      onCancel={onClose}
      clearForm={onClose}
    />
  );
}

function Step3View({ trip, onClose }: { trip: Trip; onClose: () => void }) {
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
      onCancel={onClose}
      clearForm={onClose}
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
  onSendOneEmail,
  onSendOneWhatsApp,
  onClose,
}: {
  trip: Trip;
  shops: Shop[];
  birdTypes: BirdType[];
  showCommunicationStatus: boolean;
  emailState: ReturnType<typeof useTripDeliveryEmails>;
  whatsappState: ReturnType<typeof useTripDeliveryWhatsApps>;
  onSendOneEmail: (delivery: ShopDelivery) => void;
  onSendOneWhatsApp: (delivery: ShopDelivery) => void;
  onClose: () => void;
}) {
  const { t, language } = useI18n();
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
      clearForm={onClose}
      onCancel={onClose}
      canEdit={false}
      editable={false}
      boxDetails={trip.boxDetails || []}
      persistedDeliveries={deliveries}
      showCommunicationStatus={showCommunicationStatus}
      emailEffectiveStatus={emailState.effectiveStatus}
      emailBusyIds={emailState.busyIds}
      emailIsBulkSending={emailState.isBulkSending}
      emailSendCountFor={emailState.sendCountFor}
      emailFailureReasonFor={(deliveryId) => {
        const reason = emailState.failureReasonFor(deliveryId);
        return language === "te" && reason ? t("ops.trip.unable_send_email") : reason;
      }}
      onSendOneEmail={onSendOneEmail}
      whatsappEffectiveStatus={whatsappState.effectiveStatus}
      whatsappBusyIds={whatsappState.busyIds}
      whatsappIsBulkSending={whatsappState.isBulkSending}
      whatsappSendCountFor={whatsappState.sendCountFor}
      whatsappFailureReasonFor={(deliveryId) => {
        const reason = whatsappState.failureReasonFor(deliveryId);
        return language === "te" && reason ? t("ops.trip.unable_send_whatsapp") : reason;
      }}
      onSendOneWhatsApp={onSendOneWhatsApp}
    />
  );
}

function Step5View({ trip, onClose }: { trip: Trip; onClose: () => void }) {
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
      clearForm={onClose}
      onCancel={onClose}
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
  analysisNavigation,
  showCommunicationStatus = true,
}: Props) {
  const { t, language, toggleLanguage } = useI18n();
  const initialViewStep = (trip: Trip | null) => {
    if (initialStep != null) return initialStep;
    return trip && trip.status === "Completed" && isTripWizardComplete(trip) ? 3 : 0;
  };
  const [viewStepIndex, setViewStepIndex] = useState(() => initialViewStep(trip));
  const [lastTripId, setLastTripId] = useState<number | null>(trip?.id ?? null);
  const displayTrip = useMemo(() => (trip ? localizeTripForView(trip, language) : null), [trip, language]);
  const displayShops = useMemo(() => localizeShopsForView(shops, language), [shops, language]);
  const displayBirdTypes = useMemo(() => localizeBirdTypesForView(birdTypes, language), [birdTypes, language]);
  const localizedStepLabels = useMemo(
    () => [
      t("ops.trip.step.start"),
      t("ops.trip.step.farm"),
      t("ops.trip.step.pickup"),
      t("ops.trip.step.deliveries"),
      t("ops.trip.step.expenses"),
    ],
    [t]
  );

  if (trip && trip.id !== lastTripId) {
    setLastTripId(trip.id);
    setViewStepIndex(initialViewStep(trip));
  }

  const emailState = useTripDeliveryEmails(trip, shops, { enabled: showCommunicationStatus });
  const whatsappState = useTripDeliveryWhatsApps(trip, shops, { enabled: showCommunicationStatus });
  const [communicationFeedback, setCommunicationFeedback] = useState<CommunicationFeedback | null>(null);

  useEffect(() => {
    if (!communicationFeedback) return;
    const timeoutId = window.setTimeout(() => setCommunicationFeedback(null), 5000);
    return () => window.clearTimeout(timeoutId);
  }, [communicationFeedback]);

  if (!open || !trip) return null;

  const viewTrip = displayTrip ?? trip;
  const statusKey = `status.${String(trip.status || "pending").toLowerCase().replace(/\s+/g, "_")}`;
  const translatedStatus = t(statusKey);
  const viewStatus = language === "te" && translatedStatus !== statusKey ? translatedStatus : trip.status;
  const isCompleted = trip.status === "Completed" && isTripWizardComplete(trip);

  const isStartCompleted = Boolean(trip.startStepSubmitted);
  const isDeliveryCompleted = Boolean(trip.deliveryStepSubmitted);
  const isEndCompleted = isTripWizardComplete(trip);
  const completedMask = getTripWizardCompletedMask(trip);
  const maxAllowedViewStep = isTripWizardComplete(trip) ? 4 : getNextIncompleteTripStep(trip);
  const lockedSteps = TRIP_STEP_LABELS.map((_, index) => index > maxAllowedViewStep);
  const safeViewStepIndex = Math.min(Math.max(0, viewStepIndex), maxAllowedViewStep);

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

  const showFeedback = (next: Omit<CommunicationFeedback, "id">) => {
    setCommunicationFeedback({ ...next, id: Date.now() });
  };

  const handleSendOneEmail = async (delivery: ShopDelivery) => {
    const sourceDelivery = trip.deliveries?.find((item) => item.id === delivery.id) ?? delivery;
    const result = await emailState.sendOne(sourceDelivery);
    const fallbackMessage = result.status === "sending" ? t("ops.trip.sending_email") : t("ops.trip.unable_send_email");
    showFeedback({
      channel: "mail",
      type: result.success ? "success" : "error",
      shopName: localizeTripViewText(sourceDelivery.shopName, language, { cleanShopCode: true }) || t("ops.trip.shops"),
      message: result.success ? t("ops.trip.email_sent_toast") : language === "te" ? fallbackMessage : result.message,
      count: result.sendCount,
    });
  };

  const handleSendOneWhatsApp = async (delivery: ShopDelivery) => {
    const sourceDelivery = trip.deliveries?.find((item) => item.id === delivery.id) ?? delivery;
    const result = await whatsappState.sendOne(sourceDelivery);
    const fallbackMessage = result.status === "sending" ? t("ops.trip.sending_whatsapp") : t("ops.trip.unable_send_whatsapp");
    showFeedback({
      channel: "whatsapp",
      type: result.success ? "success" : "error",
      shopName: localizeTripViewText(sourceDelivery.shopName, language, { cleanShopCode: true }) || t("ops.trip.shops"),
      message: result.success ? t("ops.trip.whatsapp_sent_toast") : language === "te" ? fallbackMessage : result.message,
      count: result.sendCount,
    });
  };

  const emptyStep = (
    <div className="mt-8 text-center p-12 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 text-sm">
      {t("ops.trip.select_completed_step")}
    </div>
  );

  const renderStepContent = () => {
    switch (safeViewStepIndex) {
      case 0:
        return isStartCompleted ? <Step1View trip={viewTrip} onClose={onClose} /> : emptyStep;
      case 1:
        return trip.farmStepSubmitted ? (
          <Step2View trip={viewTrip} birdTypes={displayBirdTypes} onClose={onClose} />
        ) : (
          emptyStep
        );
      case 2:
        return trip.pickupStepSubmitted ? <Step3View trip={viewTrip} onClose={onClose} /> : emptyStep;
      case 3:
        return isDeliveryCompleted ? (
          <Step4View
            trip={viewTrip}
            shops={displayShops}
            birdTypes={displayBirdTypes}
            showCommunicationStatus={showCommunicationStatus}
            emailState={emailState}
            whatsappState={whatsappState}
            onSendOneEmail={handleSendOneEmail}
            onSendOneWhatsApp={handleSendOneWhatsApp}
            onClose={onClose}
          />
        ) : (
          emptyStep
        );
      case 4:
        return isEndCompleted ? <Step5View trip={viewTrip} onClose={onClose} /> : emptyStep;
      default:
        return null;
    }
  };

  const emailCounts = emailState.counts;
  const whatsappCounts = whatsappState.counts;

  return (
    <>
      <AppShellModal open={open} onClose={onClose} panelClassName="bg-white">
        <div className="bg-white w-full h-full overflow-hidden flex flex-col rounded-2xl">
          {analysisNavigation}
          {/* Header — rounded top */}
          <div className="border-b border-slate-100 bg-gradient-to-r from-emerald-50/80 via-white to-emerald-50/80 rounded-t-2xl">
            <div className="px-6 md:px-8 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-4 min-w-0 flex-1 sm:flex-none">
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-400/20 text-white shrink-0">
                  <FileText className="w-6 h-6" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                    <h2 className="text-lg md:text-xl font-bold text-slate-800 tracking-tight truncate">
                      {viewTrip.tripNo || t("ops.trip.trip_details")}
                    </h2>
                    <span className="hidden sm:inline-flex items-center rounded-full bg-slate-100 border border-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-500">
                      Shell gaps • {language === "te" ? "తెలుగు" : "EN"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap mt-1.5">
                    {isCompleted ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500 text-white px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider shrink-0">
                        <ShieldCheck size={11} /> {t("ops.trip.submitted_locked")}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50/80 text-amber-500 border border-amber-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider shrink-0">
                        {viewStatus || t("status.pending")}
                      </span>
                    )}
                    <span className="text-xs font-medium text-slate-400">{t("ops.trip.read_only_overview")}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap justify-end shrink-0 w-full sm:w-auto">
                {isCompleted && viewTrip.approvedBy && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 border border-slate-200 shadow-sm shrink-0">
                    <UserCheck size={12} className="text-emerald-500" />
                    {t("ops.trip.approved_by")}: {viewTrip.approvedBy}
                  </span>
                )}
                <ViewLanguageToggle
                  language={language}
                  onToggle={toggleLanguage}
                  tone="emerald"
                  labelMode="target"
                  ariaLabel={t("ops.trip.popup_language_toggle")}
                  tooltip={<ActionTooltip label={t("ops.trip.popup_language_tooltip")} side="bottom" />}
                />
                <button
                  type="button"
                  onClick={onClose}
                  className="group relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition-all hover:-translate-y-0.5 hover:border-red-100 hover:bg-red-50 hover:text-red-500 active:scale-95"
                  aria-label={t("ops.trip.close_view")}
                >
                  <span className={`inline-flex ${uiActionIconMotionClass.close}`}>
                    <X size={16} />
                  </span>
                </button>
              </div>
            </div>

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
                      className="group relative inline-flex items-center gap-2.5 rounded-xl border border-red-100 bg-red-50/90 hover:bg-red-100 px-4 py-2 text-xs font-semibold text-red-600 shadow-sm shadow-red-100/60 transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
                      aria-label={t("ops.trip.send_email_all")}
                    >
                      {emailState.isBulkSending ? <Loader2 size={14} className="animate-spin" /> : <span className={`inline-flex ${uiActionIconMotionClass.mail}`}><Mail size={14} /></span>}
                      {emailState.isBulkSending ? `${t("ops.trip.sending")}...` : t("ops.trip.send_all_email")}
                    </button>
                  )}
                  {showCommunicationStatus && whatsappCounts.total > 0 && (
                    <button
                      type="button"
                      onClick={() => void whatsappState.sendAll()}
                      disabled={whatsappState.isBulkSending}
                      className="group relative inline-flex items-center gap-2.5 rounded-xl border border-[#25D366]/25 bg-[#25D366]/10 hover:bg-[#25D366]/15 px-4 py-2 text-xs font-semibold text-[#128C7E] shadow-sm shadow-[#25D366]/10 transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
                      aria-label={t("ops.trip.send_whatsapp_all")}
                    >
                      {whatsappState.isBulkSending ? <Loader2 size={14} className="animate-spin" /> : <span className={`inline-flex ${uiActionIconMotionClass.whatsapp}`}><WhatsAppIcon size={14} /></span>}
                      {whatsappState.isBulkSending ? `${t("ops.trip.sending")}...` : t("ops.trip.send_all_whatsapp")}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void downloadTripReport()}
                    className="group relative inline-flex items-center justify-center rounded-xl border border-red-100 bg-red-50/70 hover:bg-red-50/80 p-2 text-red-500 shadow-sm transition-all active:scale-95"
                    aria-label={t("ops.trip.create_pdf")}
                  >
                    <span className={`inline-flex ${uiActionIconMotionClass.pdf}`}><FileDown size={16} /></span>
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="py-6 md:py-8 px-4 md:px-8 overflow-y-auto space-y-5 flex-1">
            <TripWizardStepper
              steps={localizedStepLabels}
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
            <TripFinalKPI trip={viewTrip} deliveries={viewTrip.deliveries} />
          </div>

          <div className="px-6 md:px-8 py-5 border-t border-slate-100 bg-gradient-to-r from-slate-50/80 via-white to-slate-50/80 flex items-center justify-end gap-3 rounded-b-2xl">
            <button
              type="button"
              onClick={onClose}
              className="group relative inline-flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-all active:scale-95"
              aria-label={t("ops.trip.close_view")}
            >
              <span className={`inline-flex ${uiActionIconMotionClass.close}`}>
                <X size={15} />
              </span>
              {t("common.close")}
            </button>
          </div>
        </div>
      </AppShellModal>

      {communicationFeedback &&
        createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 pointer-events-none">
            <style>{`@keyframes trip-communication-feedback-timer { from { transform: scaleX(1); } to { transform: scaleX(0); } }`}</style>
            <div
              key={communicationFeedback.id}
              className={`w-full max-w-sm overflow-hidden rounded-3xl border bg-white shadow-2xl animate-fade-in pointer-events-auto ${
                communicationFeedback.type === "success" ? "border-emerald-100" : "border-red-100"
              }`}
              role={communicationFeedback.type === "success" ? "status" : "alert"}
              aria-live="polite"
            >
              <div className="p-5 text-center">
                <div
                  className={`mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full ${
                    communicationFeedback.type === "success"
                      ? communicationFeedback.channel === "whatsapp"
                        ? "bg-[#25D366]/10 text-[#25D366]"
                        : "bg-emerald-50 text-emerald-500"
                      : "bg-red-50 text-red-500"
                  }`}
                >
                  {communicationFeedback.type === "success" ? (
                    communicationFeedback.channel === "whatsapp" ? <WhatsAppIcon size={22} /> : <CheckCircle2 size={22} />
                  ) : (
                    <AlertCircle size={22} />
                  )}
                </div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  {communicationFeedback.channel === "whatsapp" ? t("ops.trip.whatsapp") : t("ops.trip.email")}
                </p>
                <p className="mt-1 text-sm font-bold text-slate-800">{communicationFeedback.message}</p>
                <p className="mt-1 text-xs font-medium text-slate-500 truncate">
                  {communicationFeedback.shopName}
                </p>
                {communicationFeedback.type === "success" && communicationFeedback.count ? (
                  <p className="mt-2 text-xs font-semibold text-emerald-600">
                    {t("common.sent")} · {communicationFeedback.count}
                  </p>
                ) : null}
                <p className="mt-3 text-[10px] font-semibold text-slate-400">{t("ops.trip.closes_in_seconds", { seconds: 5 })}</p>
              </div>
              <div className="h-1 bg-slate-100">
                <div
                  className={`h-full origin-left ${
                    communicationFeedback.type === "success"
                      ? communicationFeedback.channel === "whatsapp"
                        ? "bg-[#25D366]"
                        : "bg-emerald-500"
                      : "bg-red-500"
                  }`}
                  style={{ animation: "trip-communication-feedback-timer 5s linear forwards" }}
                />
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

function ScopedTripViewModal(props: Props) {
  const { language } = useI18n();
  return (
    <ScopedI18nProvider initialLanguage={language}>
      <TripViewModal {...props} />
    </ScopedI18nProvider>
  );
}

export function RecentTripViewModal(props: Props) {
  return <ScopedTripViewModal {...props} showCommunicationStatus={false} />;
}

export function TripHistoryViewModal(props: Props) {
  return <ScopedTripViewModal {...props} showCommunicationStatus />;
}

export default React.memo(TripHistoryViewModal);
