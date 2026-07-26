import React, { useState, useEffect } from "react";
import { Lock, Scale, Bird, Box, Gauge, Clock, Pencil, X, CheckCircle } from "lucide-react";
import type { Trip } from "../types/trip";

interface Props {
  trip: Trip;
  setTrip: React.Dispatch<React.SetStateAction<Trip>>;
  updateTrip: (updates: Partial<Trip>) => void;
  submitPickupStep: (data: Partial<Trip>) => boolean;
  editable?: boolean;
  canEdit?: boolean;
  onCancel?: () => void;
  clearForm?: () => void;
}

export default function StepPickup({
  trip,
  setTrip,
  updateTrip,
  submitPickupStep,
  editable = false,
  canEdit = false,
  onCancel,
  clearForm,
}: Props) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLocalEditing, setIsLocalEditing] = useState(false);
  const [localAvgWeight, setLocalAvgWeight] = useState(0);

  useEffect(() => {
    const dc = trip.dcWeight || 0;
    const birds = trip.totalBirds || 0;
    if (dc > 0 && birds > 0) {
      setLocalAvgWeight(Number((dc / birds).toFixed(3)));
    } else {
      setLocalAvgWeight(0);
    }
  }, [trip.dcWeight, trip.totalBirds]);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    const success = submitPickupStep({});
    if (success) setIsLocalEditing(false);
    setIsSubmitting(false);
  };

  // LOCKED VIEW
  if (trip.pickupStepSubmitted && !editable && !isLocalEditing) {
    return (
      <div className="bg-blue-50/30 border-2 border-blue-100 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-blue-200 pb-3">
          <div className="flex items-center gap-3"><span className="bg-blue-700 text-white w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold">3</span><h2 className="text-lg font-bold text-blue-800">PICKUP KPI SUMMARY</h2></div>
          <div className="flex items-center gap-2">
            {canEdit && (
              <button onClick={() => setIsLocalEditing(true)} className="bg-white hover:bg-blue-50 p-1.5 rounded-lg border border-blue-200 text-blue-600 shadow-sm transition-all active:scale-95" title="Edit Step">
                <Pencil size={14} />
              </button>
            )}
            <span className="bg-slate-200 text-slate-600 px-3 py-1.5 rounded-full text-xs font-bold border border-slate-300 shadow-sm flex items-center gap-1.5"><Lock size={12} /> Locked</span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 pt-2">
          <div className="bg-white p-4 rounded-xl shadow-sm"><p className="text-xs text-slate-500">Auto Time</p><p className="font-semibold text-slate-800">{trip.pickupLoadTime || "--"}</p></div>
          <div className="bg-white p-4 rounded-xl shadow-sm"><p className="text-xs text-slate-500">Total DC Weight</p><p className="font-semibold text-slate-800">{trip.dcWeight} Kg</p></div>
          <div className="bg-white p-4 rounded-xl shadow-sm"><p className="text-xs text-slate-500">Total Birds</p><p className="font-semibold text-slate-800">{trip.totalBirds} Nos</p></div>
          <div className="bg-white p-4 rounded-xl shadow-sm"><p className="text-xs text-slate-500">Loaded Boxes</p><p className="font-semibold text-slate-800">{trip.boxes}</p></div>
          <div className="bg-white p-4 rounded-xl shadow-sm col-span-2"><p className="text-xs text-slate-500">Average Weight</p><p className="font-semibold text-slate-800">{trip.avgWeight || 0} Kg</p></div>
        </div>
        <p className="text-sm text-emerald-700 bg-emerald-50 p-3 rounded-lg mt-2 border border-emerald-200">✅ Pickup KPI submitted successfully.</p>
      </div>
    );
  }

  // EDIT STATE
  return (
    <>
      <style>{`.hide-spinner::-webkit-inner-spin-button,.hide-spinner::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}.hide-spinner{-moz-appearance:textfield;appearance:none}`}</style>
      <div className="bg-white border border-slate-200/80 shadow-sm rounded-2xl p-6 space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3"><span className="bg-blue-700 text-white w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold">3</span><h2 className="text-lg font-bold text-slate-800 tracking-tight">PICKUP KPI SUMMARY</h2></div>
          {((editable && trip.pickupStepSubmitted) || isLocalEditing) && <span className="text-xs text-blue-600 font-medium bg-blue-50 px-3 py-1 rounded-full border border-blue-200">✏️ Editable View</span>}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5"><Clock size={14} className="text-slate-400" /> Auto Time Capture</label>
            <div className="mt-1.5 bg-slate-50/70 rounded-xl border border-slate-100 flex items-center px-4 py-2.5 h-[38px]">
              <Clock size={16} className="text-slate-400 mr-2" />
              {/* 🟢 FIXED: Now shows the captured time if it exists, or — */}
              <span className="text-sm font-medium text-slate-700">{trip.pickupLoadTime || '—'}</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1.5">Auto captured on submit</p>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5"><Scale size={14} className="text-slate-400" /> Total DC Weight (Kg) <span className="text-red-500">*</span></label>
            <div><input type="number" step="0.01" min="0" onWheel={(e) => e.currentTarget.blur()} value={trip.dcWeight || ""} onChange={(e) => updateTrip({ dcWeight: parseFloat(e.target.value) || 0 })} className="hide-spinner w-full mt-1.5 rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-2.5 h-[38px] text-sm font-medium text-slate-800 focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all shadow-sm" placeholder="0.00" /><p className="text-[11px] text-slate-400 mt-1.5">Farm exp: 9,100 Kg</p></div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5"><Bird size={14} className="text-slate-400" /> Total Birds (Nos) <span className="text-red-500">*</span></label>
            <div><input type="number" step="1" min="0" onWheel={(e) => e.currentTarget.blur()} value={trip.totalBirds || ""} onChange={(e) => updateTrip({ totalBirds: parseInt(e.target.value) || 0 })} className="hide-spinner w-full mt-1.5 rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-2.5 h-[38px] text-sm font-medium text-slate-800 focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all shadow-sm" placeholder="0" /><p className="text-[11px] text-slate-400 mt-1.5">Farm exp: 7,400</p></div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5"><Box size={14} className="text-slate-400" /> Loaded Boxes</label>
            <div><input type="number" step="1" min="0" onWheel={(e) => e.currentTarget.blur()} value={trip.boxes || ""} onChange={(e) => updateTrip({ boxes: parseInt(e.target.value) || 0 })} className="hide-spinner w-full mt-1.5 rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-2.5 h-[38px] text-sm font-medium text-slate-800 focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all shadow-sm" placeholder="0" /></div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5"><Gauge size={14} className="text-slate-400" /> Average Weight (Kg)</label>
            <div><div className="w-full mt-1.5 rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-2.5 h-[38px] text-sm font-medium text-slate-700 flex items-center shadow-sm">{localAvgWeight > 0 ? localAvgWeight : <span className="text-slate-400">—</span>}</div><p className="text-[11px] text-slate-400 mt-1.5">Auto calculated</p></div>
          </div>
        </div>

        <div className="flex items-center justify-center gap-4 pt-4 border-t border-slate-100 mt-6">
          {(editable || isLocalEditing) && (
            <button onClick={() => {
              if (editable && onCancel) onCancel();
              else setIsLocalEditing(false);
            }} className="px-6 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-sm font-medium text-slate-600 transition-all shadow-sm active:scale-95 flex items-center gap-2">
              <X size={15} /> Close
            </button>
          )}
          {!trip.pickupStepSubmitted && !editable && clearForm && (
            <button onClick={clearForm} className="px-6 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-sm font-medium text-slate-600 transition-all shadow-sm active:scale-95">
              Clear Form
            </button>
          )}
          <button onClick={handleSubmit} disabled={isSubmitting || !trip.dcWeight || !trip.totalBirds} className={`px-8 py-2.5 rounded-xl text-sm font-semibold text-white shadow-md transition-all active:scale-[0.98] flex items-center gap-1.5 ${isSubmitting || !trip.dcWeight || !trip.totalBirds ? "bg-blue-400/60 cursor-not-allowed shadow-none" : "bg-blue-700 hover:bg-blue-800 shadow-blue-200"}`}>
            <CheckCircle size={15} />
            {isSubmitting ? "Submitting..." : (trip.pickupStepSubmitted ? "Update Pickup" : "Submit Pickup")}
          </button>
        </div>
      </div>
    </>
  );
}