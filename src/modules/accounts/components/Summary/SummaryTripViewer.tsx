// src/modules/accounts/components/Summary/SummaryTripViewer.tsx
// Fast, stable viewer for "No. of Trips" — shows trips one-by-one with sidebar + side buttons.
// Reuses the exact TripViewModal (trip-history) view so visuals stay identical.
// Same backdrop as trip history (bg-black/40, no blur), deterministic, no duplicate requests.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, X, Truck, Calendar } from 'lucide-react';
import type { Trip } from '../../../operations/vehicle-trips/types/trip';
import TripViewModal from '../../../operations/vehicle-trips/components/TripViewModal';
import { useShops } from '../../../masters/shops/hooks/useShops';
import { useBirdTypes } from '../../../masters/bird-types/hooks/useBirdTypes';

type Props = {
  open: boolean;
  trips: Trip[];
  groupLabel: string;
  onClose: () => void;
};

function SummaryTripViewer({ open, trips, groupLabel, onClose }: Props) {
  const { shops } = useShops();
  const { birdTypes } = useBirdTypes();

  const groupKey = useMemo(() => trips.map((t) => t.id).join(','), [trips]);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (open) setIdx(0);
  }, [open, groupKey]);

  const total = trips.length;
  const canPrev = idx > 0;
  const canNext = idx < total - 1;
  const currentTrip = total > 0 ? trips[idx] : null;

  const goPrev = useCallback(() => setIdx((i) => (i > 0 ? i - 1 : i)), []);
  const goNext = useCallback(() => setIdx((i) => (i < total - 1 ? i + 1 : i)), [total]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && canPrev) {
        e.preventDefault();
        goPrev();
      } else if (e.key === 'ArrowRight' && canNext) {
        e.preventDefault();
        goNext();
      } else if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, canPrev, canNext, goPrev, goNext, onClose]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  if (total === 0 || !currentTrip) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-800">{groupLabel}</h3>
              <p className="text-xs text-slate-500 mt-0.5">No trips in this period</p>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="h-8 w-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition"
            >
              <X size={16} />
            </button>
          </div>
          <div className="px-6 py-10 text-center">
            <p className="text-sm text-slate-500">There are no completed trips for</p>
            <p className="text-sm font-semibold text-slate-700 mt-1">{groupLabel}</p>
            <button
              onClick={onClose}
              className="mt-6 px-5 py-2 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-semibold transition"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Reuse exact trip-history view — same backdrop bg-black/40, no blur */}
      <TripViewModal open={open} trip={currentTrip} shops={shops} birdTypes={birdTypes} onClose={onClose} />

      {total > 1 && (
        <>
          {/* Mobile top bar – horizontal trip switch (visible only on mobile) */}
          <div className="fixed top-0 left-0 right-0 z-[60] bg-white border-b border-slate-200 shadow-md flex sm:hidden items-center gap-2 px-2 py-2 overflow-hidden">
            <button
              type="button"
              onClick={goPrev}
              disabled={!canPrev}
              className={`h-8 w-8 rounded-full border flex items-center justify-center shrink-0 ${canPrev ? 'bg-white border-slate-200 text-slate-700' : 'bg-slate-100 border-slate-200 text-slate-400'}`}
              aria-label="Previous"
            >
              <ChevronLeft size={16} />
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-bold text-slate-800 truncate">{groupLabel} • {idx + 1}/{total}</p>
              <p className="text-[11px] text-slate-500 truncate">{currentTrip.tripNo} • {currentTrip.tripDate}</p>
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto max-w-[42vw]">
              {trips.slice(0, 8).map((trip, i) => (
                <button
                  key={trip.id}
                  onClick={() => setIdx(i)}
                  className={`h-7 min-w-[28px] rounded-full text-[11px] font-bold border px-2 shrink-0 ${i === idx ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white border-slate-200 text-slate-700'}`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={goNext}
              disabled={!canNext}
              className={`h-8 w-8 rounded-full border flex items-center justify-center shrink-0 ${canNext ? 'bg-white border-slate-200 text-slate-700' : 'bg-slate-100 border-slate-200 text-slate-400'}`}
              aria-label="Next"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Sidebar – switch between trips (left side, desktop) */}
          <div className="hidden sm:flex fixed left-0 top-0 bottom-0 z-[60] w-[320px] bg-white border-r border-slate-200 shadow-2xl flex-col animate-in slide-in-from-left duration-200">
            <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <h3 className="text-xs font-bold text-slate-800 truncate">{groupLabel}</h3>
                <p className="text-[11px] text-slate-500">
                  {total} trips • <span className="font-semibold text-slate-700">{idx + 1} / {total}</span>
                </p>
              </div>
              <button
                onClick={onClose}
                className="h-7 w-7 rounded-full bg-white border border-slate-200 text-slate-500 hover:bg-slate-100 flex items-center justify-center shrink-0"
                aria-label="Close"
              >
                <X size={14} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
              {trips.map((trip, i) => {
                const active = i === idx;
                return (
                  <button
                    key={trip.id}
                    onClick={() => setIdx(i)}
                    className={`w-full text-left rounded-xl border px-3 py-2.5 flex items-center gap-3 transition ${
                      active
                        ? 'bg-emerald-600 border-emerald-600 text-white shadow-md'
                        : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <span
                      className={`h-7 w-7 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 border ${
                        active ? 'bg-white text-emerald-700 border-white' : 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}
                    >
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className={`text-xs font-bold truncate ${active ? 'text-white' : 'text-slate-800'}`}>
                        {trip.tripNo}
                      </div>
                      <div className={`flex items-center gap-1.5 text-[11px] truncate ${active ? 'text-white/80' : 'text-slate-500'}`}>
                        <span className="inline-flex items-center gap-1">
                          <Calendar size={11} /> {trip.tripDate}
                        </span>
                        <span>•</span>
                        <span className="inline-flex items-center gap-1">
                          <Truck size={11} /> {trip.vehicleNo}
                        </span>
                      </div>
                    </div>
                    {active && <span className="h-2 w-2 rounded-full bg-white shrink-0" />}
                  </button>
                );
              })}
            </div>

            <div className="p-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={goPrev}
                disabled={!canPrev}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
                  canPrev
                    ? 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                    : 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                <ChevronLeft size={14} /> Prev
              </button>
              <span className="text-[11px] font-semibold text-slate-600 tabular-nums">
                {idx + 1} / {total}
              </span>
              <button
                type="button"
                onClick={goNext}
                disabled={!canNext}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
                  canNext
                    ? 'bg-emerald-600 border-emerald-600 text-white hover:bg-emerald-700'
                    : 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                Next <ChevronRight size={14} />
              </button>
            </div>
          </div>

          {/* Side chevrons – left/right based on trip number, same style as requested (outside modal) */}
          <button
            type="button"
            onClick={goPrev}
            disabled={!canPrev}
            aria-label="Previous trip"
            className={`hidden sm:flex fixed z-[60] top-1/2 -translate-y-1/2 left-[328px] h-10 w-10 rounded-full shadow-lg border items-center justify-center transition-all active:scale-95 ${
              canPrev ? 'bg-white border-slate-200 text-slate-800 hover:bg-slate-50' : 'bg-white/60 border-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            <ChevronLeft size={20} />
          </button>
          <button
            type="button"
            onClick={goNext}
            disabled={!canNext}
            aria-label="Next trip"
            className={`hidden sm:flex fixed z-[60] top-1/2 -translate-y-1/2 right-4 h-10 w-10 rounded-full shadow-lg border items-center justify-center transition-all active:scale-95 ${
              canNext ? 'bg-white border-slate-200 text-slate-800 hover:bg-slate-50' : 'bg-white/60 border-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            <ChevronRight size={20} />
          </button>
        </>
      )}
    </>
  );
}

export default React.memo(SummaryTripViewer);
