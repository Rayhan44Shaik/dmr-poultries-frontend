// src/modules/accounts/components/farm-payment/FarmPaymentTable.tsx

import React from 'react';
import type { Trip } from '../../../operations/vehicle-trips/types/trip';
import type { FarmPayment } from '../../types/farmPayment.types';
import { Lock, Eye } from 'lucide-react';
import { formatINR, formatINRExact, formatCount } from './farmPaymentFormat';

interface FarmPaymentTableProps {
  trips: Trip[];
  paymentData: Record<string, Partial<FarmPayment>>;
  onPaymentUpdate: (tripId: string, updates: Partial<FarmPayment>) => void;
  onPaymentSaved: () => void;
  onRefresh: () => void;
  showNotification: (message: string, type?: 'success' | 'error' | 'info') => void;
  /** Open the read-only trip view modal (full trip history) for a trip. */
  onViewTrip: (trip: Trip) => void;
  /** Empty-state message (the page distinguishes "no data" from "no match"). */
  emptyMessage?: string;
}

const FarmPaymentTable: React.FC<FarmPaymentTableProps> = ({
  trips,
  paymentData,
  onPaymentUpdate,
  onViewTrip,
  emptyMessage = 'No completed trips found',
}) => {
  const formatDate = (dateString: string) => {
    if (!dateString) return '\u2014';
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const isPaymentLocked = (tripId: string): boolean => {
    const payment = paymentData[String(tripId)];
    if (!payment) return false;
    return payment.paymentStatus === 'Paid' || payment.paymentStatus === 'Partially Paid';
  };

  // Locked (already paid/partial) rows show their saved rate read-only.
  const lockedRate = (value: number) => (
    <div className="flex items-center gap-1.5">
      <Lock size={12} className="text-slate-400" />
      <span className="text-sm font-semibold text-slate-700">
        {value > 0 ? `₹${value.toFixed(2)}` : '—'}
      </span>
    </div>
  );

  if (trips.length === 0) {
    return (
      <div className="p-8 text-center" role="status">
        <p className="text-slate-500 text-sm">{emptyMessage}</p>
      </div>
    );
  }

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
        <table className="w-full">
          <thead>
            <tr className="bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200">
              <th scope="col" className="px-3 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider whitespace-nowrap">Trip No</th>
              <th scope="col" className="px-3 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider whitespace-nowrap">Date</th>
              <th scope="col" className="px-3 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider whitespace-nowrap">Farm</th>
              <th scope="col" className="px-3 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider whitespace-nowrap">Vehicle</th>
              <th scope="col" className="px-3 py-2.5 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider whitespace-nowrap">Total Birds</th>
              <th scope="col" className="px-3 py-2.5 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider whitespace-nowrap">DC Wt (Kg)</th>
              <th scope="col" className="px-3 py-2.5 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider whitespace-nowrap">Rate/Kg (₹)</th>
              <th scope="col" className="px-3 py-2.5 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider whitespace-nowrap">Total Amount</th>
              <th scope="col" className="px-3 py-2.5 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider whitespace-nowrap">Trip</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {trips.map((trip, index) => {
              const payment = paymentData[String(trip.id)] || {};
              
              const totalBirdsLoaded = trip.totalBirds || 0;
              const dcWeight = trip.dcWeight || 0;
              const ratePerKg = payment.ratePerKg || 0;
              // Weight-based pricing: Rate/Kg × DC weight.
              const totalAmount = payment.totalAmount || dcWeight * ratePerKg;
              // Rows whose settlement is already recorded stay read-only. The
              // page shows no paid/unpaid status: this table is about the rate
              // and the amount, nothing else.
              const locked = isPaymentLocked(String(trip.id));
              // One background per row: locked rows keep their tint, otherwise the
              // rows alternate — so hover and the stripe never fight over the same
              // utility and resolve by CSS source order.
              const rowTone = locked ? 'bg-slate-50/60' : index % 2 ? 'bg-slate-50/25' : '';

              return (
                <tr
                  key={trip.id}
                  className={`transition-colors duration-150 hover:bg-indigo-50/60 ${rowTone}`}
                >
                  <td className="px-3 py-2.5 text-sm font-medium text-slate-800 whitespace-nowrap">
                    {trip.tripNo}
                  </td>
                  <td className="px-3 py-2.5 text-sm text-slate-600 whitespace-nowrap">
                    {formatDate(trip.tripDate)}
                  </td>
                  <td className="px-3 py-2.5 text-sm text-slate-600 whitespace-nowrap">
                    {trip.sourceFarm}
                  </td>
                  <td className="px-3 py-2.5 text-sm text-slate-600 whitespace-nowrap">
                    {trip.vehicleNo}
                  </td>
                  <td className="px-3 py-2.5 text-sm text-right text-slate-800 font-bold whitespace-nowrap">
                    {formatCount(totalBirdsLoaded)}
                  </td>
                  <td className="px-3 py-2.5 text-sm text-right text-slate-700 font-medium whitespace-nowrap">
                    {dcWeight > 0 ? dcWeight.toFixed(2) : '—'}
                  </td>
                  <td className="px-3 py-2.5">
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
                          aria-label={`Rate per kg for trip ${trip.tripNo}`}
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
                          className="hide-spinner w-20 px-2 py-1 text-sm text-right border border-slate-200 rounded focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none bg-white"
                        />
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-sm text-right font-bold whitespace-nowrap text-slate-800" title={formatINRExact(totalAmount)}>
                    {formatINR(totalAmount)}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <button
                      type="button"
                      onClick={() => onViewTrip(trip)}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:border-indigo-300 hover:text-indigo-600 hover:shadow focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      title={`View trip history — ${trip.tripNo}`}
                      aria-label={`View trip history for ${trip.tripNo}`}
                    >
                      <Eye size={14} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
};

export { FarmPaymentTable };
export default FarmPaymentTable;