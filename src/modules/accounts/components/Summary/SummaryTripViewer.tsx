// Account Analysis only: trip navigation lives inside the read-only modal.
// No floating controls over the app header and no changes to Trip List views.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, PanelLeftOpen, PanelLeftClose, Truck, Calendar } from 'lucide-react';
import type { Trip } from '../../../operations/vehicle-trips/types/trip';
import { TripHistoryViewModal } from '../../../operations/vehicle-trips/components/TripViewModal';
import { useShops } from '../../../masters/shops/hooks/useShops';
import { useBirdTypes } from '../../../masters/bird-types/hooks/useBirdTypes';
import { useI18n } from '../../../../i18n';
import { getTripNavigationIndex } from '../../utils/tripNavigation';
import AppShellModal from '../../../../ui/AppShellModal';

type Props = { open: boolean; trips: Trip[]; groupLabel: string; onClose: () => void };

function SummaryTripViewer({ open, trips, groupLabel, onClose }: Props) {
  const { shops } = useShops();
  const { birdTypes } = useBirdTypes();
  const { t } = useI18n();
  const [index, setIndex] = useState(0);
  const [sideOpen, setSideOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const focusSelectedTrip = useRef(false);
  const groupKey = trips.map(trip => trip.id).join(',');
  const [lastGroup, setLastGroup] = useState(groupKey);
  if (lastGroup !== groupKey) { setLastGroup(groupKey); setIndex(0); setSideOpen(false); }
  const safeIndex = Math.min(index, Math.max(0, trips.length - 1));
  const current = trips[safeIndex];
  const previous = useCallback(() => setIndex(value => Math.max(0, value - 1)), []);
  const next = useCallback(() => setIndex(value => Math.min(trips.length - 1, value + 1)), [trips.length]);

  useEffect(() => {
    if (!open || !trips.length) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable="true"], [role="combobox"], [role="tablist"], [role="radiogroup"]')) return;
      // Vertical arrows belong to the selected sidebar, not the document.
      const inSidebar = Boolean(target && sidebarRef.current?.contains(target));
      if (!inSidebar && event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      const nextIndex = getTripNavigationIndex(event.key, safeIndex, trips.length);
      if (nextIndex === null) return;
      event.preventDefault();
      focusSelectedTrip.current = inSidebar;
      setIndex(nextIndex);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, trips.length, safeIndex]);

  useEffect(() => {
    if (!sideOpen) return;
    const selected = sidebarRef.current?.querySelector<HTMLButtonElement>(`#analysis-trip-${safeIndex}`);
    if (focusSelectedTrip.current) {
      selected?.focus({ preventScroll: true });
      focusSelectedTrip.current = false;
    }
    selected?.scrollIntoView({ block: 'nearest' });
  }, [safeIndex, sideOpen]);

  if (!open) return null;
  if (!current) return <AppShellModal open onClose={onClose}>
    <div className="p-6"><h2 className="font-semibold">{groupLabel}</h2><p className="mt-2 text-sm text-slate-500">{t('common.no_records')}</p>
      <button type="button" onClick={onClose} className="mt-4 rounded-lg border px-4 py-2">{t('common.close')}</button>
    </div>
  </AppShellModal>;

  const navigation = <div className="relative z-20 shrink-0 border-b border-emerald-100 bg-emerald-50/60 dark:border-slate-700 dark:bg-slate-800">
    <div className="flex flex-wrap items-center gap-3 px-4 py-3">
      <button ref={toggleRef} type="button" onClick={() => { focusSelectedTrip.current = !sideOpen; setSideOpen(value => !value); }} aria-expanded={sideOpen} aria-controls="analysis-trip-sidebar"
        className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-emerald-200 bg-white px-3 text-sm font-semibold text-emerald-800 outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">
        {sideOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}{t('accounts.summary.trip_navigation')}
      </button>
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-600 dark:text-slate-200" title={groupLabel}>{groupLabel}</span>
      <div className="ml-auto flex items-center gap-2">
        <button type="button" onClick={previous} disabled={safeIndex === 0} aria-label={t('common.previous')} className="grid h-10 w-10 place-items-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-emerald-500"><ChevronLeft size={18} /></button>
        <span aria-live="polite" className="min-w-16 text-center text-sm font-bold tabular-nums text-emerald-800 dark:text-emerald-200">{safeIndex + 1} / {trips.length}</span>
        <button type="button" onClick={next} disabled={safeIndex === trips.length - 1} aria-label={t('common.next')} className="grid h-10 w-10 place-items-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-emerald-500"><ChevronRight size={18} /></button>
      </div>
    </div>
    {sideOpen && <nav ref={sidebarRef} id="analysis-trip-sidebar" aria-label={t('accounts.summary.trip_navigation')}
      onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); setSideOpen(false); toggleRef.current?.focus(); } }}
      className="absolute left-0 top-full max-h-[65vh] w-80 max-w-[calc(100vw-4rem)] overflow-y-auto rounded-br-xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-900">
      {trips.map((trip, idx) => <button key={trip.id} id={`analysis-trip-${idx}`} type="button" tabIndex={idx === safeIndex ? 0 : -1} onClick={() => setIndex(idx)} aria-keyshortcuts="ArrowUp ArrowDown Home End" aria-current={idx === safeIndex ? 'true' : undefined}
        className={`mb-1 flex w-full items-start gap-3 rounded-lg border px-3 py-3 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${idx === safeIndex ? 'border-emerald-300 bg-emerald-50 text-emerald-900' : 'border-transparent text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800'}`}>
        <span className="min-w-6 font-bold tabular-nums">{idx + 1}</span>
        <span className="min-w-0"><span className="block truncate font-semibold">{trip.tripNo}</span>
          <span className="mt-1 flex items-center gap-1.5 text-xs"><Calendar size={12} />{trip.tripDate}</span>
          <span className="mt-1 flex items-center gap-1.5 text-xs"><Truck size={12} />{trip.vehicleNo}</span>
        </span>
      </button>)}
    </nav>}
  </div>;

  return <TripHistoryViewModal open trip={current} shops={shops} birdTypes={birdTypes} onClose={onClose} analysisNavigation={navigation} />;
}

export default React.memo(SummaryTripViewer);
