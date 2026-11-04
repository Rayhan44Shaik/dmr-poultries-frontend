// src/modules/accounts/components/farm-payment/FarmPaymentTable.tsx
//
// The Farm Payment register table — the Trip List's exact table language:
// a leading S.No column, an icon glyph on every column header, the
// Day column rendered as `Fri, 11 Sep 2026` via formatTripListDay, and the
// animated "Loading Farm Payment records…" state while rows are in flight.

import React, { useState } from 'react';
import type { FarmPaymentDisplayRow } from '../../services/farmPaymentApiService';
import {
  Lock,
  Eye,
  Hash,
  Calendar,
  Warehouse,
  Truck,
  Bird,
  Scale,
  IndianRupee,
  Wallet,
  Loader2,
} from 'lucide-react';
import { formatINR, formatINRExact, formatCount } from './farmPaymentFormat';
import { formatTripListDay } from '../../../operations/vehicle-trips/utils/formatTripListDay';
import { localizeTripViewText } from '../../../operations/vehicle-trips/utils/tripViewLocalization';
import { formatVehicleNumber } from '../../../../utils/format';
import { useI18n } from '../../../../i18n';

interface FarmPaymentTableProps {
  rows: FarmPaymentDisplayRow[];
  /** Live rate edit for one display row (marks only that row dirty). */
  onRateChange: (row: FarmPaymentDisplayRow, rate: number) => void;
  /** Rows are loading — show the animated register loading state. */
  loading?: boolean;
  /** Open the read-only trip view modal for the row's parent trip. */
  onViewTrip: (row: FarmPaymentDisplayRow) => void;
  /** Empty-state message (the page distinguishes "no data" from "no match"). */
  emptyMessage?: string;
  /** Zero-based index of the first row, so S.No survives paging like the Trip List. */
  startIndex?: number;
}

/** Animated "loading the register" state — same treatment as the Trip List. */
function LoadingState() {
  const { t } = useI18n();
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-4 py-14" role="status">
      <Loader2 size={22} className="animate-spin text-emerald-500" aria-hidden="true" />
      <p className="text-sm font-medium text-slate-500">{t('accounts.farmpay.loading')}</p>
    </div>
  );
}

const FarmPaymentTable: React.FC<FarmPaymentTableProps> = ({
  rows,
  onRateChange,
  loading = false,
  onViewTrip,
  emptyMessage,
  startIndex = 0,
}) => {
  const { t, language } = useI18n();
  // Per-row edit drafts: typing never writes into the page state until it is
  // a committable rate, so an empty field is a real editing state — not a
  // zero — and a rejected keystroke can never corrupt the live amount.
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [focusedKey, setFocusedKey] = useState<string | null>(null);

  const isRowLocked = (row: FarmPaymentDisplayRow): boolean =>
    row.status === 'Paid' || row.status === 'Partially Paid';

  const commitDraft = (row: FarmPaymentDisplayRow) => {
    const draft = drafts[row.key];
    setFocusedKey((current) => (current === row.key ? null : current));
    if (draft === undefined) return;
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[row.key];
      return next;
    });
    const parsed = parseRateDraft(draft);
    // Empty/invalid on commit → revert to the authoritative row rate; the
    // page state was never polluted, so nothing needs undoing.
    if (parsed == null) return;
    if (parsed !== row.rate) onRateChange(row, parsed);
  };

  const revertDraft = (rowKey: string) => {
    setDrafts((prev) => {
      if (!(rowKey in prev)) return prev;
      const next = { ...prev };
      delete next[rowKey];
      return next;
    });
    setFocusedKey((current) => (current === rowKey ? null : current));
  };

  /** Partial decimal text the user may still be typing ("" = empty editing state). */
  const isDraftText = (text: string): boolean => /^\d*\.?\d*$/.test(text);

  /** Committable rate: finite, non-negative, no NaN/Infinity/exponent. Empty → null. */
  function parseRateDraft(text: string): number | null {
    if (text.trim() === '') return null;
    if (!isDraftText(text)) return null;
    const parsed = Number(text);
    if (!Number.isFinite(parsed) || parsed < 0) return null;
    return parsed;
  }

  // Locked (already paid/partial) rows show their saved rate read-only —
  // a light red pill so a settled rate reads as "locked" at a glance.
  // Only the LOCK GLYPH carries the light red "locked" signal — the rate
  // itself stays neutral slate so the figure reads like every other number.
  const lockedRate = (value: number) => (
    <span className="inline-flex items-center gap-1.5 rounded-lg border border-rose-100 bg-rose-50/80 px-2.5 py-1 shadow-sm">
      <Lock size={12} className="text-rose-400 shrink-0" aria-hidden="true" />
      <span className="text-sm font-semibold text-slate-700 tabular-nums whitespace-nowrap">
        {value > 0 ? `₹${value.toFixed(2)}` : '—'}
      </span>
    </span>
  );

  // Each column header carries its own glyph — the same icon-label language
  // as the Trip List's master table. S.No is plain and centred, like the
  // Trip List's leading serial column.
  const columns: { key: string; label: string; icon?: React.ReactNode; align?: 'right' | 'center' }[] = [
    { key: 'sno', label: t('table.s_no'), align: 'center' },
    { key: 'tripNo', label: t('operations.trip_no'), icon: <Hash size={14} className="text-slate-400 flex-shrink-0" /> },
    { key: 'day', label: t('ops.trip.day'), icon: <Calendar size={14} className="text-blue-500 flex-shrink-0" /> },
    { key: 'farm', label: t('ops.trip.source_farm'), icon: <Warehouse size={14} className="text-amber-500 flex-shrink-0" /> },
    { key: 'vehicle', label: t('common.vehicle'), icon: <Truck size={14} className="text-indigo-500 flex-shrink-0" /> },
    { key: 'birds', label: t('accounts.farmpay.col_dc_birds'), icon: <Bird size={14} className="text-blue-500 flex-shrink-0" />, align: 'right' },
    { key: 'dcWeight', label: t('accounts.farmpay.col_dc_weight'), icon: <Scale size={14} className="text-orange-500 flex-shrink-0" />, align: 'right' },
    { key: 'rate', label: t('accounts.farmpay.col_rate'), icon: <IndianRupee size={14} className="text-emerald-500 flex-shrink-0" />, align: 'right' },
    { key: 'amount', label: t('accounts.farmpay.col_amount'), icon: <Wallet size={14} className="text-emerald-600 flex-shrink-0" />, align: 'right' },
    { key: 'trip', label: t('accounts.farmpay.col_trip'), icon: <Eye size={14} className="text-slate-400 flex-shrink-0" />, align: 'center' },
  ];

  return (
    <>
      <style>{`
        .hide-spinner::-webkit-inner-spin-button,
        .hide-spinner::-webkit-outer-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        .hide-spinner {
          -moz-appearance: textfield;
          appearance: textfield;
        }
      `}</style>
      <div className="overflow-x-auto overflow-y-visible">
        <table className="w-full min-w-full border-collapse text-left">
          <caption className="sr-only">{t('accounts.farmpay.table_caption')}</caption>
          <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600">
            <tr className="whitespace-nowrap">
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  className={`px-4 py-4 text-[12px] font-bold uppercase tracking-wider ${
                    col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                  } ${col.key === 'sno' ? 'w-12' : ''}`}
                >
                  {col.icon ? (
                    <div
                      className={`flex items-center gap-1.5 ${
                        col.align === 'right' ? 'justify-end' : col.align === 'center' ? 'justify-center' : ''
                      }`}
                    >
                      {col.icon}
                      <span>{col.label}</span>
                    </div>
                  ) : (
                    <span>{col.label}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={columns.length}>
                  <LoadingState />
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="py-12 text-center text-slate-400 text-[13px] font-medium" role="status">
                  {emptyMessage ?? t('accounts.farmpay.empty_no_data')}
                </td>
              </tr>
            ) : (
              rows.map((row, index) => {
                const locked = isRowLocked(row);
                // One background per row: locked rows keep their tint, otherwise
                // the rows alternate — the Trip List's zebra striping.
                const rowTone = locked ? 'bg-slate-50/60' : index % 2 === 0 ? 'bg-white' : 'bg-slate-50/20';
                const serialNo = startIndex + index + 1;
                const draftActive = focusedKey === row.key;
                const inputValue = draftActive ? (drafts[row.key] ?? '') : row.rate > 0 ? String(row.rate) : '';

                return (
                  <tr key={row.key} className={`transition-colors duration-150 hover:bg-slate-50/60 ${rowTone}`}>
                    <td className="px-4 py-4 text-center text-[13px] text-slate-500 font-medium w-12 tabular-nums">
                      {serialNo}
                    </td>
                    {/* Identifiers stay in their stored Latin/numeric form in every
                        language: the trip number and vehicle number are codes, not
                        prose, so Telugu never transliterates them. */}
                    <td className="px-4 py-4 text-[13px] font-bold text-emerald-600 whitespace-nowrap">
                      {row.displayTripNo}
                    </td>
                    <td className="px-4 py-4 text-[13px] font-medium text-slate-600 whitespace-nowrap">
                      {formatTripListDay(row.tripDate, language)}
                    </td>
                    <td className="px-4 py-4 text-[13px] font-medium text-slate-700 whitespace-nowrap">
                      {localizeTripViewText(row.farm, language)}
                    </td>
                    <td className="px-4 py-4 text-[13px] text-slate-600 whitespace-nowrap">
                      {formatVehicleNumber(row.vehicleNo)}
                      {row.isRentedVehicle ? <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">Rental</span> : null}
                    </td>
                    <td className="px-4 py-4 text-[13px] text-right font-bold text-blue-600 whitespace-nowrap tabular-nums">
                      {formatCount(row.birds)}
                    </td>
                    <td className="px-4 py-4 text-[13px] text-right font-medium text-slate-700 whitespace-nowrap tabular-nums">
                      {row.dcWeight > 0 ? row.dcWeight.toFixed(2) : '—'}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex justify-end">
                        {locked ? (
                          lockedRate(row.rate)
                        ) : (
                          <input
                            type="text"
                            inputMode="decimal"
                            value={inputValue}
                            aria-label={t('accounts.farmpay.rate_aria', { no: row.displayTripNo })}
                            onFocus={() => {
                              setFocusedKey(row.key);
                              setDrafts((prev) => (row.key in prev ? prev : { ...prev, [row.key]: row.rate > 0 ? String(row.rate) : '' }));
                            }}
                            onChange={(e) => {
                              const text = e.target.value;
                              // Reject anything that is not a non-negative
                              // decimal in progress: no minus, no exponent,
                              // no second dot — the keystroke simply lands
                              // nowhere instead of corrupting the amount.
                              if (!isDraftText(text)) return;
                              setDrafts((prev) => ({ ...prev, [row.key]: text }));
                              const parsed = parseRateDraft(text);
                              // Empty stays an editing state: it never becomes
                              // a zero and never marks the row dirty.
                              if (parsed == null) return;
                              onRateChange(row, parsed);
                            }}
                            onBlur={() => commitDraft(row)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                              else if (e.key === 'Escape') revertDraft(row.key);
                            }}
                            // A wheel over the field must never nudge the rate:
                            // drop focus (committing the current draft) instead.
                            onWheel={(e) => (e.target as HTMLInputElement).blur()}
                            placeholder="0.00"
                            className="hide-spinner w-20 px-2 py-1 text-sm text-right border border-slate-200 rounded focus:ring-2 focus:ring-emerald-400 focus:border-transparent outline-none bg-white transition-shadow"
                          />
                        )}
                      </div>
                    </td>
                    <td
                      className="px-4 py-4 text-[13px] text-right font-bold whitespace-nowrap text-slate-800 tabular-nums"
                      title={formatINRExact(row.amount)}
                    >
                      {formatINR(row.amount)}
                    </td>
                    <td className="px-4 py-4 text-center">
                      <button
                        type="button"
                        onClick={() => onViewTrip(row)}
                        className="group inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:border-emerald-300 hover:text-emerald-600 hover:shadow focus:outline-none focus:ring-2 focus:ring-emerald-400"
                        aria-label={t('accounts.farmpay.view_trip_aria', { no: row.displayTripNo })}
                      >
                        <span className="inline-flex motion-safe:group-hover:animate-[var(--animate-action-view)]">
                          <Eye size={14} />
                        </span>
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </>
  );
};

export { FarmPaymentTable };
export default FarmPaymentTable;
