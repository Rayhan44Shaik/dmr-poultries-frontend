import React, { useState, useEffect } from 'react';
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
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (trips.length === 0) return;

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

    if (!isInitialized) {
      setRateValues(rates);
      setRemarkValues(remarks);
      setIsInitialized(true);
    } else {
      const newTripIds = trips.filter(trip => !(trip.id in rateValues));
      if (newTripIds.length > 0) {
        const newRates = { ...rateValues };
        const newRemarks = { ...remarkValues };
        newTripIds.forEach(trip => {
          newRates[trip.id] = 0;
          newRemarks[trip.id] = '';
        });
        setRateValues(newRates);
        setRemarkValues(newRemarks);
      }
    }
  }, [trips]);

  const handleRateChange = (tripId: number, value: number) => {
    const payment = FarmPaymentService.getByTripId(tripId);
    if (payment?.status === 'Paid') {
      showNotification?.('Cannot edit rate – payment is already marked as Paid.', 'error');
      return;
    }
    setRateValues((prev) => ({ ...prev, [tripId]: value }));
  };

  const handleRemarkChange = (tripId: number, value: string) => {
    setRemarkValues((prev) => ({ ...prev, [tripId]: value }));
  };

  const handleSaveAll = async () => {
    const tripsToSave = trips.filter((trip) => {
      const rate = rateValues[trip.id] || 0;
      return rate > 0;
    });

    if (tripsToSave.length === 0) {
      showNotification?.('No rows with valid rate to save.', 'error');
      return;
    }

    setIsSavingAll(true);
    let savedCount = 0;

    for (const trip of tripsToSave) {
      const rate = rateValues[trip.id] || 0;
      const remarks = remarkValues[trip.id] || '';
      
      const existingPayment = FarmPaymentService.getByTripId(trip.id);
      const status = existingPayment?.status || 'Pending';

      setSavingStates((prev) => ({ ...prev, [trip.id]: true }));

      const totalBirdsIncludingMortality = trip.totalBirds + trip.totalMortality;

      const paymentData = {
        tripId: trip.id,
        tripNo: trip.tripNo,
        tripDate: trip.tripDate,
        vehicleNo: trip.vehicleNo,
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
      } catch (error) {
        console.error(`Failed to save trip ${trip.tripNo}:`, error);
        showNotification?.(`Failed to save trip ${trip.tripNo}`, 'error');
      } finally {
        setSavingStates((prev) => ({ ...prev, [trip.id]: false }));
      }
    }

    setIsSavingAll(false);
    if (savedCount > 0) {
      onPaymentSaved();
      showNotification?.(`${savedCount} payment(s) saved successfully.`, 'success');
    } else {
      showNotification?.('No payments were saved.', 'error');
    }
  };

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
  const getPaymentStatus = (tripId: number): { status: string; isPaid: boolean } => {
    const payment = FarmPaymentService.getByTripId(tripId);
    return {
      status: payment?.status || 'Pending',
      isPaid: payment?.status === 'Paid',
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
                        disabled={isPaid}
                        className={`w-24 px-2 py-1 rounded-lg border border-slate-300 text-sm text-right focus:ring-2 focus:ring-blue-400 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                          isPaid ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'bg-white'
                        }`}
                        placeholder="0.00"
                      />
                    </td>
                    <td className="px-3 py-3 text-sm text-right font-bold text-emerald-600 whitespace-nowrap min-w-[160px]">
                      {rate > 0 ? formatCurrency(amount) : '-'}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap min-w-[140px]">
                      <input
                        type="text"
                        value={remarkValues[trip.id] || ''}
                        onChange={(e) => handleRemarkChange(trip.id, e.target.value)}
                        className="w-full min-w-[120px] px-2 py-1 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-blue-400 outline-none bg-white"
                        placeholder="Remarks"
                      />
                    </td>
                    <td className="px-3 py-3 text-center whitespace-nowrap">
                      {isPaid ? (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
                          Paid
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
                          Pending
                        </span>
                      )}
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