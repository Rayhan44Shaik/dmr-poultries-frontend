import React, { useState } from "react";
import { Lock, Gauge, Clock, Pencil, X, CheckCircle } from "lucide-react";
import type { Trip } from "../types/trip";

interface Props {
  trip: Trip;
  setTrip: React.Dispatch<React.SetStateAction<Trip>>;
  updateTrip: (updates: Partial<Trip>) => void;
  submitEndTrip: () => boolean;
  editable?: boolean;
  canEdit?: boolean;
  onCancel?: () => void;
}

export default function StepEnd({
  trip,
  setTrip,
  updateTrip,
  submitEndTrip,
  editable = false,
  canEdit = false,
  onCancel,
}: Props) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLocalEditing, setIsLocalEditing] = useState(false);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    const success = submitEndTrip();
    if (success) setIsLocalEditing(false);
    setIsSubmitting(false);
  };

  // LOCKED VIEW
  if (!editable && !isLocalEditing) {
    const isCompleted = trip.status === "Completed";

    return (
      <div className="bg-blue-50/30 border-2 border-blue-100 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-blue-200 pb-3">
          <div className="flex items-center gap-3">
            <span className="bg-blue-700 text-white w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold">5</span>
            <h2 className="text-lg font-bold text-blue-800">END OF TRIP</h2>
          </div>
          <div className="flex items-center gap-2">
            {canEdit && !isCompleted && (
              <button onClick={() => setIsLocalEditing(true)} className="bg-white hover:bg-blue-50 p-1.5 rounded-lg border border-blue-200 text-blue-600 shadow-sm transition-all active:scale-95" title="Edit Step">
                <Pencil size={14} />
              </button>
            )}
            {isCompleted ? (
              <span className="bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-full text-xs font-bold border border-emerald-300 shadow-sm flex items-center gap-1.5">
                <CheckCircle size={12} /> Completed
              </span>
            ) : (
              <span className="bg-slate-200 text-slate-600 px-3 py-1.5 rounded-full text-xs font-bold border border-slate-300 shadow-sm flex items-center gap-1.5">
                <Lock size={12} /> Locked
              </span>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 pt-2">
          <div className="bg-white p-4 rounded-xl shadow-sm">
            <p className="text-xs text-slate-500">End Meter</p>
            <p className="font-semibold text-slate-800">{trip.closingMeter} KM</p>
          </div>
          <div className="bg-white p-4 rounded-xl shadow-sm">
            <p className="text-xs text-slate-500">End Time</p>
            <p className="font-semibold text-slate-800">{trip.endTime || "--"}</p>
          </div>
          <div className="bg-white p-4 rounded-xl shadow-sm col-span-2">
            <p className="text-xs text-slate-500">Toll Gates (Delivery Route)</p>
            <p className="font-semibold text-slate-800">{trip.deliveryTolls}</p>
          </div>
        </div>
      </div>
    );
  }

  // EDIT STATE
  return (
    <>
      <style>{`.hide-spinner::-webkit-inner-spin-button,.hide-spinner::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}.hide-spinner{-moz-appearance:textfield;appearance:none}`}</style>
      <div className="bg-white border border-slate-200/80 shadow-sm rounded-2xl p-6 space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <span className="bg-blue-700 text-white w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold">5</span>
            <h2 className="text-lg font-bold text-slate-800 tracking-tight">END OF TRIP</h2>
          </div>
          {((editable && (trip.status === "Completed" || trip.deliveryStepSubmitted)) || isLocalEditing) && <span className="text-xs text-blue-600 font-medium bg-blue-50 px-3 py-1 rounded-full border border-blue-200">✏️ Editable View</span>}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
              <Clock size={14} className="text-slate-400" /> End Time
            </label>
            <div className="mt-1.5 bg-slate-50/70 p-3 rounded-xl border border-slate-100 flex items-center gap-2">
              <Clock size={16} className="text-slate-400" />
              <span className="text-sm font-medium text-slate-700">—</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1.5">Auto captured on submit</p>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
              <Gauge size={14} className="text-slate-400" /> End Meter (KM) <span className="text-red-500">*</span>
            </label>
            <div>
              <input type="number" step="0.01" min="0" onWheel={(e) => e.currentTarget.blur()} value={trip.closingMeter || ""} onChange={(e) => updateTrip({ closingMeter: Number(e.target.value) })} className="hide-spinner w-full mt-1.5 rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-2.5 text-sm font-medium text-slate-800 focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all" placeholder="Enter end meter reading..." />
              <p className="text-[11px] text-slate-400 mt-1.5">Dest: <span className="font-medium text-slate-600">{trip.destMeter.toLocaleString()}</span></p>
            </div>
          </div>

          <div className="md:col-span-2">
            <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">Toll Gates (Delivery Route) <span className="text-red-500">*</span></label>
            <div className="mt-1.5">
              <input type="number" min="0" onWheel={(e) => e.currentTarget.blur()} value={trip.deliveryTolls || ""} onChange={(e) => updateTrip({ deliveryTolls: Number(e.target.value) })} className="hide-spinner w-full rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-2.5 text-sm font-medium text-slate-800 focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all" placeholder="Enter number of tolls crossed on delivery route..." />
              <p className="text-[11px] text-slate-400 mt-1.5">Pickup route tolls: {trip.pickupTolls}</p>
            </div>
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
          <button onClick={handleSubmit} disabled={isSubmitting || !trip.closingMeter || !trip.deliveryTolls} className={`px-8 py-2.5 rounded-xl text-sm font-semibold text-white shadow-md transition-all active:scale-[0.98] text-sm ${isSubmitting || !trip.closingMeter || !trip.deliveryTolls ? "bg-blue-400/60 cursor-not-allowed shadow-none" : "bg-blue-700 hover:bg-blue-800 shadow-blue-200"}`}>
            {isSubmitting ? "Submitting..." : (trip.status === "Completed" ? "Update End Trip" : "Submit End Trip")}
          </button>
        </div>
      </div>
    </>
  );
}