// src/modules/accounts/components/farm-payment/FarmPaymentTripViewModal.tsx
//
// The Farm Payment trip view — the SAME big view shell the Trip List uses
// (AppShellModal: global view size, perfectly centred, header/sidebar gaps),
// restricted to EXACTLY the two steps a payment reviewer needs:
//   • Step 2 (Farm Details)   — the REAL locked StepFarm view from the Trip
//     List trip history: same KPI cards, GPS address block, fonts and layout.
//   • Step 3 (Pickup Details) — the REAL locked StepPickup view: pickup KPI
//     cards, DC photo card with zoom, the box table and its own
//     Download Image + Pickup (box) PDF actions.
//
// Header, language toggle, PDF download, close motions and footer are all
// byte-identical to the Trip List's TripViewModal treatment.

import React, { useMemo, useState } from 'react';
import {
  FileText,
  FileDown,
  ShieldCheck,
  UserCheck,
  MapPin,
  Package,
  X,
} from 'lucide-react';
import AppShellModal from '../../../../ui/AppShellModal';
import type { Trip } from '../../../operations/vehicle-trips/types/trip';
import StepFarm from '../../../operations/vehicle-trips/components/StepFarm';
import StepPickup from '../../../operations/vehicle-trips/components/StepPickup';
import { generateTripReportPDF } from '../../../operations/vehicle-trips/utils/generateTripPDF';
import { localizeTripForView } from '../../../operations/vehicle-trips/utils/tripViewLocalization';
import { uiActionIconMotionClass } from '../../../../shared/ui/uiTokens';
import { ScopedI18nProvider, useI18n } from '../../../../i18n';
import { ActionTooltip } from '../../../../ui/ActionTooltip';
import { ViewLanguageToggle } from '../../../../ui/ViewLanguageToggle';

interface FarmPaymentTripViewModalProps {
  open: boolean;
  trip: Trip | null;
  onClose: () => void;
}

const STEP_OPTIONS = [
  { index: 1, icon: MapPin, key: 'farm' }, // Step 2 — Farm Details
  { index: 2, icon: Package, key: 'pickup' }, // Step 3 — Pickup Details
] as const;

/** No-op helpers so the locked step components stay read-only. */
const noop = () => {};
const noopFalse = () => false;

/** Read-only Step 2 — the SAME locked StepFarm the Trip List view embeds. */
function FarmStepLockedView({ trip }: { trip: Trip }) {
  const viewTrip: Trip = { ...trip, farmStepSubmitted: true };
  return (
    <StepFarm
      trip={viewTrip}
      setTrip={noop as React.Dispatch<React.SetStateAction<Trip>>}
      updateTrip={noop}
      submitFarmStep={noopFalse} hideWizardClose hideLockedChip
      farms={[]}
      birdTypes={[]}
      editable={false}
      canEdit={false}
      clearForm={noop}
    />
  );
}

/** Read-only Step 3 — the SAME locked StepPickup the Trip List view embeds:
 *  DC photo card, box table and its Download Image + Pickup PDF actions. */
function PickupStepLockedView({ trip }: { trip: Trip }) {
  const viewTrip: Trip = { ...trip, pickupStepSubmitted: true };
  return (
    <StepPickup
      trip={viewTrip}
      setTrip={noop as React.Dispatch<React.SetStateAction<Trip>>}
      updateTrip={noop}
      updateBoxDetails={noop}
      submitPickupStep={noopFalse} hideWizardClose hideLockedChip
      editable={false}
      canEdit={false}
      clearForm={noop}
    />
  );
}

function FarmPaymentTripView({ open, trip, onClose }: FarmPaymentTripViewModalProps) {
  const { t, language, toggleLanguage } = useI18n();
  // Opens on Step 2 (Farm Details) — the payment reviewer's primary step.
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedLoad, setSelectedLoad] = useState(1);
  const [lastTripId, setLastTripId] = useState<number | null>(trip?.id ?? null);
  const [pdfDownloading, setPdfDownloading] = useState(false);
  const displayTrip = useMemo(() => (trip ? localizeTripForView(trip, language) : null), [trip, language]);

  // A new trip always reopens on Step 2 (render-phase derived-state reset).
  if (trip && trip.id !== lastTripId) {
    setLastTripId(trip.id);
    setStep(1);
    setSelectedLoad(1);
  }

  if (!open || !trip) return null;
  // Localize prose (farm, addresses, timestamps) but keep the identifiers —
  // trip number and vehicle number — in their stored Latin/numeric form in
  // every language: they are codes, never transliterated.
  const baseViewTrip = displayTrip
    ? { ...displayTrip, tripNo: trip.tripNo, vehicleNo: trip.vehicleNo }
    : trip;
  const availableLoads = (trip.legs ?? [])
    .filter((leg) => leg.farmStepSubmitted || leg.pickupStepSubmitted)
    .sort((a, b) => a.legIndex - b.legIndex);
  const activeLoad = availableLoads.find((leg) => leg.legIndex === selectedLoad) ?? availableLoads[0];
  const viewTrip: Trip = activeLoad
    ? {
        ...baseViewTrip,
        activeLegIndex: activeLoad.legIndex,
        sourceFarmId: activeLoad.sourceFarmId ?? baseViewTrip.sourceFarmId,
        sourceFarm: activeLoad.sourceFarm ?? baseViewTrip.sourceFarm,
        reachedTime: activeLoad.reachedTime ?? baseViewTrip.reachedTime,
        destMeter: activeLoad.destMeter ?? baseViewTrip.destMeter,
        pickupTolls: activeLoad.pickupTolls ?? baseViewTrip.pickupTolls,
        farmAddress: activeLoad.farmAddress ?? baseViewTrip.farmAddress,
        avgBirdWeight: activeLoad.avgBirdWeight ?? baseViewTrip.avgBirdWeight,
        birdTypeId: activeLoad.farmBirdTypeId ?? baseViewTrip.birdTypeId,
        birdType: activeLoad.farmBirdType ?? baseViewTrip.birdType,
        totalBirds: activeLoad.totalBirds,
        dcWeight: activeLoad.dcWeight,
        boxes: activeLoad.boxes,
        avgWeight: activeLoad.avgWeight,
        pickupLoadTime: activeLoad.pickupLoadTime ?? baseViewTrip.pickupLoadTime,
        pickupStepSubmitted: activeLoad.pickupStepSubmitted,
        pickupStepSubmittedAt: activeLoad.pickupStepSubmittedAt,
        farmStepSubmitted: activeLoad.farmStepSubmitted,
        farmStepSubmittedAt: activeLoad.farmStepSubmittedAt,
        boxDetails: activeLoad.boxDetails ?? [],
        deliveries: activeLoad.deliveries ?? [],
      }
    : baseViewTrip;

  const stepLabel = (index: 1 | 2) =>
    `${t('ops.trip.step_label', { step: index + 1 })} · ${t(`ops.trip.step.${STEP_OPTIONS[index - 1].key}`)}`;

  // One download per click: jsPDF generation is heavy; a re-entrancy guard
  // prevents double-clicks from producing duplicate PDF files.
  const downloadTripReport = async () => {
    if (pdfDownloading) return;
    setPdfDownloading(true);
    try {
      await generateTripReportPDF(trip, null);
    } finally {
      setPdfDownloading(false);
    }
  };

  return (
    <AppShellModal open={open} onClose={onClose} panelClassName="bg-white">
      <div className="bg-white w-full h-full overflow-hidden flex flex-col rounded-2xl">
        {/* ─── Header — the Trip List view header ─────────────────────── */}
        <div className="border-b border-slate-100 bg-gradient-to-r from-emerald-50/80 via-white to-emerald-50/80 rounded-t-2xl">
          <div className="px-6 md:px-8 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0 flex-1 sm:flex-none">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-400/20 text-white shrink-0">
                <FileText className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <h2 className="text-lg md:text-xl font-bold text-slate-800 tracking-tight truncate">
                  {viewTrip.tripNo || t('ops.trip.trip_details')}
                </h2>
                <div className="flex items-center gap-2 flex-wrap mt-1.5">
                  {trip.status === 'Completed' && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500 text-white px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider shrink-0">
                      <ShieldCheck size={11} /> {t('ops.trip.submitted_locked')}
                    </span>
                  )}
                  <span className="text-xs font-medium text-slate-400">{t('ops.trip.read_only_overview')}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap justify-end shrink-0 w-full sm:w-auto">
              {viewTrip.approvedBy && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 border border-slate-200 shadow-sm shrink-0">
                  <UserCheck size={12} className="text-emerald-500" />
                  {t('ops.trip.approved_by')}: {viewTrip.approvedBy}
                </span>
              )}
              <ViewLanguageToggle
                language={language}
                onToggle={toggleLanguage}
                tone="emerald"
                labelMode="target"
                ariaLabel={t('ops.trip.popup_language_toggle')}
                tooltip={<ActionTooltip label={t('ops.trip.popup_language_tooltip')} side="bottom" />}
              />
              <button
                type="button"
                onClick={() => void downloadTripReport()}
                disabled={pdfDownloading}
                className="group relative inline-flex items-center justify-center rounded-xl border border-red-100 bg-red-50/70 hover:bg-red-50/80 p-2 text-red-500 shadow-sm transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
                title={t('ops.trip.create_pdf_title')}
                aria-label={t('ops.trip.create_pdf')}
              >
                <span className={`inline-flex ${uiActionIconMotionClass.pdf}`}>
                  <FileDown size={16} className={pdfDownloading ? 'animate-pulse' : ''} />
                </span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="group relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition-all hover:-translate-y-0.5 hover:border-red-100 hover:bg-red-50 hover:text-red-500 active:scale-95"
                aria-label={t('ops.trip.close_view')}
              >
                <span className={`inline-flex ${uiActionIconMotionClass.close}`}>
                  <X size={16} />
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* ─── Body — same paddings/scroll as the Trip List view ────────── */}
        <div className="py-6 md:py-8 px-4 md:px-8 overflow-y-auto space-y-5 flex-1">
          {/* Trip identity strip — the trip number travels with the step detail */}
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 rounded-xl border border-slate-100 bg-slate-50/70 px-4 py-2.5 text-xs">
            <span className="font-bold tracking-tight text-slate-800">{viewTrip.tripNo}</span>
            <span className="text-slate-300">·</span>
            <span className="font-medium text-slate-500">{viewTrip.tripDate}</span>
            {viewTrip.vehicleNo ? (
              <>
                <span className="text-slate-300">·</span>
                <span className="font-medium text-slate-500">{viewTrip.vehicleNo}</span>
              </>
            ) : null}
            {viewTrip.sourceFarm ? (
              <>
                <span className="text-slate-300">·</span>
                <span className="font-medium text-slate-500">{viewTrip.sourceFarm}</span>
              </>
            ) : null}
            <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-white border border-slate-200 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-indigo-600">
              {stepLabel(step)}
            </span>
          </div>

          {/* Step 2 / Step 3 switcher — the only steps available here */}
          {availableLoads.length > 1 && (
            <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-1.5">
              <span className="px-2 text-[10px] font-bold uppercase tracking-wider text-emerald-700">Load</span>
              {availableLoads.map((load) => (
                <button
                  key={load.id}
                  type="button"
                  onClick={() => setSelectedLoad(load.legIndex)}
                  className={`rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                    activeLoad?.legIndex === load.legIndex
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-white text-slate-600 border border-slate-200 hover:border-emerald-300'
                  }`}
                >
                  Load {load.legIndex}
                  <span className="ml-2 opacity-75">{load.totalBirds.toLocaleString()} birds · {load.dcWeight.toFixed(2)} kg</span>
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50/70 p-1.5 w-full sm:w-auto sm:self-start">
            {STEP_OPTIONS.map(({ index, icon: Icon, key }) => {
              const active = step === index;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setStep(index)}
                  className={`flex flex-1 sm:flex-none items-center justify-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all ${
                    active
                      ? 'bg-white text-indigo-700 shadow-sm border border-indigo-100'
                      : 'text-slate-500 hover:text-slate-700 hover:bg-white/60'
                  }`}
                  aria-pressed={active}
                >
                  <Icon size={14} />
                  {t(`ops.trip.step.${key}`)}
                </button>
              );
            })}
          </div>

          {/* Only the selected step's own detail — the REAL locked Trip Entry
              step components the Trip List view embeds, so layout, fonts, DC
              photos, Download Image and the Pickup (box) PDF are identical. */}
          <div key={`${trip.id}-step-${step}`} className="animate-fade-in-up">
            {step === 1 ? (
              <FarmStepLockedView trip={viewTrip} />
            ) : (
              <PickupStepLockedView trip={viewTrip} />
            )}
          </div>
        </div>

        {/* ─── Footer — the Trip List view footer ───────────────────────── */}
        <div className="px-6 md:px-8 py-5 border-t border-slate-100 bg-gradient-to-r from-slate-50/80 via-white to-slate-50/80 flex items-center justify-end gap-3 rounded-b-2xl">
          <button
            type="button"
            onClick={onClose}
            className="group relative inline-flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-all active:scale-95"
            aria-label={t('ops.trip.close_view')}
          >
            <span className={`inline-flex ${uiActionIconMotionClass.close}`}>
              <X size={15} />
            </span>
            {t('common.close')}
          </button>
        </div>
      </div>
    </AppShellModal>
  );
}

/** The view keeps its own language scope — toggling inside it never flips the
 *  page underneath (the Trip List view's exact contract). */
export function FarmPaymentTripViewModal(props: FarmPaymentTripViewModalProps) {
  const { language } = useI18n();
  if (!props.open || !props.trip) return null;
  return (
    <ScopedI18nProvider initialLanguage={language}>
      <FarmPaymentTripView {...props} />
    </ScopedI18nProvider>
  );
}

export default FarmPaymentTripViewModal;
