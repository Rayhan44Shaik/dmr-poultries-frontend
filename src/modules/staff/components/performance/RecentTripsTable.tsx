// src/modules/staff/components/performance/RecentTripsTable.tsx
//
// Recent trips table for the performance detail drawer. Data comes verbatim
// from the API's `detail.recentTrips`; this component is presentation-only and
// fully localised (en/te) via the shared dictionary.
//
// Trip race: when the page passes the selected person's row, each trip is
// paced against that person's OWN period average (never invented thresholds):
//   Supervisors → mortality rate / weight-loss % above their own average.
//   Drivers     → distance below their own per-trip average.
// Off-pace trips lead a callout strip above the table and carry an amber chip
// in the Pace column, so the drawer answers "which trips lagged".

import { memo } from 'react';
import { format } from 'date-fns';
import { te as teLocale } from 'date-fns/locale';
import type { Locale } from 'date-fns';
import { useI18n } from '../../../../i18n';
import { parseBusinessDate } from '../../../../utils/businessDate';
import {
  uiTableHeadClass,
  uiTableThClass,
  uiTableTdClass,
  uiTableTdNumericClass,
} from '../../../../shared/ui/uiTokens';
import type {
  DriverPerformanceRow,
  PerformanceRecentTrip,
  SupervisorPerformanceRow,
} from '../../types/performance';
import {
  buildTripRace,
  type StaffPerformanceKind,
  type TripRaceEntry,
} from '../../utils/performanceView';

const formatNumber = (value: number, digits = 0) =>
  Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: digits });

interface RecentTripsTableProps {
  trips: PerformanceRecentTrip[];
  /** Selected person's row — enables the self-relative trip race. */
  paceRow?: DriverPerformanceRow | SupervisorPerformanceRow;
  paceKind?: StaffPerformanceKind;
}

function PaceChip({ offPace, label }: { offPace: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full border px-1.5 py-0.5 text-[10px] font-bold ${
        offPace
          ? 'border-amber-200 bg-amber-50 text-amber-700'
          : 'border-slate-200 bg-slate-50 text-slate-500'
      }`}
    >
      {label}
    </span>
  );
}

const RecentTripsTable = ({ trips, paceRow, paceKind }: RecentTripsTableProps) => {
  const { t, language } = useI18n();
  const locale: Locale | undefined = language === 'te' ? teLocale : undefined;

  const raceEntries: TripRaceEntry[] =
    paceRow && paceKind ? buildTripRace(paceKind, trips, paceRow) : [];
  const paceByTripNo = new Map(raceEntries.map((entry) => [entry.trip.tripNo, entry.offPace]));
  const lagging = raceEntries.filter((entry) => entry.offPace);

  if (!trips || trips.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 py-8 text-center text-sm font-medium text-slate-400">
        {t('staff.perf.trips.empty')}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {lagging.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/60 px-3 py-2.5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700">
            {t('staff.perf.trips.lagging_title')}
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {lagging.map(({ trip, headline }) => (
              <span
                key={trip.tripNo}
                title={headline}
                className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700"
              >
                <span className="font-mono text-[10px]">{trip.tripNo}</span>
                <span className="text-amber-700">{headline}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="min-w-full divide-y divide-slate-100">
          <thead className={uiTableHeadClass}>
            <tr>
              <th scope="col" className={`${uiTableThClass} px-3 py-2 text-left`}>{t('staff.perf.trips.col.trip')}</th>
              <th scope="col" className={`${uiTableThClass} px-3 py-2 text-left`}>{t('staff.perf.trips.col.date')}</th>
              <th scope="col" className={`${uiTableThClass} px-3 py-2 text-left`}>{t('staff.perf.trips.col.vehicle')}</th>
              {paceRow && (
                <th scope="col" className={`${uiTableThClass} px-3 py-2 text-center`}>{t('staff.perf.trips.col.pace')}</th>
              )}
              <th scope="col" className={`${uiTableThClass} px-3 py-2 text-right`}>{t('staff.perf.trips.col.shops')}</th>
              <th scope="col" className={`${uiTableThClass} px-3 py-2 text-right`}>{t('staff.perf.trips.col.birds')}</th>
              <th scope="col" className={`${uiTableThClass} px-3 py-2 text-right`}>{t('staff.perf.trips.col.weight')}</th>
              <th scope="col" className={`${uiTableThClass} px-3 py-2 text-right`}>{t('staff.perf.trips.col.mortality')}</th>
              <th scope="col" className={`${uiTableThClass} px-3 py-2 text-right`}>{t('staff.perf.trips.col.weight_loss')}</th>
              <th scope="col" className={`${uiTableThClass} px-3 py-2 text-right`}>{t('staff.perf.trips.col.km')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {trips.map((trip) => {
              const parsed = parseBusinessDate(trip.tripDate);
              const pace = paceByTripNo.get(trip.tripNo);
              return (
                <tr
                  key={trip.tripNo}
                  className={`transition-colors hover:bg-slate-50/70 ${pace ? 'bg-amber-50/40' : ''}`}
                >
                  <td className={`${uiTableTdClass} whitespace-nowrap px-3 py-2 font-mono text-[11px] font-semibold text-slate-800`}>{trip.tripNo}</td>
                  <td className={`${uiTableTdClass} whitespace-nowrap px-3 py-2 text-xs text-slate-600`}>
                    {parsed ? format(parsed, 'dd MMM yyyy', { locale }) : '—'}
                  </td>
                  <td className={`${uiTableTdClass} whitespace-nowrap px-3 py-2 text-xs font-medium text-slate-700`}>{trip.vehicleNo}</td>
                  {paceRow && (
                    <td className={`${uiTableTdClass} whitespace-nowrap px-3 py-2 text-center`}>
                      <PaceChip offPace={Boolean(pace)} label={t(pace ? 'staff.perf.trips.pace_off' : 'staff.perf.trips.pace_on')} />
                    </td>
                  )}
                  <td className={`${uiTableTdNumericClass} whitespace-nowrap px-3 py-2 text-xs`}>{formatNumber(trip.totalShops)}</td>
                  <td className={`${uiTableTdNumericClass} whitespace-nowrap px-3 py-2 text-xs`}>{formatNumber(trip.totalBirdsDelivered)}</td>
                  <td className={`${uiTableTdNumericClass} whitespace-nowrap px-3 py-2 text-xs`}>{formatNumber(trip.totalDeliveredWeight)}</td>
                  <td className={`${uiTableTdNumericClass} whitespace-nowrap px-3 py-2 text-xs`}>{formatNumber(trip.totalMortality)}</td>
                  <td className={`${uiTableTdNumericClass} whitespace-nowrap px-3 py-2 text-xs`}>{formatNumber(trip.weightLoss, 1)}</td>
                  <td className={`${uiTableTdNumericClass} whitespace-nowrap px-3 py-2 text-xs`}>{formatNumber(trip.totalKm)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default memo(RecentTripsTable);
