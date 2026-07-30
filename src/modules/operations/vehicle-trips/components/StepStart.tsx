import React, { useState, useEffect } from "react";
import { Clock, User, Truck, Gauge, Wallet, Pencil, X } from "lucide-react";
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
      if (trip.openingMeter !== undefined && trip.openingMeter !== null && trip.openingMeter !== 0) {
        if (trip.openingMeter < lastMeter) {
          setLastMeterError(`Starting KM must be >= ${lastMeter} KM`);
        } else {
          setLastMeterError(null);
        }
      } else {
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
      borderRadius: "0.75rem",
      borderColor: state.isFocused ? "#2563eb" : "#e2e8f0",
      backgroundColor: "#ffffff",
      boxShadow: state.isFocused ? "0 0 0 2px rgba(37, 99, 235, 0.15)" : "none",
      "&:hover": { borderColor: "#cbd5e1" },
    }),
    singleValue: (base: any) => ({
      ...base,
      color: "#0f172a",
      fontWeight: "500",
      fontSize: "14px",
    }),
    multiValue: (base: any) => ({
      ...base,
      backgroundColor: "#f1f5f9",
      borderRadius: "0.375rem",
    }),
    multiValueLabel: (base: any) => ({
      ...base,
      color: "#0f172a",
      fontSize: "13px",
      paddingLeft: "6px",
      paddingRight: "6px",
    }),
    multiValueRemove: (base: any) => ({
      ...base,
      color: "#64748b",
      "&:hover": { backgroundColor: "#e2e8f0", color: "#0f172a" },
    }),
    placeholder: (base: any) => ({
      ...base,
      color: "#94a3b8",
      fontSize: "14px",
    }),
    option: (base: any, { isFocused, isSelected }: any) => ({
      ...base,
      backgroundColor: isSelected ? "#2563eb" : isFocused ? "#f8fafc" : "#ffffff",
      color: isSelected ? "#ffffff" : "#1e293b",
      fontSize: "13px",
      cursor: "pointer",
    }),
    menu: (base: any) => ({
      ...base,
      backgroundColor: "#ffffff",
      border: "1px solid #e2e8f0",
      borderRadius: "0.75rem",
      maxHeight: 180,
      overflowY: "auto",
      scrollbarWidth: "none",
      "::-webkit-scrollbar": { display: "none" },
    }),
  };

  // LOCKED VIEW
  if (trip.startStepSubmitted && !editable && !isLocalEditing) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 gap-3">
          <div className="flex items-center gap-2.5">
            <span className="bg-blue-600 text-white w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0">
              1
            </span>
            <h2 className="text-base font-bold text-slate-800 tracking-tight">
              TRIP START (AT OFFICE)
            </h2>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {canEdit && (
              <button
                onClick={() => setIsLocalEditing(true)}
                className="bg-white hover:bg-slate-50 p-2 rounded-lg border border-slate-200 text-slate-700 transition-all active:scale-95"
                title="Edit Step"
              >
                <Pencil size={14} />
              </button>
            )}
            <span className="bg-slate-100 border border-slate-200 text-slate-700 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap">
              Submitted & Locked
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 pt-2">
          <div className="bg-white border border-slate-200/80 p-4 rounded-xl">
            <p className="text-xs text-slate-500 font-medium">Start Time</p>
            <p className="font-semibold text-slate-900 mt-0.5">{trip.startTime || "--"}</p>
          </div>
          <div className="bg-white border border-slate-200/80 p-4 rounded-xl">
            <p className="text-xs text-slate-500 font-medium">Vehicle</p>
            <p className="font-semibold text-slate-900 mt-0.5">{trip.vehicleNo}</p>
          </div>
          <div className="bg-white border border-slate-200/80 p-4 rounded-xl">
            <p className="text-xs text-slate-500 font-medium">Supervisor</p>
            <p className="font-semibold text-slate-900 mt-0.5">{trip.supervisorName}</p>
          </div>
          <div className="bg-white border border-slate-200/80 p-4 rounded-xl">
            <p className="text-xs text-slate-500 font-medium">Driver</p>
            <p className="font-semibold text-slate-900 mt-0.5">{trip.driverName}</p>
          </div>
          <div className="bg-white border border-slate-200/80 p-4 rounded-xl col-span-1">
            <p className="text-xs text-slate-500 font-medium">Opening Meter</p>
            <p className="font-semibold text-slate-900 mt-0.5">{trip.openingMeter} KM</p>
          </div>
          <div className="bg-white border border-slate-200/80 p-4 rounded-xl col-span-1">
            <p className="text-xs text-slate-500 font-medium">Advance / Expenses</p>
            <p className="font-semibold text-slate-900 mt-0.5">
              ₹{(trip.advanceAmount ?? 0).toLocaleString()}
            </p>
          </div>
          <div className="bg-white border border-slate-200/80 p-4 rounded-xl col-span-2">
            <p className="text-xs text-slate-500 font-medium">Helpers</p>
            <p className="font-semibold text-slate-900 mt-0.5">{trip.helpers.join(", ") || "--"}</p>
          </div>
        </div>

        <p className="text-xs text-slate-600 bg-white p-3 rounded-xl border border-slate-200 mt-2">
          Start details submitted successfully.
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
      <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-6 shadow-sm">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 gap-3">
          <div className="flex items-center gap-2.5">
            <span className="bg-blue-600 text-white w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0">
              1
            </span>
            <h2 className="text-base font-bold text-slate-800 tracking-tight">
              TRIP START (AT OFFICE)
            </h2>
          </div>
          {((editable && trip.startStepSubmitted) || isLocalEditing) && (
            <span className="text-xs text-slate-700 font-medium bg-slate-100 px-3 py-1 rounded-full border border-slate-200 whitespace-nowrap">
              Editable View
            </span>
          )}
        </div>

        {/* Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 sm:gap-x-6 gap-y-3.5 sm:gap-y-4">
          {/* Start Time (read-only) */}
          <div>
            <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
              <Clock size={14} className="text-slate-400" /> Start Time <span className="text-red-500">*</span>
            </label>
            <div className="mt-1 h-[42px] bg-white border border-slate-200 rounded-xl px-4 flex items-center text-sm font-medium text-slate-800">
              {trip.startTime ? trip.startTime : <span className="text-slate-400 font-normal">Auto-captured on submit</span>}
            </div>
          </div>

          {/* Vehicle No. */}
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
              className="mt-1 text-sm"
              placeholder="Search Vehicle..."
              isSearchable
              styles={selectStyles}
              menuPortalTarget={typeof document !== "undefined" ? document.body : undefined}
            />
          </div>

          {/* Supervisor */}
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
              className="mt-1 text-sm"
              placeholder="Search Supervisor..."
              isSearchable
              styles={selectStyles}
              menuPortalTarget={typeof document !== "undefined" ? document.body : undefined}
            />
          </div>

          {/* Driver */}
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
              className="mt-1 text-sm"
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
              value={trip.openingMeter === 0 ? "" : trip.openingMeter ?? ""}
              onChange={(e) => {
                const val = e.target.value;
                updateTrip({ openingMeter: val === "" ? undefined : Number(val) });
              }}
              onWheel={(e) => e.currentTarget.blur()}
              className="hide-spinner w-full mt-1 h-[42px] rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-800 focus:border-blue-600 focus:ring-2 focus:ring-blue-500/10 outline-none transition-all placeholder:text-slate-400"
              placeholder="0.00"
            />
          </div>

          {/* Advance / Expenses */}
          <div>
            <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
              <Wallet size={14} className="text-slate-400" /> Advance / Expenses <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={trip.advanceAmount === 0 ? "" : trip.advanceAmount ?? ""}
              onChange={(e) => {
                const val = e.target.value;
                updateTrip({ advanceAmount: val === "" ? 0 : Number(val) });
              }}
              onWheel={(e) => e.currentTarget.blur()}
              className="hide-spinner w-full mt-1 h-[42px] rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-800 focus:border-blue-600 focus:ring-2 focus:ring-blue-500/10 outline-none transition-all placeholder:text-slate-400"
              placeholder="0.00"
            />
          </div>

          {/* 👇 NEW: Helpers (full width) */}
          <div className="col-span-2">
            <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
              <User size={14} className="text-slate-400" /> Helpers
            </label>
            <Select
              options={helperOptions}
              getOptionLabel={(e) => e?.employeeName || ""}
              getOptionValue={(e) => e?.employeeName || ""}
              value={helperOptions.filter((o) => trip.helpers?.includes(o.employeeName)) || []}
              onChange={handleHelpersChange}
              className="mt-1 text-sm"
              placeholder="Select helpers..."
              isMulti
              isSearchable
              styles={selectStyles}
              menuPortalTarget={typeof document !== "undefined" ? document.body : undefined}
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-3 border-t border-slate-100">
          {!trip.startStepSubmitted && !editable && (
            <button
              type="button"
              onClick={clearForm}
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
            disabled={isSubmitting}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-sm transition-all active:scale-95"
          >
            {isSubmitting
              ? "Saving..."
              : trip.startStepSubmitted
              ? "Update Start Details"
              : "Submit Start Details"}
          </button>
        </div>
      </div>
    </>
  );
}