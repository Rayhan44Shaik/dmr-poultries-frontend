// src/modules/accounts/components/farm-payment/FarmPaymentTable.tsx

import React, { useState, useEffect, useCallback } from 'react';
import { Trip } from '../../../operations/vehicle-trips/types/trip';
import { FarmPayment } from '../../types/farmPayment.types';
import { FarmPaymentService } from '../../services/FarmPaymentService';
import { Save, RefreshCw } from 'lucide-react';

interface FarmPaymentTableProps {
  trips: Trip[];
  onPaymentSaved: () => void;
  onRefresh?: () => void;
  showNotification?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export function FarmPaymentTable({ 
  trips, 
  onPaymentSaved, 
  onRefresh,
  showNotification 
}: FarmPaymentTableProps) {
  const [rateValues, setRateValues] = useState<Record<number, number>>({});
  const [remarkValues, setRemarkValues] = useState<Record<number, string>>({});
  const [savingStates, setSavingStates] = useState<Record<number, boolean>>({});
  const [isSavingAll, setIsSavingAll] = useState(false);

  // Load rates and remarks from FarmPaymentService whenever trips change
  useEffect(() => {
    if (trips.length === 0) {
      setRateValues({});
      setRemarkValues({});
      return;
    }

    const rates: Record<number, number> = {};
    const remarks: Record<number, string> = {};

    trips.forEach((trip) => {
      const payment = FarmPaymentService.getByTripId(trip.id);
      if (payment) {
        rates[trip.id] = payment.rate;
        remarks[trip.id] = payment.remarks || '';
      } else {
        rates[trip.id] = 0;
        remarks[trip.id] = '';
      }
    });

    setRateValues(rates);
    setRemarkValues(remarks);
  }, [trips]);

  const handleRateChange = useCallback((tripId: number, value: number) => {
    const payment = FarmPaymentService.getByTripId(tripId);
    // If paid, don't allow changes
    if (payment && payment.status === 'Paid') {
      showNotification?.('Cannot edit rate – payment is already marked as Paid.', 'error');
      return;
    }
    setRateValues((prev) => ({ ...prev, [tripId]: value }));
  }, [showNotification]);

  const handleRemarkChange = useCallback((tripId: number, value: string) => {
    const payment = FarmPaymentService.getByTripId(tripId);
    // If paid, don't allow changes
    if (payment && payment.status === 'Paid') {
      showNotification?.('Cannot edit remarks – payment is already marked as Paid.', 'error');
      return;
    }
    setRemarkValues((prev) => ({ ...prev, [tripId]: value }));
  }, [showNotification]);

  const handleSaveAll = useCallback(async () => {
    // Debug: Log current rate values
    console.log('Current rate values:', rateValues);
    console.log('Trips:', trips);

    const tripsToSave = trips.filter((trip) => {
      const rate = rateValues[trip.id] || 0;
      const hasValidRate = rate >= 1;
      console.log(`Trip ${trip.id} - ${trip.tripNo}: rate=${rate}, valid=${hasValidRate}`);
      return hasValidRate;
    });

    if (tripsToSave.length === 0) {
      showNotification?.('No rows with valid rate to save. Please enter a rate >= 1.', 'error');
      return;
    }

    setIsSavingAll(true);
    let savedCount = 0;

    for (const trip of tripsToSave) {
      const rate = rateValues[trip.id] || 0;
      const remarks = remarkValues[trip.id] || '';
      
      const existingPayment = FarmPaymentService.getByTripId(trip.id);
      
      // If already paid, skip saving
      if (existingPayment && existingPayment.status === 'Paid') {
        continue;
      }
      
      // Set status to Unpaid
      const status: 'Unpaid' | 'Paid' = 'Unpaid';

      setSavingStates((prev) => ({ ...prev, [trip.id]: true }));

      const totalBirdsIncludingMortality = trip.totalBirds + trip.totalMortality;

      const paymentData = {
        tripId: trip.id,
        tripNo: trip.tripNo,
        tripDate: trip.tripDate,
        vehicleNo: trip.vehicleNo,
        farmName: trip.sourceFarm || '',
        dcWeight: trip.dcWeight || 0,
        totalBirds: totalBirdsIncludingMortality,
        rate: rate,
        amount: rate * (trip.dcWeight || 0),
        remarks: remarks,
        status: status,
      };

      try {
        FarmPaymentService.save(paymentData);
        savedCount++;
        console.log(`Saved trip ${trip.tripNo} with rate ${rate}`);
      } catch (error) {
        console.error(`Failed to save trip ${trip.tripNo}:`, error);
        showNotification?.(`Failed to save trip ${trip.tripNo}`, 'error');
      } finally {
        setSavingStates((prev) => ({ ...prev, [trip.id]: false }));
      }
    }

    setIsSavingAll(false);
    if (savedCount > 0) {
      // Refresh the data after saving
      const updatedRates: Record<number, number> = {};
      const updatedRemarks: Record<number, string> = {};
      
      trips.forEach((trip) => {
        const payment = FarmPaymentService.getByTripId(trip.id);
        if (payment) {
          updatedRates[trip.id] = payment.rate;
          updatedRemarks[trip.id] = payment.remarks || '';
        } else {
          updatedRates[trip.id] = 0;
          updatedRemarks[trip.id] = '';
        }
      });
      
      setRateValues(updatedRates);
      setRemarkValues(updatedRemarks);
      
      onPaymentSaved();
      showNotification?.(`${savedCount} payment(s) saved successfully.`, 'success');
    } else {
      showNotification?.('No payments were saved.', 'error');
    }
  }, [trips, rateValues, remarkValues, showNotification, onPaymentSaved]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount || 0);
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  // Get payment status for a trip
  const getPaymentStatus = (tripId: number): { isPaid: boolean } => {
    const payment = FarmPaymentService.getByTripId(tripId);
    return {
      isPaid: payment?.status === 'Paid' || false,
    };
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-slate-50/80 border-b border-slate-200">
        <h2 className="text-lg font-semibold text-slate-800">Trip Details</h2>
        <div className="flex flex-wrap items-center gap-3">
          {onRefresh && (
            <button
              onClick={() => {
                onRefresh();
                showNotification?.('Refreshed', 'info');
              }}
              className="p-2 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 transition bg-white flex items-center gap-1.5 text-sm font-medium"
              title="Refresh"
            >
              <RefreshCw size={16} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          )}
          <button
            onClick={handleSaveAll}
            disabled={isSavingAll}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition flex items-center gap-1.5 ${
              isSavingAll
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm'
            }`}
          >
            <Save size={16} />
            {isSavingAll ? 'Saving...' : 'Save All'}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 whitespace-nowrap">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-3 py-3 text-left text-xs font-semibold text-slate-600 uppercase min-w-[100px]">Date</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-slate-600 uppercase min-w-[130px]">Trip No</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-slate-600 uppercase min-w-[110px]">Vehicle</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-slate-600 uppercase min-w-[130px]">Farm</th>
              <th className="px-3 py-3 text-right text-xs font-semibold text-slate-600 uppercase min-w-[80px]">Birds</th>
              <th className="px-3 py-3 text-right text-xs font-semibold text-slate-600 uppercase min-w-[80px]">DC Weight (kg)</th>
              <th className="px-3 py-3 text-right text-xs font-semibold text-slate-600 uppercase min-w-[90px]">Rate (₹/kg)</th>
              <th className="px-3 py-3 text-right text-xs font-semibold text-slate-600 uppercase min-w-[160px]">Amount (₹)</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-slate-600 uppercase min-w-[140px]">Remarks</th>
              <th className="px-3 py-3 text-center text-xs font-semibold text-slate-600 uppercase min-w-[90px]">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {trips.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-slate-500 text-sm">
                  No trips found.
                </td>
              </tr>
            ) : (
              trips.map((trip) => {
                const rate = rateValues[trip.id] || 0;
                const dcWeight = trip.dcWeight || 0;
                const amount = rate * dcWeight;
                const totalBirdsIncludingMortality = trip.totalBirds + trip.totalMortality;
                const { isPaid } = getPaymentStatus(trip.id);
                const isRateDisabled = isPaid;

                let statusDisplay = null;
                if (isPaid) {
                  statusDisplay = (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
                      Paid
                    </span>
                  );
                } else if (rate >= 1) {
                  statusDisplay = (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                      Unpaid
                    </span>
                  );
                } else {
                  statusDisplay = (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-500">
                      -
                    </span>
                  );
                }

                return (
                  <tr key={trip.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-3 py-3 text-sm text-slate-700 whitespace-nowrap">
                      {formatDate(trip.tripDate)}
                    </td>
                    <td className="px-3 py-3 text-sm font-mono text-slate-700 whitespace-nowrap">
                      {trip.tripNo}
                    </td>
                    <td className="px-3 py-3 text-sm text-slate-700 whitespace-nowrap">
                      {trip.vehicleNo}
                    </td>
                    <td className="px-3 py-3 text-sm text-slate-700 whitespace-nowrap">
                      {trip.sourceFarm}
                    </td>
                    <td className="px-3 py-3 text-sm text-right text-slate-700 whitespace-nowrap">
                      {totalBirdsIncludingMortality.toLocaleString()}
                    </td>
                    <td className="px-3 py-3 text-sm text-right font-medium text-slate-800 whitespace-nowrap">
                      {dcWeight.toFixed(2)}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={rate || ''}
                        onChange={(e) => handleRateChange(trip.id, parseFloat(e.target.value) || 0)}
                        disabled={isRateDisabled}
                        className={`w-24 px-2 py-1 rounded-lg border border-slate-300 text-sm text-right focus:ring-2 focus:ring-blue-400 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                          isRateDisabled ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'bg-white'
                        }`}
                        placeholder="0.00"
                      />
                    </td>
                    <td className="px-3 py-3 text-sm text-right font-bold text-emerald-600 whitespace-nowrap min-w-[160px]">
                      {rate >= 1 ? formatCurrency(amount) : '-'}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap min-w-[140px]">
                      <input
                        type="text"
                        value={remarkValues[trip.id] || ''}
                        onChange={(e) => handleRemarkChange(trip.id, e.target.value)}
                        disabled={isRateDisabled}
                        className={`w-full min-w-[120px] px-2 py-1 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-blue-400 outline-none ${
                          isRateDisabled ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'bg-white'
                        }`}
                        placeholder="Remarks"
                      />
                    </td>
                    <td className="px-3 py-3 text-center whitespace-nowrap">
                      {statusDisplay}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}