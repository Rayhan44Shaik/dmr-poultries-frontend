// src/modules/accounts/components/farm-payment/FarmPaymentTable.tsx

import React, { useState } from 'react';
import type { Trip } from '../../../operations/vehicle-trips/types/trip';
import type { FarmPayment } from '../../types/farmPayment.types';
import { BadgeCheck, AlertTriangle, Clock, Lock, Eye } from 'lucide-react';

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
  const [tooltipTripId, setTooltipTripId] = useState<string | null>(null);

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatCurrency = (amount: number): string => {
    if (amount >= 10000000) {
      return `₹${(amount / 10000000).toFixed(2)} Cr`;
    }
    if (amount >= 100000) {
      return `₹${(amount / 100000).toFixed(2)} L`;
    }
    return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const getPaymentStatusBadge = (tripId: string, totalAmount: number, paidAmount: number, balance: number) => {
    const payment = paymentData[String(tripId)];
    const status = payment?.paymentStatus || 'Unpaid';

    switch (status) {
      case 'Paid':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-semibold border border-emerald-200">
            <BadgeCheck size={12} /> Paid
          </span>
        );
      case 'Partially Paid':
        return (
          <div className="relative inline-block">
            <span
              className="inline-flex items-center gap-1 px-2 py-1 bg-orange-50 text-orange-700 rounded-full text-xs font-semibold border border-orange-200 cursor-help"
              tabIndex={0}
              onMouseEnter={() => setTooltipTripId(tripId)}
              onMouseLeave={() => setTooltipTripId(null)}
              onFocus={() => setTooltipTripId(tripId)}
              onBlur={() => setTooltipTripId(null)}
            >
              <AlertTriangle size={12} /> Partial
            </span>
            {tooltipTripId === tripId && (
              <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-slate-800 text-white text-xs rounded-lg shadow-lg whitespace-nowrap pointer-events-none">
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-slate-300">Total:</span>
                    <span className="font-semibold">{formatCurrency(totalAmount)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-slate-300">Paid:</span>
                    <span className="font-semibold text-emerald-400">{formatCurrency(paidAmount)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4 border-t border-slate-600 pt-1">
                    <span className="text-slate-300">Balance:</span>
                    <span className="font-semibold text-orange-400">{formatCurrency(balance)}</span>
                  </div>
                </div>
                <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1">
                  <div className="border-4 border-transparent border-t-slate-800"></div>
                </div>
              </div>
            )}
          </div>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-50 text-red-700 rounded-full text-xs font-semibold border border-red-200">
            <Clock size={12} /> Unpaid
          </span>
        );
    }
  };

  const getAmountColorClass = (status: string) => {
    switch (status) {
      case 'Paid':
        return 'text-emerald-600';
      case 'Partially Paid':
        return 'text-orange-600';
      default:
        return 'text-red-600';
    }
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
              <th scope="col" className="px-3 py-2.5 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider whitespace-nowrap">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {trips.map((trip) => {
              const payment = paymentData[String(trip.id)] || {};
              
              const totalBirdsLoaded = trip.totalBirds || 0;
              const dcWeight = trip.dcWeight || 0;
              const ratePerKg = payment.ratePerKg || 0;
              // Weight-based pricing: Rate/Kg × DC weight.
              const totalAmount = payment.totalAmount || dcWeight * ratePerKg;
              const paidAmount = payment.amountPaid || 0;
              const balance = totalAmount - paidAmount;
              const paymentStatus = payment.paymentStatus || 
                                   (paidAmount > 0 ? (paidAmount >= totalAmount ? 'Paid' : 'Partially Paid') : 'Unpaid');
              const locked = isPaymentLocked(String(trip.id));

              const amountColorClass = getAmountColorClass(paymentStatus);

              return (
                <tr key={trip.id} className={`hover:bg-slate-50/50 transition-colors ${locked ? 'bg-slate-50/30' : ''}`}>
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
                    {totalBirdsLoaded.toLocaleString('en-IN')}
                  </td>
                  <td className="px-3 py-2.5 text-sm text-right text-slate-700 font-medium whitespace-nowrap">
                    {dcWeight > 0 ? dcWeight.toFixed(2) : '-'}
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
                  <td className={`px-3 py-2.5 text-sm text-right font-bold whitespace-nowrap ${amountColorClass}`}>
                    {formatCurrency(totalAmount)}
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
                  <td className="px-3 py-2.5 text-center">
                    {getPaymentStatusBadge(String(trip.id), totalAmount, paidAmount, balance)}
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