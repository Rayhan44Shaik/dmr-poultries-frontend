// Account Analysis: the per-trip farm payment breakdown that explains the
// "Farm Payment" row of the expense table. One row per trip in the selected
// span, carrying that trip's own pickup (DC) weight and farm rate, what has
// been paid to the farmer and what is still owed — so the expense row above it
// can be audited trip by trip instead of taken on trust.
import React, { useMemo } from 'react';
import { ChevronDown, Sprout } from 'lucide-react';
import type { Trip } from '../../../operations/vehicle-trips/types/trip';
import { useI18n } from '../../../../i18n';
import { opsSecondaryButtonClass } from '../../../../shared/ui/operationsStyles';
import { formatCount, formatINR, formatINRExact } from '../farm-payment/farmPaymentFormat';
import type { FarmPaymentTotals, TripFarmPayment } from '../../types/farmPayment.types';

/** Weight and rate: Indian grouping, up to two decimals, no trailing zeros. */
const quantity = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });
const formatQuantity = (value: number): string => quantity.format(Math.round((Number(value) || 0) * 100) / 100);

export interface SummaryFarmRow {
  trip: Trip;
  farm: TripFarmPayment;
}

type Props = {
  /** The trips of the selected span that carry a farm payment, newest first. */
  rows: readonly SummaryFarmRow[];
  /** Totals over exactly `rows` — the same figure the Farm Payment expense row uses. */
  totals: FarmPaymentTotals;
  open: boolean;
  onToggle: () => void;
  /** Opens the read-only trip viewer for that single trip. */
  onOpenTrip: (trip: Trip) => void;
};

/** Caption over value, exact figure in the hover tip. */
function FarmStat({ label, value, exact, tone }: { label: string; value: string; exact?: string; tone?: string }) {
  return (
    <span className="inline-flex flex-col" title={exact}>
      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">{label}</span>
      <span className={`text-[13px] font-bold tabular-nums ${tone ?? 'text-slate-800 dark:text-slate-100'}`}>{value}</span>
    </span>
  );
}

function SummaryFarmTable({ rows, totals, open, onToggle, onOpenTrip }: Props) {
  const { t } = useI18n();
  // Derived from the rows themselves, never passed in: the total can then not
  // disagree with the column it totals.
  const weightKg = useMemo(
    () => rows.reduce((sum, row) => sum + (row.farm.dcWeight ?? row.trip.dcWeight ?? 0), 0),
    [rows]
  );
  const headerCell = 'px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400';

  return (
    <div className="bg-white rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
        <span className="inline-flex items-center gap-2">
          <span aria-hidden="true" className="grid h-7 w-7 place-items-center rounded-lg bg-lime-600 text-white shadow-sm">
            <Sprout size={14} strokeWidth={2.2} />
          </span>
          <span className="text-[13px] font-bold tracking-wide text-slate-700 dark:text-slate-200">
            {t('accounts.summary.farm_table.title')}
          </span>
        </span>
        <span className="text-[12px] text-slate-500 dark:text-slate-400">
          {t('accounts.summary.farm_table.subtitle')}
        </span>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className={`${opsSecondaryButtonClass} ml-auto inline-flex items-center gap-1.5`}
        >
          <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
          {open ? t('accounts.summary.farm_table.hide') : t('accounts.summary.farm_table.show')}
        </button>
      </div>

      <div className="flex flex-wrap items-end gap-x-6 gap-y-2 border-b border-slate-200 px-4 py-2.5 dark:border-slate-700">
        <FarmStat label={t('accounts.summary.farm_table.trips')} value={formatCount(rows.length)} />
        <FarmStat
          label={t('accounts.summary.farm_table.weight')}
          value={`${formatQuantity(weightKg)} kg`}
          exact={`${formatQuantity(weightKg)} kg`}
        />
        <FarmStat
          label={t('accounts.summary.expense_rows.farm')}
          value={formatINR(totals.payable)}
          exact={formatINRExact(totals.payable)}
        />
        <FarmStat
          label={t('accounts.summary.farm_table.paid')}
          value={formatINR(totals.paid)}
          exact={formatINRExact(totals.paid)}
          tone="text-emerald-700 dark:text-emerald-300"
        />
        <FarmStat
          label={t('accounts.summary.farm_table.balance')}
          value={formatINR(totals.balance)}
          exact={formatINRExact(totals.balance)}
          tone={totals.balance > 0 ? 'text-rose-700 dark:text-rose-300' : 'text-slate-500 dark:text-slate-400'}
        />
      </div>

      {open &&
        (rows.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
            {t('accounts.summary.farm_table.empty')}
          </p>
        ) : (
          <div className="max-h-[26rem] overflow-auto">
            {/* Deliberately not `.analysis-table`: that class pads cells for the
                wide comparison tables. A 500-row list needs the density of Trip
                List, so the cells set their own padding below. */}
            <table className="w-full min-w-[56rem] border-collapse text-[13px] leading-normal">
              <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-800">
                <tr>
                  <th className={`${headerCell} text-left`}>{t('accounts.summary.farm_table.trip_no')}</th>
                  <th className={`${headerCell} text-left`}>{t('accounts.summary.farm_table.date')}</th>
                  <th className={`${headerCell} text-left`}>{t('accounts.summary.farm_table.farm')}</th>
                  <th className={`${headerCell} text-right`}>{t('accounts.summary.farm_table.birds')}</th>
                  <th className={`${headerCell} text-right`}>{t('accounts.summary.farm_table.pickup_weight')}</th>
                  <th className={`${headerCell} text-right`}>{t('accounts.summary.farm_table.rate')}</th>
                  <th className={`${headerCell} text-right`}>{t('accounts.summary.farm_table.total')}</th>
                  <th className={`${headerCell} text-right`}>{t('accounts.summary.farm_table.paid')}</th>
                  <th className={`${headerCell} text-right`}>{t('accounts.summary.farm_table.balance')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ trip, farm }) => {
                  const weight = farm.dcWeight ?? trip.dcWeight ?? 0;
                  return (
                    <tr
                      key={trip.id}
                      className="border-b border-slate-100 transition-colors duration-150 hover:bg-lime-50/70 dark:border-slate-800 dark:hover:bg-lime-500/10"
                    >
                      <td className="px-3 py-2 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => onOpenTrip(trip)}
                          className="font-semibold text-emerald-700 hover:underline dark:text-emerald-300"
                        >
                          {trip.tripNo}
                        </button>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-slate-600 dark:text-slate-300">{trip.tripDate}</td>
                      <td
                        className="max-w-[16rem] truncate px-3 py-2 text-slate-600 dark:text-slate-300"
                        title={`${farm.farmName ?? ''}${farm.birdType ? ` · ${farm.birdType}` : ''}`}
                      >
                        {farm.farmName ?? '—'}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-600 dark:text-slate-300">
                        {formatCount(farm.totalBirds ?? trip.totalBirds ?? 0)}
                      </td>
                      <td
                        className="px-3 py-2 text-right tabular-nums text-slate-600 dark:text-slate-300"
                        title={`${formatQuantity(weight)} kg`}
                      >
                        {formatQuantity(weight)}
                      </td>
                      <td
                        className="px-3 py-2 text-right tabular-nums text-slate-600 dark:text-slate-300"
                        title={`₹${formatQuantity(farm.rate ?? 0)} / kg`}
                      >
                        {formatQuantity(farm.rate ?? 0)}
                      </td>
                      <td
                        className="px-3 py-2 text-right font-semibold tabular-nums text-slate-800 dark:text-slate-100"
                        title={formatINRExact(farm.amount)}
                      >
                        {formatINR(farm.amount)}
                      </td>
                      <td
                        className="px-3 py-2 text-right tabular-nums text-emerald-700 dark:text-emerald-300"
                        title={formatINRExact(farm.paidAmount)}
                      >
                        {formatINR(farm.paidAmount)}
                      </td>
                      <td
                        className={`px-3 py-2 text-right tabular-nums ${farm.balance > 0 ? 'text-rose-700 dark:text-rose-300' : 'text-slate-400 dark:text-slate-500'}`}
                        title={formatINRExact(farm.balance)}
                      >
                        {formatINR(farm.balance)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="sticky bottom-0 bg-slate-50 dark:bg-slate-800">
                <tr className="border-t border-slate-200 dark:border-slate-700">
                  <td colSpan={3} className="px-3 py-2.5 text-left font-bold text-slate-700 dark:text-slate-200">
                    {t('accounts.summary.farm_table.totals')}
                    <span className="ml-1.5 font-medium text-slate-500 dark:text-slate-400">
                      {formatCount(rows.length)} {t('accounts.summary.farm_table.trips').toLowerCase()}
                    </span>
                  </td>
                  <td className="px-3 py-2.5" />
                  <td className="px-3 py-2.5 text-right font-bold tabular-nums text-slate-700 dark:text-slate-200">
                    {formatQuantity(weightKg)}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-slate-400 dark:text-slate-500">—</td>
                  <td
                    className="px-3 py-2.5 text-right font-bold tabular-nums text-slate-800 dark:text-slate-100"
                    title={formatINRExact(totals.payable)}
                  >
                    {formatINR(totals.payable)}
                  </td>
                  <td
                    className="px-3 py-2.5 text-right font-bold tabular-nums text-emerald-700 dark:text-emerald-300"
                    title={formatINRExact(totals.paid)}
                  >
                    {formatINR(totals.paid)}
                  </td>
                  <td
                    className="px-3 py-2.5 text-right font-bold tabular-nums text-rose-700 dark:text-rose-300"
                    title={formatINRExact(totals.balance)}
                  >
                    {formatINR(totals.balance)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        ))}
    </div>
  );
}

export default SummaryFarmTable;
