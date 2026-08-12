import { useEffect, useMemo, useState } from "react";
import {
  X,
  Truck,
  CalendarDays,
  Store,
  Package,
  Scale,
  IndianRupee,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Info
} from "lucide-react";
import type { Trip } from "../../vehicle-trips/types/trip.ts";

interface Props {
  open: boolean;
  trip: Trip | null;
  onClose: () => void;
  onSave: (deliveries: Trip["deliveries"]) => void;
}

export default function EnterRateModal({ open, trip, onClose, onSave }: Props) {
  const [deliveries, setDeliveries] = useState<Trip["deliveries"]>([]);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // ─── MARKET RATES STATE (READ-ONLY REFERENCE FROM MASTERS) ───
  const [showMarketRates, setShowMarketRates] = useState(true);
  const [referenceDays, setReferenceDays] = useState<Array<{ label: string; dateStr: string }>>([]);
  const [tableOneData, setTableOneData] = useState<Record<string, Record<string, string>>>({});
  const [tableTwoData, setTableTwoData] = useState<Record<string, Record<string, string>>>({});
  const [summaryData, setSummaryData] = useState<Record<string, Record<string, string>>>({});

  // 1. Initialize Trip Deliveries & Compute 3-Day Window for Market Rates
  useEffect(() => {
    if (!trip) return;
    setShowSuccessToast(false);
    setShowConfirm(false);
    const isModify = trip.rateCompleted === true;
    setDeliveries(
      trip.deliveries.map((d) => ({
        ...d,
        rate: isModify ? ((d as any).rate ?? null) : null,
        amount: isModify ? ((d as any).amount ?? 0) : 0,
      }))
    );

    // Calculate 3-Day Range (Yesterday, Trip Date, Tomorrow)
    const tripDateObj = new Date(trip.tripDate);
    const days = [];
    
    for (let i = -1; i <= 1; i++) {
      const d = new Date(tripDateObj);
      d.setDate(tripDateObj.getDate() + i);
      days.push({
        label: d.getDate().toString().padStart(2, "0"), // Shows as "03", "04", "05" etc.
        dateStr: d.toISOString().split("T")[0],
      });
    }
    setReferenceDays(days);

    // Load persistent rates from Masters module (Read-only)
    // Checking potential keys where Masters module might be saving the market rates
    const savedMasterRates = localStorage.getItem("market_rates_store") || localStorage.getItem("master_market_rates") || localStorage.getItem("market_rates");
    
    if (savedMasterRates) {
      try {
        const parsed = JSON.parse(savedMasterRates);
        setTableOneData(parsed.tableOne || {});
        setTableTwoData(parsed.tableTwo || {});
        setSummaryData(parsed.summary || {});
      } catch (e) {
        console.error("Error loading stored market rates from Master module", e);
      }
    }
  }, [trip]);

  // ─── CALCULATIONS ───
  const totalBirds = useMemo(() => deliveries.reduce((sum, row) => sum + row.birds, 0), [deliveries]);
  const totalWeight = useMemo(() => deliveries.reduce((sum, row) => sum + row.weight, 0), [deliveries]);
  const grandAmount = useMemo(() => deliveries.reduce((sum, row) => sum + ((row as any).amount || 0), 0), [deliveries]);

  const canSave = useMemo(() => {
    return deliveries.every((row) => {
      const rate = (row as any).rate;
      return rate !== null && rate !== undefined && rate >= 50 && rate <= 300;
    });
  }, [deliveries]);

  const handleSaveClick = () => {
    if (!canSave) return;
    setShowConfirm(true);
  };

  const confirmSave = () => {
    setShowConfirm(false);
    setShowSuccessToast(true);
    setTimeout(() => {
      onSave(deliveries);
      onClose();
    }, 1200);
  };

  const cancelSave = () => setShowConfirm(false);

  if (!open || !trip) return null;

  return (
    <>
      <style>{`
        .no-spinner::-webkit-inner-spin-button,
        .no-spinner::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
        .no-spinner { -moz-appearance: textfield; }
      `}</style>

      <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 overflow-y-auto">
        {/* Success Toast */}
        {showSuccessToast && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/20 transition-all">
            <div className="bg-white rounded-2xl shadow-2xl border border-emerald-100 p-6 flex flex-col items-center gap-3 animate-in fade-in zoom-in duration-200">
              <div className="h-12 w-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 size={28} />
              </div>
              <div className="text-center">
                <h3 className="text-base font-bold text-slate-800">Rates Saved Successfully!</h3>
                <p className="text-xs text-slate-500 mt-0.5">Trip has been updated and locked securely.</p>
              </div>
            </div>
          </div>
        )}

        {/* Confirmation Modal */}
        {showConfirm && (
          <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/30 transition-all">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full mx-4 p-6 animate-in fade-in zoom-in duration-200">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shrink-0">
                  <AlertCircle size={20} />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-slate-800">Confirm Lock Trip</h3>
                  <p className="text-sm text-slate-500 mt-1">
                    Save rates and lock this trip? You won't be able to edit rates after this.
                  </p>
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button onClick={cancelSave} className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-all">
                  Cancel
                </button>
                <button onClick={confirmSave} className="px-4 py-2 rounded-xl bg-green-600 hover:bg-green-700 text-sm font-medium text-white transition-all shadow-sm active:scale-95">
                  OK
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Main Modal Container */}
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-y-auto flex flex-col relative">
          
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between z-20 shrink-0">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 px-6 py-3 border-b bg-slate-50/60 shrink-0">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-indigo-100 flex items-center justify-center">
                <Truck size={16} className="text-indigo-700" />
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

          {/* COMPACT MARKET RATES WIDGET (READ-ONLY) */}
          <div className="border-b border-slate-200 shrink-0 bg-slate-50">
            <div 
              className="px-6 py-2.5 flex items-center justify-between cursor-pointer hover:bg-slate-100 transition-colors"
              onClick={() => setShowMarketRates(!showMarketRates)}
            >
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-slate-800 font-semibold text-sm">
                  <TrendingUp size={16} className="text-indigo-600" />
                  <span>3-Day Market Rates Reference</span>
                </div>
                <div className="hidden sm:flex items-center gap-1 text-[10px] bg-slate-200/60 text-slate-600 px-2 py-0.5 rounded-full font-medium">
                  <Info size={12} /> Syncs automatically from Masters
                </div>
              </div>
              <span className="text-xs font-medium text-slate-600 bg-white px-3 py-1 rounded-md border border-slate-200 shadow-sm">
                {showMarketRates ? "Hide Reference" : "Show Reference"}
              </span>
            </div>

            {showMarketRates && (
              <div className="px-5 pb-5 pt-1 grid grid-cols-1 lg:grid-cols-12 gap-5 overflow-x-auto">
                
                {/* 1. Additional Metrics (Proportional Size: 3 Cols) */}
                <div className="lg:col-span-3 bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm flex flex-col">
                  <div className="bg-slate-100 px-3 py-2 border-b border-slate-200 text-xs font-bold text-slate-700 text-center">
                    1. Metrics (Vij, Gun, R.P)
                  </div>
                  <table className="w-full text-center text-xs">
                    <thead className="bg-slate-50 text-slate-500">
                      <tr>
                        <th className="py-2 border-r border-slate-200 font-medium">Date</th>
                        <th className="py-2 border-r border-slate-200 font-medium">Vij</th>
                        <th className="py-2 border-r border-slate-200 font-medium">Gun</th>
                        <th className="py-2 font-medium">R.P</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {referenceDays.map((d) => {
                        const isToday = d.dateStr === trip.tripDate;
                        const row = summaryData[d.dateStr] || {};
                        return (
                          <tr key={d.dateStr} className={`transition-colors ${isToday ? 'bg-blue-50/70 border-l-4 border-l-blue-500 font-bold' : 'hover:bg-slate-50'}`}>
                            <td className="py-2 border-r border-slate-100 text-slate-600">{d.label}</td>
                            <td className="py-2 border-r border-slate-100 text-slate-800">{row.vij || "-"}</td>
                            <td className="py-2 border-r border-slate-100 text-slate-800">{row.gun || "-"}</td>
                            <td className="py-2 text-blue-700">{row.rp || "-"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* 2. Company Rates Matrix (Proportional Size: 5 Cols) */}
                <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm flex flex-col">
                  <div className="bg-slate-100 px-3 py-2 border-b border-slate-200 text-xs font-bold text-slate-700 text-center">
                    2. Company Rates Matrix
                  </div>
                  <table className="w-full text-center text-xs">
                    <thead className="bg-slate-50 text-slate-500">
                      <tr>
                        <th className="py-2 border-r border-slate-200 font-medium">Date</th>
                        <th className="py-2 border-r border-slate-200 font-medium">Sneha</th>
                        <th className="py-2 border-r border-slate-200 font-medium">VenCob</th>
                        <th className="py-2 border-r border-slate-200 font-medium">V.Vii</th>
                        <th className="py-2 border-r border-slate-200 font-medium">V.Gun</th>
                        <th className="py-2 font-medium">A.Vii</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {referenceDays.map((d) => {
                        const isToday = d.dateStr === trip.tripDate;
                        const row = tableOneData[d.dateStr] || {};
                        return (
                          <tr key={d.dateStr} className={`transition-colors ${isToday ? 'bg-blue-50/70 border-l-4 border-l-blue-500 font-bold' : 'hover:bg-slate-50'}`}>
                            <td className="py-2 border-r border-slate-100 text-slate-600">{d.label}</td>
                            {["sneha", "vencobRate", "vencobVii", "vencobGun", "associationVii"].map((key) => (
                              <td key={key} className="py-2 border-r border-slate-100 text-slate-800 last:border-0">
                                {row[key] || "-"}
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* 3. Size & Category Breakdown (Proportional Size: 4 Cols) */}
                <div className="lg:col-span-4 bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm flex flex-col">
                  <div className="bg-slate-100 px-3 py-2 border-b border-slate-200 text-xs font-bold text-slate-700 text-center">
                    3. Size & Category Breakdown
                  </div>
                  <table className="w-full text-center text-xs">
                    <thead className="bg-slate-50 text-slate-500">
                      <tr>
                        <th className="py-2 border-r border-slate-200 font-medium">Date</th>
                        <th className="py-2 border-r border-slate-200 font-medium">17</th>
                        <th className="py-2 border-r border-slate-200 font-medium">15</th>
                        <th className="py-2 border-r border-slate-200 font-medium">13</th>
                        <th className="py-2 border-r border-slate-200 font-medium">12</th>
                        <th className="py-2 font-medium">10</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {referenceDays.map((d) => {
                        const isToday = d.dateStr === trip.tripDate;
                        const row = tableTwoData[d.dateStr] || {};
                        return (
                          <tr key={d.dateStr} className={`transition-colors ${isToday ? 'bg-blue-50/70 border-l-4 border-l-blue-500 font-bold' : 'hover:bg-slate-50'}`}>
                            <td className="py-2 border-r border-slate-100 text-slate-600">{d.label}</td>
                            {["c17", "c15", "c13", "c12", "c10"].map((key) => (
                              <td key={key} className="py-2 border-r border-slate-100 text-slate-800 last:border-0">
                                {row[key] || "-"}
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

              </div>
            )}
          </div>

          {/* Table */}
          <div className="overflow-x-auto px-1 flex-1">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 border-b sticky top-0 z-10 shadow-sm">
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
                    <tr key={delivery.id} className="border-b last:border-0 hover:bg-indigo-50/40 transition-colors">
                      <td className="px-3 py-3 text-center text-xs text-slate-500">{index + 1}</td>
                      <td className="px-3 py-3 text-xs font-medium text-slate-700">{delivery.shopName}</td>
                      <td className="px-3 py-3 text-center text-xs font-semibold text-blue-700">{delivery.birds.toLocaleString()}</td>
                      <td className="px-3 py-3 text-center text-xs font-semibold text-orange-600">{delivery.weight.toFixed(2)}</td>
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
                            className={`w-24 px-2 py-1.5 rounded-lg border text-center text-sm font-medium outline-none transition-all focus:ring-2 no-spinner ${
                              rate !== null && rate !== undefined
                                ? isValid
                                  ? "border-green-400 focus:ring-green-200 bg-green-50"
                                  : "border-red-400 focus:ring-red-200 bg-red-50"
                                : "border-slate-300 focus:border-indigo-500 focus:ring-indigo-200"
                            }`}
                          />
                        </div>
                        {rate === null && <p className="text-[9px] text-amber-600 text-center mt-0.5">Required</p>}
                        {rate !== null && !isValid && <p className="text-[9px] text-red-500 text-center mt-0.5">50-300 only</p>}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span className={`inline-block rounded-lg px-3 py-1 text-xs font-bold min-w-[80px] ${amount > 0 ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-400"}`}>
                          ₹ {amount.toFixed(2)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 bg-white border-t border-slate-200 px-6 py-4 z-20 shrink-0">
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
                onClick={handleSaveClick}
                disabled={!canSave || showSuccessToast || showConfirm}
                className={`px-6 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm ${
                  canSave && !showSuccessToast && !showConfirm
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
    </>
  );
}