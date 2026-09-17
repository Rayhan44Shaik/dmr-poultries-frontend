// Account Analysis: the farm payment view — the same global pop-up the trip
// view uses, listing every trip of the selected span with the details its farm
// bill was calculated from: farm, bird type, birds, pickup (DC) weight, rate
// and the farm payment itself, plus the running cumulative and the grand total.
//
// Deliberately money-only: this is the cost the trips incurred (what the Farm
// Payment expense row charges). How much of it has been settled lives on the
// Farm Payment page, not here.
import React, { useMemo } from 'react';
import { Sprout, X } from 'lucide-react';
import type { Trip } from '../../../operations/vehicle-trips/types/trip';
import { useI18n } from '../../../../i18n';
import { opsPrimaryButtonClass } from '../../../../shared/ui/operationsStyles';
import { formatCount, formatINR, formatINRExact } from '../farm-payment/farmPaymentFormat';
import type { TripFarmPayment } from '../../types/farmPayment.types';
import AppShellModal from '../../../../ui/AppShellModal';

/** Weight and rate: Indian grouping, up to two decimals, no trailing zeros. */
const quantity = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });
const formatQuantity = (value: number): string =>
  quantity.format(Math.round((Number(value) || 0) * 100) / 100);

export interface SummaryFarmRow {
  trip: Trip;
  farm: TripFarmPayment;
}

/** Caption over value, exact figure in the hover tip. */
function Figure({ label, value, exact, tone }: { label: string; value: string; exact?: string; tone?: string }) {
  return (
    <span className="inline-flex min-w-0 flex-col" title={exact}>
      <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">{label}</span>
      <span className={`text-[13px] font-bold tabular-nums ${tone ?? 'text-slate-800 dark:text-slate-100'}`}>{value}</span>
    </span>
  );
}

type TableProps = {
  /** The trips of the selected span that carry a farm payment, newest first. */
  rows: readonly SummaryFarmRow[];
  /** Heading of the span these rows belong to, e.g. "Quarter · 18 Jun – 17 Sep". */
  spanLabel?: string;
  /** Makes the trip number a link into that trip's own view. */
  onOpenTrip?: (trip: Trip) => void;
};

/**
 * The farm payment table itself — cumulative strip, one row per trip, and a
 * cumulative totals row. Exported so the smoke test can render it directly
 * (AppShellModal portals, which the server renderer cannot do).
 */
export function SummaryFarmTable({ rows, spanLabel, onOpenTrip }: TableProps) {
  const { t } = useI18n();
  // Derived from the rows themselves, never passed in: a total cannot then
  // disagree with the column it totals.
  const { weightKg, payable, cumulative } = useMemo(() => {
    let weight = 0;
    let total = 0;
    const running: number[] = [];
    for (const row of rows) {
      weight += row.farm.dcWeight ?? row.trip.dcWeight ?? 0;
      total += row.farm.amount;
      running.push(total);
    }
    return { weightKg: weight, payable: total, cumulative: running };
  }, [rows]);
  const headCell =
    'px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400';

  return (
    <>
      {/* Cumulative strip — the whole span at a glance, above the trips. */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-emerald-100 bg-white/70 px-4 py-2.5 dark:border-slate-700 dark:bg-slate-900/60">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-lime-700 dark:text-lime-300">
          <Sprout size={13} />
          {t('accounts.summary.farm_table.title')}
        </span>
        <Figure label={t('accounts.summary.farm_table.trips')} value={formatCount(rows.length)} />
        <Figure
          label={t('accounts.summary.farm_table.weight')}
          value={`${formatQuantity(weightKg)} kg`}
          exact={`${formatQuantity(weightKg)} kg`}
        />
        <Figure
          label={t('accounts.summary.farm_table.cumulative')}
          value={formatINR(payable)}
          exact={formatINRExact(payable)}
          tone="text-slate-800 dark:text-slate-100"
        />
        {spanLabel && (
          <span className="ml-auto min-w-0 truncate text-[11px] text-slate-500 dark:text-slate-400" title={spanLabel}>
            {spanLabel}
          </span>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
          {t('accounts.summary.farm_table.empty')}
        </p>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full min-w-[60rem] border-collapse text-[13px] leading-normal">
            <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-800">
              <tr>
                <th className={`${headCell} text-left`}>{t('accounts.summary.farm_table.trip_no')}</th>
                <th className={`${headCell} text-left`}>{t('accounts.summary.farm_table.date')}</th>
                <th className={`${headCell} text-left`}>{t('accounts.summary.farm_table.farm')}</th>
                <th className={`${headCell} text-left`}>{t('accounts.summary.farm_table.bird_type')}</th>
                <th className={`${headCell} text-right`}>{t('accounts.summary.farm_table.birds')}</th>
                <th className={`${headCell} text-right`}>{t('accounts.summary.farm_table.pickup_weight')}</th>
                <th className={`${headCell} text-right`}>{t('accounts.summary.farm_table.rate')}</th>
                <th className={`${headCell} text-right`}>{t('accounts.summary.farm_table.total')}</th>
                <th className={`${headCell} text-right`}>{t('accounts.summary.farm_table.cumulative')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ trip, farm }, index) => {
                const weight = farm.dcWeight ?? trip.dcWeight ?? 0;
                return (
                  <tr
                    key={trip.id}
                    className="border-b border-slate-100 transition-colors duration-150 hover:bg-lime-50/70 dark:border-slate-800 dark:hover:bg-lime-500/10"
                  >
                    <td className="px-3 py-2 whitespace-nowrap font-semibold">
                      {onOpenTrip ? (
                        <button
                          type="button"
                          onClick={() => onOpenTrip(trip)}
                          className="text-emerald-700 hover:underline dark:text-emerald-300"
                        >
                          {trip.tripNo}
                        </button>
                      ) : (
                        <span className="text-emerald-700 dark:text-emerald-300">{trip.tripNo}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-slate-600 dark:text-slate-300">{trip.tripDate}</td>
                    <td
                      className="max-w-[16rem] truncate px-3 py-2 text-slate-600 dark:text-slate-300"
                      title={farm.farmName ?? ''}
                    >
                      {farm.farmName ?? '—'}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-slate-600 dark:text-slate-300">
                      {farm.birdType || '—'}
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
                      className="px-3 py-2 text-right tabular-nums text-slate-500 dark:text-slate-400"
                      title={formatINRExact(cumulative[index])}
                    >
                      {formatINR(cumulative[index])}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="sticky bottom-0 bg-slate-50 dark:bg-slate-800">
              <tr className="border-t border-slate-200 dark:border-slate-700">
                <td colSpan={4} className="px-3 py-2.5 text-left font-bold text-slate-700 dark:text-slate-200">
                  {t('accounts.summary.farm_table.totals')}
                  <span className="ml-1.5 font-medium text-slate-500 dark:text-slate-400">
                    {formatCount(rows.length)} {t('accounts.summary.farm_table.trips').toLowerCase()}
                  </span>
                </td>
                <td className="px-3 py-2.5" />
                <td className="px-3 py-2.5 text-right font-bold tabular-nums text-slate-700 dark:text-slate-200">
                  {formatQuantity(weightKg)}
                </td>
                <td className="px-3 py-2.5" />
                <td
                  className="px-3 py-2.5 text-right font-bold tabular-nums text-slate-800 dark:text-slate-100"
                  title={formatINRExact(payable)}
                >
                  {formatINR(payable)}
                </td>
                <td
                  className="px-3 py-2.5 text-right font-bold tabular-nums text-slate-800 dark:text-slate-100"
                  title={formatINRExact(payable)}
                >
                  {formatINR(payable)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </>
  );
}

type ViewerProps = TableProps & {
  open: boolean;
  onClose: () => void;
};

/** The pop-up: global view shell + farm payment table. */
function SummaryFarmViewer({ open, rows, spanLabel, onClose, onOpenTrip }: ViewerProps) {
  const { t } = useI18n();
  if (!open) return null;
  return (
    <AppShellModal open onClose={onClose} ariaLabelledBy="analysis-farm-viewer-title">
      <div className="flex min-h-0 max-h-[calc(100vh-64px-2rem)] flex-col">
        <div className="shrink-0 border-b border-emerald-100 bg-emerald-50/60 dark:border-slate-700 dark:bg-slate-800">
          <div className="flex flex-wrap items-center gap-3 px-4 py-3">
            <span
              aria-hidden="true"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-lime-600 text-white shadow-sm"
            >
              <Sprout size={17} strokeWidth={2.2} />
            </span>
            <h2
              id="analysis-farm-viewer-title"
              className="text-sm font-bold tracking-wide text-slate-800 dark:text-slate-100"
            >
              {t('accounts.summary.farm_table.title')}
            </h2>
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-600 dark:text-slate-200">
              {t('accounts.summary.farm_table.subtitle')}
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label={t('common.close')}
              className="grid h-10 w-10 place-items-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
            >
              <X size={18} />
            </button>
          </div>
        </div>
        <SummaryFarmTable rows={rows} spanLabel={spanLabel} onOpenTrip={onOpenTrip} />
      </div>
    </AppShellModal>
  );
}

export default React.memo(SummaryFarmViewer);

/** Compact trigger card for the page: the cumulative figures + a view button. */
export function SummaryFarmCard({
  rows,
  spanLabel,
  onOpen,
}: TableProps & { onOpen: () => void }) {
  const { t } = useI18n();
  const { weightKg, payable } = useMemo(() => {
    let weight = 0;
    let total = 0;
    for (const row of rows) {
      weight += row.farm.dcWeight ?? row.trip.dcWeight ?? 0;
      total += row.farm.amount;
    }
    return { weightKg: weight, payable: total };
  }, [rows]);

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <span className="inline-flex items-center gap-2.5">
        <span
          aria-hidden="true"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-lime-600 text-white shadow-sm"
        >
          <Sprout size={16} strokeWidth={2.2} />
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="text-[13px] font-bold tracking-wide text-slate-700 dark:text-slate-200">
            {t('accounts.summary.farm_table.title')}
          </span>
          <span className="truncate text-[11px] text-slate-500 dark:text-slate-400" title={spanLabel}>
            {t('accounts.summary.farm_table.subtitle')}
          </span>
        </span>
      </span>
      <Figure label={t('accounts.summary.farm_table.trips')} value={formatCount(rows.length)} />
      <Figure
        label={t('accounts.summary.farm_table.weight')}
        value={`${formatQuantity(weightKg)} kg`}
        exact={`${formatQuantity(weightKg)} kg`}
      />
      <Figure
        label={t('accounts.summary.farm_table.cumulative')}
        value={formatINR(payable)}
        exact={formatINRExact(payable)}
      />
      <button type="button" onClick={onOpen} className={`${opsPrimaryButtonClass} ml-auto inline-flex items-center gap-1.5`}>
        <Sprout size={14} />
        {t('accounts.summary.farm_table.open')}
      </button>
    </div>
  );
}
