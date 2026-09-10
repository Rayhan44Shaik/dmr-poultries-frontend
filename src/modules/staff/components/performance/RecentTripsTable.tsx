// src/modules/staff/components/performance/RecentTripsTable.tsx
//
// Recent trips for the performance detail drawer. Data comes verbatim from
// the API's `detail.recentTrips`; this component is presentation-only and
// fully localised (en/te).
//
// Trip race: when the page passes the selected person's row, each trip is
// paced against that person's OWN period average (never invented thresholds):
//   Supervisors → mortality rate / weight-loss % above their own average.
//   Drivers     → distance below their own per-trip average.
// Off-pace trips lead as full DETAIL CARDS — trip number, date, vehicle,
// complete metric tiles and a translated explanation — followed by the
// complete table (with Pace chips) for every trip.

import { memo } from 'react';
import { format } from 'date-fns';
import { te as teLocale } from 'date-fns/locale';
import type { Locale } from 'date-fns';
import { AlertTriangle } from 'lucide-react';
import { usePerformanceI18n } from './performanceI18nScope';
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
  formatDecimal,
  type StaffPerformanceKind,
  type TripRaceEntry,
} from '../../utils/performanceView';

const fmt = (value: number, digits = 0) =>
  Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: digits });

interface RecentTripsTableProps {
  trips: PerformanceRecentTrip[];
  /** Selected person's row — enables the self-relative trip race. */
  paceRow?: DriverPerformanceRow | SupervisorPerformanceRow;
  paceKind?: StaffPerformanceKind;
}

type Translate = ReturnType<typeof usePerformanceI18n>['t'];

function PaceChip({ offPace }: { offPace: boolean }) {
  const { t } = usePerformanceI18n();
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-1.5 py-0.5 text-[10px] font-bold ${
        offPace
          ? 'border-amber-200 bg-amber-50 text-amber-700'
          : 'border-slate-200 bg-slate-50 text-slate-500'
      }`}
    >
      {offPace && <AlertTriangle size={10} aria-hidden="true" />}
      {t(offPace ? 'staff.perf.trips.pace_off' : 'staff.perf.trips.pace_on')}
    </span>
  );
}

function tripRateTiles(trip: PerformanceRecentTrip) {
  const mRate =
    trip.totalBirdsDelivered > 0
      ? (trip.totalMortality / trip.totalBirdsDelivered) * 100
      : 0;
  const lossPct =
    trip.totalDeliveredWeight > 0
      ? (trip.weightLoss / trip.totalDeliveredWeight) * 100
      : 0;
  return { mRate, lossPct };
}

/** Full-detail card for one off-pace trip — the "why" behind the lag. */
function LaggingTripCard({
  entry,
  paceKind,
  locale,
  t,
}: {
  entry: TripRaceEntry;
  paceKind: StaffPerformanceKind;
  locale: Locale | undefined;
  t: Translate;
}) {
  const { trip } = entry;
  const parsed = parseBusinessDate(trip.tripDate);
  const { mRate, lossPct } = tripRateTiles(trip);
  const isDriver = paceKind === 'drivers';

  // Five metric tiles; the lagging dimension is accent-tinted and its sub
  // line carries the direct comparison (headline = "actual / own average").
  const tiles: Array<{ label: string; value: string; sub?: string; accent?: boolean }> = [
    { label: t('staff.perf.trips.col.shops'), value: fmt(trip.totalShops) },
    { label: t('staff.perf.trips.col.birds'), value: fmt(trip.totalBirdsDelivered) },
    {
      label: t('staff.perf.trips.col.mortality'),
      value: fmt(trip.totalMortality),
      sub: `${formatDecimal(mRate, 2)}%`,
      accent: paceKind === 'supervisors',
    },
    {
      label: t('staff.perf.trips.col.weight_loss'),
      value: `${fmt(trip.weightLoss, 1)} kg`,
      sub: `${formatDecimal(lossPct, 2)}%`,
      accent: paceKind === 'supervisors',
    },
    {
      label: t('staff.perf.trips.col.km'),
      value: `${fmt(trip.totalKm)} km`,
      sub: isDriver ? entry.headline : undefined,
      accent: isDriver,
    },
  ];

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="font-mono text-[11px] font-bold text-slate-900">{trip.tripNo}</span>
          <span aria-hidden="true" className="text-slate-300">·</span>
          <span className="text-[11px] font-medium text-slate-500">
            {parsed ? format(parsed, 'dd MMM yyyy', { locale }) : '—'}
          </span>
          <span aria-hidden="true" className="text-slate-300">·</span>
          <span className="text-[11px] font-semibold text-slate-600">{trip.vehicleNo}</span>
        </div>
        <PaceChip offPace />
      </div>

      <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-5">
        {tiles.map((tile) => (
          <div
            key={tile.label}
            className={`rounded-lg border px-2 py-1.5 ${
              tile.accent
                ? 'border-amber-200 bg-white'
                : 'border-slate-100 bg-white/80'
            }`}
          >
            <div className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">
              {tile.label}
            </div>
            <div className="text-xs font-bold tabular-nums text-slate-900">{tile.value}</div>
            {tile.sub && (
              <div className="text-[10px] font-medium tabular-nums text-slate-500">{tile.sub}</div>
            )}
          </div>
        ))}
      </div>

      <p className="mt-2 flex items-start gap-1.5 text-[11px] font-medium leading-relaxed text-amber-800">
        <AlertTriangle size={12} className="mt-0.5 shrink-0" aria-hidden="true" />
        {entry.story}
      </p>
    </div>
  );
}

const RecentTripsTable = ({ trips, paceRow, paceKind }: RecentTripsTableProps) => {
  // Pop-up-scoped: inside the details pop-up this is the pop-up's language
  // (toggle in its header); standalone it falls back to the global language.
  const { t, language } = usePerformanceI18n();
  const locale: Locale | undefined = language === 'te' ? teLocale : undefined;

  const raceEntries: TripRaceEntry[] =
    paceRow && paceKind ? buildTripRace(paceKind, trips, paceRow, t) : [];
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
    <div className="space-y-3">
      {paceRow && paceKind && lagging.length > 0 && (
        <section aria-label={t('staff.perf.trips.lagging_title')} className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700">
            {t('staff.perf.trips.lagging_title')}
          </p>
          {lagging.map((entry) => (
            <LaggingTripCard
              key={entry.trip.tripNo}
              entry={entry}
              paceKind={paceKind}
              locale={locale}
              t={t}
            />
          ))}
        </section>
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
                      <PaceChip offPace={Boolean(pace)} />
                    </td>
                  )}
                  <td className={`${uiTableTdNumericClass} whitespace-nowrap px-3 py-2 text-xs`}>{fmt(trip.totalShops)}</td>
                  <td className={`${uiTableTdNumericClass} whitespace-nowrap px-3 py-2 text-xs`}>{fmt(trip.totalBirdsDelivered)}</td>
                  <td className={`${uiTableTdNumericClass} whitespace-nowrap px-3 py-2 text-xs`}>{fmt(trip.totalDeliveredWeight)}</td>
                  <td className={`${uiTableTdNumericClass} whitespace-nowrap px-3 py-2 text-xs`}>{fmt(trip.totalMortality)}</td>
                  <td className={`${uiTableTdNumericClass} whitespace-nowrap px-3 py-2 text-xs`}>{fmt(trip.weightLoss, 1)}</td>
                  <td className={`${uiTableTdNumericClass} whitespace-nowrap px-3 py-2 text-xs`}>{fmt(trip.totalKm)}</td>
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
