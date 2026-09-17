// Account Analysis: the farm payment view — the same global pop-up the trip
// view uses, listing every trip of the selected span with the details its farm
// bill was calculated from: farm, bird type, birds, pickup (DC) weight, rate
// and the farm payment itself, plus the running cumulative and the grand total.
//
// Deliberately money-only: this is the cost the trips incurred (what the Farm
// Payment expense row charges). How much of it has been settled lives on the
// Farm Payment page, not here.
import React, { useMemo, useState } from 'react';
import { CalendarDays, Sprout, X } from 'lucide-react';
import type { Trip } from '../../../operations/vehicle-trips/types/trip';
import { useI18n } from '../../../../i18n';
import { formatCount, formatINR, formatINRExact } from '../farm-payment/farmPaymentFormat';
import type { TripFarmPayment } from '../../types/farmPayment.types';
import AppShellModal from '../../../../ui/AppShellModal';
import ActionTooltip from '../../../../ui/ActionTooltip';
import { Pagination } from '../../../../ui';
import {
  PAGINATION_DEFAULT_PAGE_SIZE,
  clampPage,
  computeTotalPages,
} from '../../../../shared/ui/paginationStyles';

/** Weight and rate: Indian grouping, up to two decimals, no trailing zeros. */
const quantity = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });
const formatQuantity = (value: number): string =>
  quantity.format(Math.round((Number(value) || 0) * 100) / 100);

export interface SummaryFarmRow {
  trip: Trip;
  farm: TripFarmPayment;
}

/** Caption over value, exact figure in the hover tip. `pill` dresses the value
 * as the same clickable chip the analysis "No. of Trips" figures use, so it
 * reads as "press me" wherever the figure opens a view. */
function Figure({
  label,
  value,
  exact,
  tone,
  pill = false,
}: {
  label: string;
  value: string;
  exact?: string;
  tone?: string;
  pill?: boolean;
}) {
  return (
    <span className="inline-flex min-w-0 flex-col" title={exact}>
      <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">{label}</span>
      {pill ? (
        <span
          className={`inline-flex w-fit items-center justify-center rounded-full border bg-white px-2.5 py-0.5 text-[13px] font-bold tabular-nums shadow-sm transition group-hover/farm:scale-[1.02] ${tone ?? 'border-slate-200 text-slate-700 group-hover/farm:border-emerald-200 group-hover/farm:bg-emerald-50 group-hover/farm:text-emerald-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:group-hover/farm:border-emerald-700 dark:group-hover/farm:bg-emerald-500/10 dark:group-hover/farm:text-emerald-300'}`}
        >
          {value}
        </span>
      ) : (
        <span className={`text-[13px] font-bold tabular-nums ${tone ?? 'text-slate-800 dark:text-slate-100'}`}>{value}</span>
      )}
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
 * The farm payment table itself — a grand-total strip, one row per trip of the
 * current page, a sticky totals row for the WHOLE span, and the app's global
 * pagination so a 500-trip quarter stays readable. Exported so the smoke test
 * can render it directly (AppShellModal portals, which the server renderer
 * cannot do).
 */
export function SummaryFarmTable({ rows, onOpenTrip }: TableProps) {
  const { t } = useI18n();
  // The viewer mounts fresh each time it opens, so `page` starts at 1 per span;
  // clamping here (rather than in an effect) keeps a narrowed list from ever
  // showing an empty page.
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGINATION_DEFAULT_PAGE_SIZE);
  const totalPages = computeTotalPages(rows.length, pageSize);
  const safePage = clampPage(page, totalPages);
  const pageRows = useMemo(
    () => rows.slice((safePage - 1) * pageSize, safePage * pageSize),
    [rows, safePage, pageSize]
  );
  // Grand totals over the WHOLE span, never just the page — so the totals row
  // and the strip always say the same thing whatever page you are on.
  const { weightKg, payable } = useMemo(() => {
    let weight = 0;
    let total = 0;
    for (const row of rows) {
      weight += row.farm.dcWeight ?? row.trip.dcWeight ?? 0;
      total += row.farm.amount;
    }
    return { weightKg: weight, payable: total };
  }, [rows]);
  const headCell =
    'px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400';

  return (
    <>
      {/* Grand-total strip — the whole span at a glance, above the trips. */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-emerald-100 bg-white/70 px-4 py-2.5 dark:border-slate-700 dark:bg-slate-900/60">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-lime-700 dark:text-lime-300">
          <Sprout size={13} />
          {t('accounts.summary.farm_payment.title')}
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
      </div>

      {rows.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
          {t('accounts.summary.farm_table.empty')}
        </p>
      ) : (
        <>
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full min-w-[56rem] border-collapse text-[13px] leading-normal">
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
                </tr>
              </thead>
              <tbody>
                {pageRows.map(({ trip, farm }) => {
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
                            title={t('accounts.summary.farm_table.view_trip')}
                            aria-label={`${t('accounts.summary.farm_table.view_trip')} — ${trip.tripNo}`}
                            className="rounded text-emerald-700 underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-emerald-500 dark:text-emerald-300"
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
                </tr>
              </tfoot>
            </table>
          </div>
          <div className="shrink-0 border-t border-slate-200 bg-white/80 px-3 py-2 dark:border-slate-700 dark:bg-slate-900/80">
            <Pagination
              page={safePage}
              pageSize={pageSize}
              totalItems={rows.length}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(1);
              }}
              ariaLabel={t('accounts.summary.farm_payment.title')}
            />
          </div>
        </>
      )}
    </>
  );
}

/**
 * The Farm Payment figure in the expense table, as a trigger. Farm Payment is
 * the one expense that is not a Payment Register total — it is the farm bill of
 * the trips behind that very figure — so the amount itself is what you press to
 * see those trips. It carries no chip or row highlight of its own: the number
 * reads like every other cell, its dotted underline says "press me", and the
 * app's global tooltip says exactly what pressing it will show.
 * `formatINR` matches the page's own compact ₹L/₹Cr notation.
 */
export function SummaryFarmAmount({
  value,
  scopeLabel,
  trips,
  weightKg,
  onOpen,
}: {
  value: number;
  scopeLabel: string;
  /** Trips whose farm bills add up to `value`. */
  trips: number;
  /** Their pickup (DC) weight, so the figure can be checked at a glance. */
  weightKg: number;
  onOpen: () => void;
}) {
  const { t } = useI18n();
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`${t('accounts.summary.farm_row.open')} — ${scopeLabel}: ${formatINRExact(value)}`}
      className="group relative cursor-pointer rounded bg-transparent p-0 font-bold tabular-nums text-lime-700 underline decoration-lime-300 decoration-dotted underline-offset-[3px] outline-none transition hover:text-lime-900 hover:decoration-lime-600 hover:decoration-solid focus-visible:ring-2 focus-visible:ring-emerald-500 dark:text-lime-300 dark:decoration-lime-700 dark:hover:text-lime-200 dark:hover:decoration-lime-400"
    >
      {formatINR(value)}
      <ActionTooltip
        side="bottom"
        label={
          <span className="flex flex-col items-start gap-1 text-left">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300">{scopeLabel}</span>
            <span className="text-[13px] font-bold tabular-nums text-white" title={formatINRExact(value)}>
              {formatINRExact(value)}
            </span>
            <span className="text-[11px] font-medium tabular-nums text-slate-300">
              {t('accounts.summary.farm_row.tip_trips', { trips: formatCount(trips), weight: formatQuantity(weightKg) })}
            </span>
            <span className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-semibold text-lime-300">
              <Sprout size={11} aria-hidden="true" />
              {t('accounts.summary.farm_row.tip_open')}
            </span>
          </span>
        }
      />
    </button>
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
            {/* Animated logo — the sprout pops in over a breathing halo. */}
            <span aria-hidden="true" className="relative grid h-10 w-10 shrink-0 place-items-center">
              <span className="absolute inset-0 rounded-xl bg-lime-400/50 blur-[6px] animate-farm-halo" />
              <span className="relative grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-lime-500 to-emerald-600 text-white shadow-md animate-farm-logo">
                <Sprout size={19} strokeWidth={2.2} />
              </span>
            </span>
            <h2
              id="analysis-farm-viewer-title"
              className="text-sm font-bold tracking-wide text-slate-800 dark:text-slate-100"
            >
              {t('accounts.summary.farm_payment.title')}
            </h2>
            <span className="ml-auto inline-flex min-w-0 items-center gap-2">
              {/* The span, as a highlighted chip. */}
              {spanLabel && (
                <span className="inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[12px] font-bold text-emerald-800 shadow-sm dark:border-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200">
                  <CalendarDays size={13} aria-hidden="true" />
                  <span className="truncate" title={spanLabel}>{spanLabel}</span>
                </span>
              )}
              {/* Close — the app's animated X (action-close), same as every modal. */}
              <button
                type="button"
                onClick={onClose}
                aria-label={t('common.close')}
                title={t('common.close')}
                className="group/close grid h-9 w-9 shrink-0 place-items-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm outline-none transition-all hover:-translate-y-0.5 hover:border-red-100 hover:bg-red-50 hover:text-red-500 focus-visible:ring-2 focus-visible:ring-emerald-500 active:scale-95 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-red-900 dark:hover:bg-red-500/10 dark:hover:text-red-400"
              >
                <span className="inline-flex motion-safe:group-hover/close:animate-[var(--animate-action-close)]">
                  <X size={16} />
                </span>
              </button>
            </span>
          </div>
        </div>
        <SummaryFarmTable rows={rows} onOpenTrip={onOpenTrip} />
      </div>
    </AppShellModal>
  );
}

export default React.memo(SummaryFarmViewer);
