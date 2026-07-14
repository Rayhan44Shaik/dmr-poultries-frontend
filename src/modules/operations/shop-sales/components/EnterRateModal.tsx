import { useEffect, useMemo, useState } from "react";
import { X, Truck, CalendarDays, Store, Package, Scale, IndianRupee } from "lucide-react";
import type { Trip } from "../../vehicle-trips/types/trip.ts";

interface Props {
  open: boolean;
  trip: Trip | null;
  onClose: () => void;
  onSave: (deliveries: Trip["deliveries"]) => void;
}

export default function EnterRateModal({ open, trip, onClose, onSave }: Props) {
  const [deliveries, setDeliveries] = useState<Trip["deliveries"]>([]);

  useEffect(() => {
    if (!trip) return;
    // If the trip is pending (rateCompleted === false), start with blank rates.
    // If it's already rated (modify), show the saved rates.
    const isModify = trip.rateCompleted === true;
    setDeliveries(
      trip.deliveries.map((d) => ({
        ...d,
        rate: isModify ? ((d as any).rate ?? null) : null,
        amount: isModify ? ((d as any).amount ?? 0) : 0,
      }))
    );
  }, [trip]);

  const totalBirds = useMemo(() => deliveries.reduce((sum, row) => sum + row.birds, 0), [deliveries]);
  const totalWeight = useMemo(() => deliveries.reduce((sum, row) => sum + row.weight, 0), [deliveries]);
  const grandAmount = useMemo(() => deliveries.reduce((sum, row) => sum + ((row as any).amount || 0), 0), [deliveries]);

  const canSave = useMemo(() => {
    return deliveries.every((row) => {
      const rate = (row as any).rate;
      return rate !== null && rate !== undefined && rate >= 50 && rate <= 300;
    });
  }, [deliveries]);

  const handleSave = () => {
    if (!canSave) {
      alert("Please enter a valid rate between ₹50 and ₹300 for every shop.");
      return;
    }
    if (!window.confirm("Save rates and lock this trip?")) return;
    onSave(deliveries);
  };

  if (!open || !trip) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between z-10">
          <div>
            <h2 className="text-xl font-bold text-slate-800">
              {trip.rateCompleted ? "Modify Selling Rates" : "Enter Selling Rates"}
            </h2>
            <p className="text-xs text-slate-500">
              {trip.rateCompleted ? "Update rates for this trip" : "Enter shop-wise rates and lock this trip"}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-wider text-slate-500">Trip Number</p>
              <p className="text-sm font-bold text-green-700">{trip.tripNo}</p>
            </div>
            <button onClick={onClose} className="h-8 w-8 rounded-full hover:bg-slate-100 flex items-center justify-center">
              <X size={18} className="text-slate-600" />
            </button>
          </div>
        </div>

        {/* Trip Info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 px-6 py-3 border-b bg-slate-50/60">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-blue-100 flex items-center justify-center">
              <Truck size={16} className="text-blue-700" />
            </div>
            <div>
              <p className="text-[10px] uppercase text-slate-500">Vehicle</p>
              <p className="text-sm font-medium text-slate-800">{trip.vehicleNo}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-green-100 flex items-center justify-center">
              <CalendarDays size={16} className="text-green-700" />
            </div>
            <div>
              <p className="text-[10px] uppercase text-slate-500">Trip Date</p>
              <p className="text-sm font-medium text-slate-800">{trip.tripDate}</p>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto px-1">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 border-b">
              <tr className="text-slate-600">
                <th className="px-3 py-2 text-center text-[10px] font-medium uppercase tracking-wider">S.No</th>
                <th className="px-3 py-2 text-left text-[10px] font-medium uppercase tracking-wider">Shop Name</th>
                <th className="px-3 py-2 text-center text-[10px] font-medium uppercase tracking-wider">Birds</th>
                <th className="px-3 py-2 text-center text-[10px] font-medium uppercase tracking-wider">Weight</th>
                <th className="px-3 py-2 text-center text-[10px] font-medium uppercase tracking-wider bg-amber-50">Rate (₹/KG)</th>
                <th className="px-3 py-2 text-center text-[10px] font-medium uppercase tracking-wider">Amount</th>
              </tr>
            </thead>
            <tbody>
              {deliveries.map((delivery, index) => {
                const rate = (delivery as any).rate;
                const amount = (delivery as any).amount || 0;
                const isValid = rate !== null && rate !== undefined && rate >= 50 && rate <= 300;

                return (
                  <tr key={delivery.id} className="border-t hover:bg-blue-50/50 transition-colors">
                    <td className="px-3 py-2 text-center text-xs text-slate-500">{index + 1}</td>
                    <td className="px-3 py-2 text-xs font-medium text-slate-700">{delivery.shopName}</td>
                    <td className="px-3 py-2 text-center text-xs font-semibold text-blue-700">{delivery.birds.toLocaleString()}</td>
                    <td className="px-3 py-2 text-center text-xs font-semibold text-orange-600">{delivery.weight.toFixed(2)}</td>
                    <td className="px-3 py-2 bg-amber-50/50">
                      <div className="flex items-center justify-center gap-1">
                        <span className="text-xs text-slate-500">₹</span>
                        <input
                          type="number"
                          min={50}
                          max={300}
                          step="0.01"
                          value={rate === null ? "" : rate}
                          placeholder="Enter rate"
                          onChange={(e) => {
                            const value = e.target.value;
                            const updated = [...deliveries];
                            const num = value === "" ? null : Number(value);
                            (updated[index] as any).rate = num;
                            (updated[index] as any).amount = num === null ? 0 : num * delivery.weight;
                            setDeliveries(updated);
                          }}
                          className={`w-24 px-2 py-1.5 rounded-lg border text-center text-sm font-medium outline-none transition-all focus:ring-2 ${
                            rate !== null && rate !== undefined
                              ? isValid
                                ? "border-green-400 focus:ring-green-200 bg-green-50"
                                : "border-red-400 focus:ring-red-200 bg-red-50"
                              : "border-slate-300 focus:border-blue-500 focus:ring-blue-200"
                          }`}
                        />
                      </div>
                      {rate === null && (
                        <p className="text-[9px] text-amber-600 text-center mt-0.5">Required</p>
                      )}
                      {rate !== null && !isValid && (
                        <p className="text-[9px] text-red-500 text-center mt-0.5">50-300 only</p>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span
                        className={`inline-block rounded-lg px-3 py-1 text-xs font-bold min-w-[80px] ${
                          amount > 0 ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-400"
                        }`}
                      >
                        ₹ {amount.toFixed(2)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer with Icons */}
        <div className="sticky bottom-0 bg-white border-t border-slate-200 px-6 py-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <div className="bg-slate-50 rounded-lg px-3 py-2 text-center flex items-center justify-center gap-2">
              <Store size={18} className="text-blue-600" />
              <div>
                <p className="text-[10px] text-slate-500 uppercase">Shops</p>
                <p className="text-lg font-bold text-slate-800">{deliveries.length}</p>
              </div>
            </div>
            <div className="bg-slate-50 rounded-lg px-3 py-2 text-center flex items-center justify-center gap-2">
              <Package size={18} className="text-blue-600" />
              <div>
                <p className="text-[10px] text-slate-500 uppercase">Birds</p>
                <p className="text-lg font-bold text-blue-700">{totalBirds.toLocaleString()}</p>
              </div>
            </div>
            <div className="bg-slate-50 rounded-lg px-3 py-2 text-center flex items-center justify-center gap-2">
              <Scale size={18} className="text-orange-600" />
              <div>
                <p className="text-[10px] text-slate-500 uppercase">Weight</p>
                <p className="text-lg font-bold text-orange-600">{totalWeight.toFixed(2)} KG</p>
              </div>
            </div>
            <div className="bg-green-50 rounded-lg px-3 py-2 text-center border border-green-200 flex items-center justify-center gap-2">
              <IndianRupee size={18} className="text-green-700" />
              <div>
                <p className="text-[10px] text-green-600 uppercase">Grand Amount</p>
                <p className="text-lg font-bold text-green-700">₹ {grandAmount.toFixed(2)}</p>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={onClose} className="px-6 py-2 rounded-lg border border-slate-300 text-sm font-medium hover:bg-slate-50 transition-colors">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!canSave}
              className={`px-6 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm ${
                canSave
                  ? "bg-green-600 hover:bg-green-700 text-white"
                  : "bg-slate-300 text-slate-500 cursor-not-allowed"
              }`}
            >
              🔒 {trip.rateCompleted ? "Update & Save" : "Save & Lock Trip"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}