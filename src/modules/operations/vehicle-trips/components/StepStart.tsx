import React, { useState, useEffect } from "react";
import { Clock, User, Truck, Users, Gauge, Wallet, Pencil, X } from "lucide-react";
import Select from "react-select";
import type { Trip } from "../types/trip";
import { tripService } from "../services/tripService";

interface Props {
  trip: Trip;
  setTrip: React.Dispatch<React.SetStateAction<Trip>>;
  updateTrip: (updates: Partial<Trip>) => void;
  submitStartStep: (data: Partial<Trip>) => boolean;
  vehicleOptions: { id: number; vehicleNumber: string }[];
  employeeOptions: { id: number; employeeName: string; department: string }[];
  editable?: boolean;
  canEdit?: boolean;
  onCancel?: () => void;
  clearForm?: () => void;
}

export default function StepStart({
  trip,
  setTrip,
  updateTrip,
  submitStartStep,
  vehicleOptions,
  employeeOptions,
  editable = false,
  canEdit = false,
  onCancel,
  clearForm,
}: Props) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLocalEditing, setIsLocalEditing] = useState(false);
  const [lastMeterError, setLastMeterError] = useState<string | null>(null);
  const [lastKnownMeter, setLastKnownMeter] = useState<number | null>(null);
  const [advanceError, setAdvanceError] = useState<string | null>(null);

  const driverOptions = employeeOptions.filter((e) => e.department === "Driver");
  const supervisorOptions = employeeOptions.filter((e) => e.department === "Supervisor");
  const helperOptions = employeeOptions.filter((e) => e.department === "Helper" || e.department === "Labor");

  useEffect(() => {
    if (!trip.vehicleId) {
      setLastKnownMeter(null);
      setLastMeterError(null);
      return;
    }
    const allTrips = tripService.getAll();
    const vehicleTrips = allTrips
      .filter((t) => t.vehicleId === trip.vehicleId && t.id !== trip.id && t.closingMeter > 0)
      .sort((a, b) => new Date(b.tripDate).getTime() - new Date(a.tripDate).getTime());

    if (vehicleTrips.length > 0) {
      const lastTrip = vehicleTrips[0];
      const lastMeter = lastTrip.closingMeter;
      setLastKnownMeter(lastMeter);
      // Only validate if a value has been entered (not undefined/null)
      if (trip.openingMeter !== undefined && trip.openingMeter !== null && trip.openingMeter !== 0) {
        if (trip.openingMeter < lastMeter) {
          setLastMeterError(`Starting KM must be >= ${lastMeter} KM`);
        } else {
          setLastMeterError(null);
        }
      } else {
        // No value entered yet – no error
        setLastMeterError(null);
      }
    } else {
      setLastKnownMeter(null);
      setLastMeterError(null);
    }
  }, [trip.vehicleId, trip.openingMeter, trip.id]);

  useEffect(() => {
    const amount = trip.advanceAmount;
    if (amount === undefined || amount === null || isNaN(amount)) {
      setAdvanceError("Advance amount is required");
    } else if (amount < 0) {
      setAdvanceError("Advance amount cannot be negative");
    } else {
      setAdvanceError(null);
    }
  }, [trip.advanceAmount]);

  const handleHelpersChange = (selectedOptions: any) => {
    const helpers = selectedOptions ? selectedOptions.map((opt: any) => opt.employeeName) : [];
    updateTrip({ helpers });
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    const success = submitStartStep({});
    if (success) {
      setIsLocalEditing(false);
    }
    setIsSubmitting(false);
  };

  const selectStyles = {
    menuPortal: (base: any) => ({ ...base, zIndex: 9999 }),
    control: (base: any, state: any) => ({
      ...base,
      minHeight: 42,
      borderRadius: 12,
      borderColor: state.isFocused ? "#2563eb" : "#e2e8f0",
      backgroundColor: "#ffffff",
      boxShadow: state.isFocused ? "0 0 0 4px rgba(37, 99, 235, 0.1)" : "none",
      "&:hover": { borderColor: "#cbd5e1" },
    }),
    option: (base: any, { isFocused, isSelected }: any) => ({
      ...base,
      backgroundColor: isSelected ? "#2563eb" : isFocused ? "#f1f5f9" : "transparent",
      color: isSelected ? "white" : "#334155",
      fontSize: "13px",
      cursor: "pointer",
    }),
    menu: (base: any) => ({
      ...base,
      maxHeight: 180,
      overflowY: "auto",
      scrollbarWidth: "none",
      "::-webkit-scrollbar": { display: "none" },
    }),
  };

  const hasBlockingError = !!lastMeterError || !!advanceError;

  // LOCKED VIEW
  if (trip.startStepSubmitted && !editable && !isLocalEditing) {
    return (
      <div className="bg-blue-50/30 border-2 border-blue-100 rounded-2xl p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-blue-200 pb-3 gap-3">
          <h2 className="text-base sm:text-lg font-bold text-blue-800">1. TRIP START (AT OFFICE)</h2>
          <div className="flex items-center gap-2 shrink-0">
            {canEdit && (
              <button
                onClick={() => setIsLocalEditing(true)}
                className="bg-white hover:bg-blue-50 p-1.5 rounded-lg border border-blue-200 text-blue-600 shadow-sm transition-all active:scale-95"
                title="Edit Step"
                aria-label="Edit trip start details"
              >
                <Pencil size={14} />
              </button>
            )}
            <span className="bg-blue-600 text-white px-3 sm:px-4 py-1.5 rounded-full text-[11px] sm:text-xs font-bold shadow-sm whitespace-nowrap">
              ✅ SUBMITTED & LOCKED
            </span>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 pt-2">
          <div className="bg-white p-4 rounded-xl shadow-sm">
            <p className="text-xs text-slate-500">Start Time</p>
            <p className="font-semibold text-slate-800">{trip.startTime || "--"}</p>
          </div>
          <div className="bg-white p-4 rounded-xl shadow-sm">
            <p className="text-xs text-slate-500">Vehicle</p>
            <p className="font-semibold text-slate-800">{trip.vehicleNo}</p>
          </div>
          <div className="bg-white p-4 rounded-xl shadow-sm">
            <p className="text-xs text-slate-500">Supervisor</p>
            <p className="font-semibold text-slate-800">{trip.supervisorName}</p>
          </div>
          <div className="bg-white p-4 rounded-xl shadow-sm">
            <p className="text-xs text-slate-500">Driver</p>
            <p className="font-semibold text-slate-800">{trip.driverName}</p>
          </div>
          <div className="bg-white p-4 rounded-xl shadow-sm col-span-1">
            <p className="text-xs text-slate-500">Opening Meter</p>
            <p className="font-semibold text-slate-800">{trip.openingMeter} KM</p>
          </div>
          <div className="bg-white p-4 rounded-xl shadow-sm col-span-1">
            <p className="text-xs text-slate-500">Advance / Expenses</p>
            <p className="font-semibold text-slate-800">
              ₹{(trip.advanceAmount ?? 0).toLocaleString()}
            </p>
          </div>
          <div className="bg-white p-4 rounded-xl shadow-sm col-span-2">
            <p className="text-xs text-slate-500">Helpers</p>
            <p className="font-semibold text-slate-800">{trip.helpers.join(", ") || "--"}</p>
          </div>
        </div>
        <p className="text-sm text-emerald-700 bg-emerald-50 p-3 rounded-lg mt-2 border border-emerald-200">
          ✅ Start details submitted successfully.
        </p>
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
      <div className="bg-white border border-slate-200/80 shadow-sm rounded-2xl p-5 sm:p-6 space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 gap-3">
          <div className="flex items-center gap-3">
            <span className="bg-blue-700 text-white w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold shrink-0">
              1
            </span>
            <h2 className="text-base sm:text-lg font-bold text-slate-800 tracking-tight">
              TRIP START (AT OFFICE)
            </h2>
          </div>
          {((editable && trip.startStepSubmitted) || isLocalEditing) && (
            <span className="text-xs text-blue-600 font-medium bg-blue-50 px-3 py-1 rounded-full border border-blue-200 whitespace-nowrap">
              ✏️ Editable View
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6">
          <div>
            <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
              <Clock size={14} className="text-slate-400" /> Start Time <span className="text-red-500">*</span>
            </label>
            <div className="mt-1.5 h-[42px] bg-slate-50/80 border border-slate-200 rounded-xl px-4 flex items-center text-sm font-medium text-slate-700">
              {trip.startTime ? trip.startTime : <span className="text-slate-400 font-normal">Auto-captured on submit</span>}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
              <Truck size={14} className="text-slate-400" /> Vehicle No. <span className="text-red-500">*</span>
            </label>
            <Select<{ id: number; vehicleNumber: string }, false>
              options={vehicleOptions}
              getOptionLabel={(e) => e?.vehicleNumber || ""}
              getOptionValue={(e) => e?.vehicleNumber || ""}
              value={vehicleOptions.find((o) => o.id === trip.vehicleId) || null}
              onChange={(e) => setTrip((prev) => ({ ...prev, vehicleId: e?.id || 0, vehicleNo: e?.vehicleNumber || "" }))}
              className="mt-1.5 text-sm"
              placeholder="Search Vehicle..."
              isSearchable
              styles={selectStyles}
              menuPortalTarget={typeof document !== "undefined" ? document.body : undefined}
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
              <User size={14} className="text-slate-400" /> Supervisor <span className="text-red-500">*</span>
            </label>
            <Select<{ id: number; employeeName: string; department: string }, false>
              options={supervisorOptions}
              getOptionLabel={(e) => e?.employeeName || ""}
              getOptionValue={(e) => e?.employeeName || ""}
              value={supervisorOptions.find((o) => o.employeeName === trip.supervisorName) || null}
              onChange={(e) => setTrip((prev) => ({ ...prev, supervisorId: e?.id || 0, supervisorName: e?.employeeName || "" }))}
              className="mt-1.5 text-sm"
              placeholder="Search Supervisor..."
              isSearchable
              styles={selectStyles}
              menuPortalTarget={typeof document !== "undefined" ? document.body : undefined}
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
              <User size={14} className="text-slate-400" /> Driver <span className="text-red-500">*</span>
            </label>
            <Select<{ id: number; employeeName: string; department: string }, false>
              options={driverOptions}
              getOptionLabel={(e) => e?.employeeName || ""}
              getOptionValue={(e) => e?.employeeName || ""}
              value={driverOptions.find((o) => o.employeeName === trip.driverName) || null}
              onChange={(e) => setTrip((prev) => ({ ...prev, driverId: e?.id || 0, driverName: e?.employeeName || "" }))}
              className="mt-1.5 text-sm"
              placeholder="Search Driver..."
              isSearchable
              styles={selectStyles}
              menuPortalTarget={typeof document !== "undefined" ? document.body : undefined}
            />
          </div>

          {/* Starting Meter */}
          <div>
            <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
              <Gauge size={14} className="text-slate-400" /> Starting Meter (KM) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              // ✅ Show empty when value is 0 or undefined
              value={trip.openingMeter === 0 ? "" : trip.openingMeter ?? ""}
              onChange={(e) => {
                const val = e.target.value;
                // ✅ If empty, set undefined (so no validation error), else number
                updateTrip({ openingMeter: val === "" ? undefined : Number(val) });
              }}
              onWheel={(e) => e.currentTarget.blur()}
              onKeyDown={(e) => {
                if (e.key === "ArrowUp" || e.key === "ArrowDown") e.preventDefault();
              }}
              className={`hide-spinner w-full mt-1.5 rounded-xl border ${
                lastMeterError ? "border-red-500" : "border-slate-200"
              } bg-slate-50/80 px-4 py-2.5 text-sm font-medium text-slate-800 focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all`}
              placeholder="0.00"
            />
            {lastKnownMeter !== null && (
              <p className="mt-1.5 text-xs text-slate-500 flex items-center gap-1">
                Last End Trip Reading (KM):- <span className="font-bold text-slate-700">{lastKnownMeter.toLocaleString()}</span>
              </p>
            )}
            {lastMeterError && (
              <p className="mt-1 text-xs text-red-600 font-medium flex items-center gap-1">
                <span className="block w-1 h-1 rounded-full bg-red-600" /> {lastMeterError}
              </p>
            )}
          </div>

          {/* Advance */}
          <div>
            <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
              <Wallet size={14} className="text-slate-400" /> Advance / Expenses <span className="text-red-500">*</span>
            </label>
            <div className="relative mt-1.5">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-400">₹</span>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={trip.advanceAmount === 0 ? "" : trip.advanceAmount ?? ""}
                onChange={(e) => {
                  const val = e.target.value;
                  updateTrip({ advanceAmount: val === "" ? undefined : Number(val) });
                }}
                onWheel={(e) => e.currentTarget.blur()}
                onKeyDown={(e) => {
                  if (e.key === "ArrowUp" || e.key === "ArrowDown") e.preventDefault();
                }}
                className={`hide-spinner w-full rounded-xl border ${
                  advanceError ? "border-red-500" : "border-slate-200"
                } bg-slate-50/80 pl-8 pr-4 py-2.5 text-sm font-medium text-slate-800 focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all`}
                placeholder="0.00"
              />
            </div>
            <p className="mt-1.5 text-xs text-slate-500">Cash handed to driver/supervisor before departure</p>
            {advanceError && (
              <p className="mt-1 text-xs text-red-600 font-medium flex items-center gap-1">
                <span className="block w-1 h-1 rounded-full bg-red-600" /> {advanceError}
              </p>
            )}
          </div>

          <div className="sm:col-span-2">
            <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
              <Users size={14} className="text-slate-400" /> Helpers <span className="text-red-500">*</span>
            </label>
            <div className="mt-1.5">
              <Select<{ id: number; employeeName: string; department: string }, true>
                isMulti
                options={helperOptions}
                getOptionLabel={(e) => e?.employeeName || ""}
                getOptionValue={(e) => e?.employeeName || ""}
                value={trip.helpers
                  .map((name) => helperOptions.find((opt) => opt.employeeName === name))
                  .filter((item): item is { id: number; employeeName: string; department: string } => item !== undefined)}
                onChange={handleHelpersChange}
                className="text-sm"
                placeholder="Search and select helpers..."
                styles={selectStyles}
                menuPortalTarget={typeof document !== "undefined" ? document.body : undefined}
              />
              <p className="text-[11px] text-slate-400 mt-1">Tap to select</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 sm:gap-4 pt-4 border-t border-slate-100 mt-6">
          {(editable || isLocalEditing) && (
            <button
              onClick={() => {
                if (editable && onCancel) onCancel();
                else setIsLocalEditing(false);
              }}
              className="px-6 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-sm font-medium text-slate-600 transition-all shadow-sm active:scale-95 flex items-center justify-center gap-2"
            >
              <X size={15} /> Close
            </button>
          )}
          {!trip.startStepSubmitted && !editable && clearForm && (
            <button
              onClick={clearForm}
              className="px-6 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-sm font-medium text-slate-600 transition-all shadow-sm active:scale-95"
            >
              Clear Form
            </button>
          )}
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || hasBlockingError}
            className={`px-8 py-2.5 rounded-xl text-sm font-semibold text-white shadow-md transition-all active:scale-[0.98] ${
              hasBlockingError ? "bg-slate-400 cursor-not-allowed shadow-none" : "bg-blue-700 hover:bg-blue-800 shadow-blue-200"
            }`}
          >
            {isSubmitting ? "Saving..." : trip.startStepSubmitted ? "Update Start Details" : "Submit Start Details"}
          </button>
        </div>
      </div>
    </>
  );
}