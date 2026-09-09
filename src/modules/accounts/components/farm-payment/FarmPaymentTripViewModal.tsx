// src/modules/accounts/components/farm-payment/FarmPaymentTripViewModal.tsx
//
// SEPARATE trip view for the Farm Payment page. Shows EXACTLY the detail the
// trip's Step 2 and Step 3 hold — nothing else (no wizard stepper, no KPI
// footer):
//   • Step 2 (Farm Details)  — the same shared read-only step view the Trip
//     List trip history uses, including the DC photos gallery with zoom.
//   • Step 3 (Pickup Details) — the REAL read-only StepPickup view from the
//     trip history: pickup KPI cards, DC photo card, the 3-column box table
//     and its own Download Image + Pickup (box) PDF actions.

import { useState, useEffect, useRef } from 'react';
import {
  FileText,
  FileDown,
  ShieldCheck,
  UserCheck,
  MapPin,
  Package,
} from 'lucide-react';
import type { Trip } from '../../../operations/vehicle-trips/types/trip';
import { FarmStepView } from '../../../operations/vehicle-trips/components/TripStepViews';
import StepPickup from '../../../operations/vehicle-trips/components/StepPickup';
import { generateTripReportPDF } from '../../../operations/vehicle-trips/utils/generateTripPDF';
import { useI18n } from '../../../../i18n';

interface FarmPaymentTripViewModalProps {
  open: boolean;
  trip: Trip | null;
  onClose: () => void;
}

const STEP_OPTIONS = [
  { index: 1, icon: MapPin, key: 'farm' }, // Step 2 — Farm Details
  { index: 2, icon: Package, key: 'pickup' }, // Step 3 — Pickup Details
] as const;

/** Separate Farm Payment trip view — Step 2 (Farm) + Step 3 (Pickup) only. */
export function FarmPaymentTripViewModal({ open, trip, onClose }: FarmPaymentTripViewModalProps) {
  const { t } = useI18n();
  // Opens on Step 2 (Farm Details) — the payment reviewer's primary step.
  const [step, setStep] = useState<1 | 2>(1);
  const [pdfDownloading, setPdfDownloading] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  const isOpen = open && Boolean(trip);

  // Dialog behaviour while open: Escape closes, body scrolling is locked,
  // focus lands inside the dialog (announced via its aria-label), and Tab
  // wraps within it. All listeners are cleaned up on close/unmount.
  useEffect(() => {
    if (!isOpen) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      // Simple focus trap: wrap Tab/Shift+Tab inside the dialog.
      const focusables = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (!focusables || focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      } else if (!dialogRef.current?.contains(document.activeElement)) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  // Read-only noops for the real StepPickup view (same pattern as the trip
  // history modal): the locked view only renders persisted trip data.
  const noop = () => {};
  const noopDispatch = () => {};

  if (!isOpen || !trip) return null;

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
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 overflow-y-auto animate-fade-in">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={`${trip.tripNo} — ${t('ops.trip.read_only_overview')}`}
        tabIndex={-1}
        className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-5xl max-h-[92vh] overflow-hidden flex flex-col outline-none"
      >
        {/* ─── Header ─────────────────────────────────────────────── */}
        <div className="border-b border-slate-100 bg-gradient-to-r from-emerald-50/80 via-white to-emerald-50/80 px-6 md:px-8 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0 flex-1">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20 text-white shrink-0">
              <FileText className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg md:text-xl font-bold text-slate-800 tracking-tight truncate">
                {trip.tripNo || t('ops.trip.trip_details')}
              </h2>
              <div className="flex items-center gap-2 flex-wrap mt-1.5">
                {trip.status === 'Completed' && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 text-white px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider shrink-0">
                    <ShieldCheck size={11} /> {t('ops.trip.submitted_locked')}
                  </span>
                )}
                <span className="text-xs font-medium text-slate-400">{t('ops.trip.read_only_overview')}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap justify-end shrink-0">
            {trip.approvedBy && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 border border-slate-200 shadow-sm shrink-0">
                <UserCheck size={12} className="text-emerald-600" />
                {t('ops.trip.approved_by')}: {trip.approvedBy}
              </span>
            )}
            <button
              type="button"
              onClick={() => void downloadTripReport()}
              disabled={pdfDownloading}
              className="inline-flex items-center justify-center rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 p-2 text-red-700 shadow-sm transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
              title={t('ops.trip.create_pdf_title')}
              aria-label={pdfDownloading ? 'Generating PDF…' : t('ops.trip.create_pdf')}
            >
              <FileDown size={16} className={pdfDownloading ? 'animate-pulse' : ''} />
            </button>
          </div>
        </div>

        {/* ─── Body ─────────────────────────────────────────────────── */}
        <div className="py-6 md:py-8 px-4 md:px-8 overflow-y-auto space-y-5 flex-1">
          {/* Trip identity strip — the trip number travels with the step detail */}
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
              {stepLabel(step)}
            </span>
          </div>

          {/* Step 2 / Step 3 switcher — the only steps available here */}
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

          {/* Only the selected step's own detail — no other steps, no KPIs here.
              Step 3 renders the REAL read-only StepPickup view: DC photo card,
              box table and its Download Image + Pickup (box) PDF actions. */}
          <div key={`${trip.id}-step-${step}`} className="animate-fade-in-up">
            {step === 1 ? (
              <FarmStepView trip={trip} />
            ) : (
              <StepPickup
                trip={trip}
                setTrip={noopDispatch}
                updateTrip={noop}
                updateBoxDetails={noop}
                submitPickupStep={() => false}
              />
            )}
          </div>
        </div>

        {/* ─── Footer ───────────────────────────────────────────────── */}
        <div className="px-6 md:px-8 py-5 border-t border-slate-100 bg-gradient-to-r from-slate-50/80 via-white to-slate-50/80 flex items-center justify-end gap-3">
          <button onClick={onClose} className="inline-flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-all active:scale-95">
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default FarmPaymentTripViewModal;
