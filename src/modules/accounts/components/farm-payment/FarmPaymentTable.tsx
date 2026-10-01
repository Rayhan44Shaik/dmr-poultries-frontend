// src/modules/accounts/components/farm-payment/FarmPaymentTable.tsx
//
// The Farm Payment register table — the Trip List's exact table language:
// a leading S.No column, an icon glyph on every column header, the
// Day column rendered as `Fri, 11 Sep 2026` via formatTripListDay, and the
// animated "Loading Farm Payment records…" state while rows are in flight.

import React from 'react';
import type { Trip } from '../../../operations/vehicle-trips/types/trip';
import type { FarmPayment } from '../../types/farmPayment.types';
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
  trips: Trip[];
  paymentData: Record<string, Partial<FarmPayment>>;
  onPaymentUpdate: (tripId: string, updates: Partial<FarmPayment>) => void;
  /** Rows are loading — show the animated register loading state. */
  loading?: boolean;
  /** Open the read-only trip view modal (full trip history) for a trip. */
  onViewTrip: (trip: Trip) => void;
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
  trips,
  paymentData,
  onPaymentUpdate,
  loading = false,
  onViewTrip,
  emptyMessage,
  startIndex = 0,
}) => {
  const { t, language } = useI18n();

  const isPaymentLocked = (tripId: string): boolean => {
    const payment = paymentData[String(tripId)];
    if (!payment) return false;
    return payment.paymentStatus === 'Paid' || payment.paymentStatus === 'Partially Paid';
  };

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
            ) : trips.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="py-12 text-center text-slate-400 text-[13px] font-medium" role="status">
                  {emptyMessage ?? t('accounts.farmpay.empty_no_data')}
                </td>
              </tr>
            ) : (
              trips.map((trip, index) => {
                const payment = paymentData[String(trip.id)] || {};

                // The Farm Payments API is authoritative here: it reads the
                // Step 3 pickup/DC columns directly for completed trips.
                const totalBirdsLoaded = Number(payment.totalBirds ?? trip.totalBirds ?? 0);
                const dcWeight = Number(payment.dcWeight ?? trip.dcWeight ?? 0);
                const ratePerKg = payment.ratePerKg || 0;
                // Weight-based pricing: Rate/Kg × DC weight.
                const totalAmount = payment.totalAmount || dcWeight * ratePerKg;
                // Rows whose settlement is already recorded stay read-only. The
                // page shows no paid/unpaid status: this table is about the rate
                // and the amount, nothing else.
                const locked = isPaymentLocked(String(trip.id));
                // One background per row: locked rows keep their tint, otherwise
                // the rows alternate — the Trip List's zebra striping.
                const rowTone = locked ? 'bg-slate-50/60' : index % 2 === 0 ? 'bg-white' : 'bg-slate-50/20';
                const serialNo = startIndex + index + 1;

                return (
                  <tr key={trip.id} className={`transition-colors duration-150 hover:bg-slate-50/60 ${rowTone}`}>
                    <td className="px-4 py-4 text-center text-[13px] text-slate-500 font-medium w-12 tabular-nums">
                      {serialNo}
                    </td>
                    {/* Identifiers stay in their stored Latin/numeric form in every
                        language: the trip number and vehicle number are codes, not
                        prose, so Telugu never transliterates them. */}
                    <td className="px-4 py-4 text-[13px] font-bold text-emerald-600 whitespace-nowrap">
                      {trip.tripNo}
                    </td>
                    <td className="px-4 py-4 text-[13px] font-medium text-slate-600 whitespace-nowrap">
                      {formatTripListDay(trip.tripDate, language)}
                    </td>
                    <td className="px-4 py-4 text-[13px] font-medium text-slate-700 whitespace-nowrap">
                      {localizeTripViewText(payment.farmName ?? trip.sourceFarm, language)}
                    </td>
                    <td className="px-4 py-4 text-[13px] text-slate-600 whitespace-nowrap">
                      {formatVehicleNumber(trip.vehicleNo)}
                    </td>
                    <td className="px-4 py-4 text-[13px] text-right font-bold text-blue-600 whitespace-nowrap tabular-nums">
                      <div>{formatCount(totalBirdsLoaded)}</div>
                      {(payment.loads?.length ?? 0) > 1 && (
                        <div className="mt-1 space-y-0.5 text-[10px] font-semibold text-slate-400">
                          {payment.loads?.map((load) => (
                            <div key={load.load}>L{load.load}: {formatCount(load.totalBirds)}</div>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-4 text-[13px] text-right font-medium text-slate-700 whitespace-nowrap tabular-nums">
                      <div>{dcWeight > 0 ? dcWeight.toFixed(2) : '—'}</div>
                      {(payment.loads?.length ?? 0) > 1 && (
                        <div className="mt-1 space-y-0.5 text-[10px] font-semibold text-slate-400">
                          {payment.loads?.map((load) => (
                            <div key={load.load}>L{load.load}: {Number(load.dcWeight).toFixed(2)}</div>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex justify-end">
                        {locked ? (
                          lockedRate(ratePerKg)
                        ) : (
                          <input
                            type="number"
                            value={ratePerKg || ''}
                            min={0}
                            step="0.01"
                            inputMode="decimal"
                            aria-label={t('accounts.farmpay.rate_aria', { no: trip.tripNo })}
                            onChange={(e) => {
                              // A rate is never negative: clamp pasted/typed
                              // negative values to 0 so the live total can never
                              // disagree with what Save will persist (the save
                              // filter already ignores non-positive rates).
                              const rate = Math.max(0, parseFloat(e.target.value) || 0);
                              const newTotal = dcWeight * rate;
                              onPaymentUpdate(String(trip.id), {
                                ratePerKg: rate,
                                ratePerBird: 0,
                                totalAmount: newTotal,
                                totalBirds: totalBirdsLoaded,
                                dcWeight: dcWeight,
                              });
                            }}
                            placeholder="0.00"
                            className="hide-spinner w-20 px-2 py-1 text-sm text-right border border-slate-200 rounded focus:ring-2 focus:ring-emerald-400 focus:border-transparent outline-none bg-white transition-shadow"
                          />
                        )}
                      </div>
                    </td>
                    <td
                      className="px-4 py-4 text-[13px] text-right font-bold whitespace-nowrap text-slate-800 tabular-nums"
                      title={formatINRExact(totalAmount)}
                    >
                      {formatINR(totalAmount)}
                    </td>
                    <td className="px-4 py-4 text-center">
                      <button
                        type="button"
                        onClick={() => onViewTrip(trip)}
                        className="group inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:border-emerald-300 hover:text-emerald-600 hover:shadow focus:outline-none focus:ring-2 focus:ring-emerald-400"
                        aria-label={t('accounts.farmpay.view_trip_aria', { no: trip.tripNo })}
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
