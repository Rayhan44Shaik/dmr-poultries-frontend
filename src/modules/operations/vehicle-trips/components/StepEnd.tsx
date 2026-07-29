import React, { useState } from "react";
import { Clock, Gauge, Ticket, Pencil, X, CheckCircle, Lock } from "lucide-react";
import type { Trip } from "../types/trip";

interface Props {
  trip: Trip;
  setTrip: React.Dispatch<React.SetStateAction<Trip>>;
  updateTrip: (updates: Partial<Trip>) => void;
  submitEndTrip: () => boolean;
  editable?: boolean;
  canEdit?: boolean;
  onCancel?: () => void;
  showNotification?: (message: string, type?: "info" | "success" | "error" | "warning") => void;
}

export default function StepEnd({
  trip,
  setTrip,
  updateTrip,
  submitEndTrip,
  editable = false,
  canEdit = false,
  onCancel,
  showNotification,
}: Props) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLocalEditing, setIsLocalEditing] = useState(false);
  const [closingMeterError, setClosingMeterError] = useState<string | null>(null);

  const handleClosingMeterChange = (value: string) => {
    const num = value === "" ? 0 : Number(value);
    updateTrip({ closingMeter: num });

    const minMeter = trip.destMeter || trip.openingMeter || 0;
    if (num > 0 && minMeter > 0 && num <= minMeter) {
      setClosingMeterError(`End Meter must be greater than previous Meter (${minMeter} KM)`);
    } else {
      setClosingMeterError(null);
    }
  };

  const handleClear = () => {
    updateTrip({
      closingMeter: 0,
      deliveryTolls: 0,
    });
    setClosingMeterError(null);
  };

  const handleSubmit = async () => {
    if (!trip.closingMeter || trip.closingMeter <= 0) {
      showNotification?.("Please enter a valid End Meter (KM).", "warning");
      return;
    }
    if (closingMeterError) {
      showNotification?.(closingMeterError, "warning");
      return;
    }
    if (trip.deliveryTolls === undefined || trip.deliveryTolls < 0) {
      showNotification?.("Please enter valid Toll Gates (Delivery Route).", "warning");
      return;
    }

    setIsSubmitting(true);
    const success = submitEndTrip();
    if (success) {
      setIsLocalEditing(false);
      showNotification?.("End trip details saved successfully.", "success");
    } else {
      showNotification?.("Submission failed. Please try again.", "error");
    }
    setIsSubmitting(false);
  };

  const isCompleted = trip.status === "Completed";

  // LOCKED VIEW
  if (!editable && !isLocalEditing) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 gap-3">
          <div className="flex items-center gap-2.5">
            <span className="bg-blue-600 text-white w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0">
              5
            </span>
            <h2 className="text-base font-bold text-slate-800 tracking-tight">
              END OF TRIP
            </h2>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {canEdit && !isCompleted && (
              <button
                onClick={() => setIsLocalEditing(true)}
                className="bg-white hover:bg-slate-50 p-2 rounded-lg border border-slate-200 text-slate-700 transition-all active:scale-95"
                title="Edit Step"
              >
                <Pencil size={14} />
              </button>
            )}
            {isCompleted ? (
              <span className="bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-full text-xs font-semibold border border-emerald-200 flex items-center gap-1.5 whitespace-nowrap">
                <CheckCircle size={12} /> Completed
              </span>
            ) : (
              <span className="bg-slate-100 border border-slate-200 text-slate-700 px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap">
                <Lock size={12} /> Locked
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 pt-2">
          <div className="bg-white border border-slate-200/80 p-4 rounded-xl">
            <p className="text-xs text-slate-500 font-medium">End Meter</p>
            <p className="font-semibold text-slate-900 mt-0.5">
              {trip.closingMeter ? `${trip.closingMeter} KM` : "--"}
            </p>
          </div>
          <div className="bg-white border border-slate-200/80 p-4 rounded-xl">
            <p className="text-xs text-slate-500 font-medium">End Time</p>
            <p className="font-semibold text-slate-900 mt-0.5">
              {trip.endTime || "--"}
            </p>
          </div>
          <div className="bg-white border border-slate-200/80 p-4 rounded-xl col-span-2 md:col-span-1">
            <p className="text-xs text-slate-500 font-medium">Toll Gates (Delivery)</p>
            <p className="font-semibold text-slate-900 mt-0.5">
              {trip.deliveryTolls ?? "--"}
            </p>
          </div>
        </div>

        {isCompleted && (
          <p className="text-xs text-slate-600 bg-white p-3 rounded-xl border border-slate-200 mt-2">
            Trip has been completed successfully.
          </p>
        )}
      </div>
    );
  }

  // EDIT / ACTIVE STATE
  return (
    <>
      <style>{`
        .hide-spinner::-webkit-inner-spin-button,
        .hide-spinner::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
        .hide-spinner { -moz-appearance: textfield; appearance: none; }
      `}</style>
      <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-6 shadow-sm">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 gap-3">
          <div className="flex items-center gap-2.5">
            <span className="bg-blue-600 text-white w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0">
              5
            </span>
            <h2 className="text-base font-bold text-slate-800 tracking-tight">
              END OF TRIP
            </h2>
          </div>
          {((editable && (trip.status === "Completed" || trip.deliveryStepSubmitted)) || isLocalEditing) && (
            <span className="text-xs text-slate-700 font-medium bg-slate-100 px-3 py-1 rounded-full border border-slate-200 whitespace-nowrap">
              Editable View
            </span>
          )}
        </div>

        {/* Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 sm:gap-x-6 gap-y-3.5 sm:gap-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
              <Clock size={14} className="text-slate-400" /> End Time
            </label>
            <div className="mt-1 h-[42px] bg-white border border-slate-200 rounded-xl px-4 flex items-center text-sm font-medium text-slate-800">
              {trip.endTime ? (
                trip.endTime
              ) : (
                <span className="text-slate-400 font-normal">
                  Auto-captured on submit
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Auto captured on submit</p>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
              <Gauge size={14} className="text-slate-400" /> End Meter (KM) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={trip.closingMeter === 0 ? "" : trip.closingMeter ?? ""}
              onChange={(e) => handleClosingMeterChange(e.target.value)}
              onWheel={(e) => e.currentTarget.blur()}
              className={`hide-spinner w-full mt-1 h-[42px] rounded-xl border ${
                closingMeterError ? "border-red-500" : "border-slate-200"
              } bg-white px-4 text-sm font-medium text-slate-800 focus:border-blue-600 focus:ring-2 focus:ring-blue-500/10 outline-none transition-all placeholder:text-slate-400`}
              placeholder="0.00"
            />
            {closingMeterError ? (
              <p className="text-[11px] text-red-500 font-medium mt-1">
                {closingMeterError}
              </p>
            ) : (
              <p className="text-[11px] text-slate-400 mt-1">
                Dest Meter:{" "}
                <span className="font-semibold text-slate-600">
                  {trip.destMeter || 0} KM
                </span>
              </p>
            )}
          </div>

          <div className="sm:col-span-2">
            <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
              <Ticket size={14} className="text-slate-400" /> Toll Gates (Delivery Route) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              inputMode="numeric"
              min="0"
              value={trip.deliveryTolls === 0 ? "" : trip.deliveryTolls ?? ""}
              onChange={(e) =>
                updateTrip({
                  deliveryTolls: e.target.value === "" ? 0 : Number(e.target.value),
                })
              }
              onWheel={(e) => e.currentTarget.blur()}
              className="hide-spinner w-full mt-1 h-[42px] rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-800 focus:border-blue-600 focus:ring-2 focus:ring-blue-500/10 outline-none transition-all placeholder:text-slate-400"
              placeholder="0"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Pickup route tolls:{" "}
              <span className="font-semibold text-slate-600">{trip.pickupTolls || 0}</span>
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-3 border-t border-slate-100">
          {!isCompleted && !editable && (
            <button
              type="button"
              onClick={handleClear}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-all active:scale-95"
            >
              Clear Form
            </button>
          )}

          {(editable || isLocalEditing) && (
            <button
              type="button"
              onClick={() => {
                if (editable && onCancel) onCancel();
                else setIsLocalEditing(false);
              }}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-all active:scale-95 flex items-center justify-center gap-1.5"
            >
              <X size={14} /> Cancel
            </button>
          )}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={
              isSubmitting ||
              !!closingMeterError ||
              !trip.closingMeter ||
              trip.closingMeter <= 0
            }
            className={`w-full sm:w-auto px-6 py-2.5 rounded-xl text-xs font-bold text-white transition-all active:scale-95 ${
              isSubmitting ||
              !!closingMeterError ||
              !trip.closingMeter ||
              trip.closingMeter <= 0
                ? "bg-blue-400 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700 shadow-sm"
            }`}
          >
            {isSubmitting
              ? "Saving..."
              : isCompleted
              ? "Update End Trip"
              : "Submit End Trip"}
          </button>
        </div>
      </div>
    </>
  );
}