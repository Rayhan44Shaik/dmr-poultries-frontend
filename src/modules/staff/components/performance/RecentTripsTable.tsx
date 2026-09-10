// src/modules/staff/components/performance/RecentTripsTable.tsx
//
// Recent trips table for the performance detail drawer. Data comes verbatim
// from the API's `detail.recentTrips`; this component is presentation-only and
// fully localised (en/te) via the shared dictionary.

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
import type { PerformanceRecentTrip } from '../../types/performance';

const formatNumber = (value: number, digits = 0) =>
  Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: digits });

interface RecentTripsTableProps {
  trips: PerformanceRecentTrip[];
}

const RecentTripsTable = ({ trips }: RecentTripsTableProps) => {
  const { t, language } = useI18n();
  const locale: Locale | undefined = language === 'te' ? teLocale : undefined;

  if (!trips || trips.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 py-8 text-center text-sm font-medium text-slate-400">
        {t('staff.perf.trips.empty')}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="min-w-full divide-y divide-slate-100">
        <thead className={uiTableHeadClass}>
          <tr>
            <th scope="col" className={`${uiTableThClass} px-3 py-2 text-left`}>{t('staff.perf.trips.col.trip')}</th>
            <th scope="col" className={`${uiTableThClass} px-3 py-2 text-left`}>{t('staff.perf.trips.col.date')}</th>
            <th scope="col" className={`${uiTableThClass} px-3 py-2 text-left`}>{t('staff.perf.trips.col.vehicle')}</th>
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
            return (
              <tr key={trip.tripNo} className="transition-colors hover:bg-slate-50/70">
                <td className={`${uiTableTdClass} whitespace-nowrap px-3 py-2 text-xs font-semibold text-slate-800`}>{trip.tripNo}</td>
                <td className={`${uiTableTdClass} whitespace-nowrap px-3 py-2 text-xs text-slate-600`}>
                  {parsed ? format(parsed, 'dd MMM yyyy', { locale }) : '—'}
                </td>
                <td className={`${uiTableTdClass} whitespace-nowrap px-3 py-2 text-xs font-medium text-slate-700`}>{trip.vehicleNo}</td>
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
  );
};

export default memo(RecentTripsTable);
