// src/modules/operations/vehicle-trips/components/StepStart.tsx

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Clock, User, Truck, Gauge, Wallet, Pencil, X, AlertCircle } from "lucide-react";
import Select from "react-select";
import type { Trip } from "../types/trip";
import { fetchLastClosingMeter } from "../services/tripHeaderApiService";

interface Props {
  trip: Trip;
  updateTrip: (updates: Partial<Trip>) => void;
  submitStartStep: (data: Partial<Trip>) => Promise<boolean>;
  vehicleOptions: { id: number; vehicleNumber: string }[];
  employeeOptions: { id: number; employeeName: string; department: string }[];
  editable?: boolean;
  canEdit?: boolean;
  onCancel?: () => void;
  clearForm?: () => void;
  headerLoading?: boolean;
  headerSaveStatus?: "idle" | "saving" | "saved";
}

const FIELD_SYNC_DELAY_MS = 400;

function formatNumericField(value: number | undefined | null): string {
  if (value === undefined || value === null || value === 0) return "";
  return String(value);
}

function parseNumericField(text: string): number {
  if (text.trim() === "") return 0;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : 0;
}

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
    ":-webkit-scrollbar": { display: "none" },
  }),
};

function StepStart({
  trip,
  updateTrip,
  submitStartStep,
  vehicleOptions,
  employeeOptions,
  editable = false,
  canEdit = false,
  onCancel,
  clearForm,
  headerLoading = false,
  headerSaveStatus = "idle",
}: Props) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLocalEditing, setIsLocalEditing] = useState(false);
  const [lastMeterError, setLastMeterError] = useState<string | null>(null);
  const [lastKnownMeter, setLastKnownMeter] = useState<number | null>(null);
  const [advanceError, setAdvanceError] = useState<string | null>(null);
  const [openingMeterText, setOpeningMeterText] = useState(() => formatNumericField(trip.openingMeter));
  const [advanceText, setAdvanceText] = useState(() => formatNumericField(trip.advanceAmount));

  const loadedTripIdRef = useRef(trip.id);

  const lastSyncedOpeningRef = useRef(trip.openingMeter);
  const lastSyncedAdvanceRef = useRef(trip.advanceAmount);

  const driverOptions = useMemo(
    () => employeeOptions.filter((e) => e.department === "Driver"),
    [employeeOptions]
  );
  const supervisorOptions = useMemo(
    () => employeeOptions.filter((e) => e.department === "Supervisor"),
    [employeeOptions]
  );
  const helperOptions = useMemo(
    () => employeeOptions.filter((e) => e.department === "Helper" || e.department === "Labor"),
    [employeeOptions]
  );
  const loaderOptions = useMemo(
    () => employeeOptions.filter((e) => e.department === "Loader"),
    [employeeOptions]
  );

  const selectedVehicle = useMemo(
    () => vehicleOptions.find((o) => o.id === trip.vehicleId) || null,
    [vehicleOptions, trip.vehicleId]
  );
  const selectedSupervisor = useMemo(
    () => supervisorOptions.find((o) => o.employeeName === trip.supervisorName) || null,
    [supervisorOptions, trip.supervisorName]
  );
  const selectedDriver = useMemo(
    () => driverOptions.find((o) => o.employeeName === trip.driverName) || null,
    [driverOptions, trip.driverName]
  );
  const selectedHelpers = useMemo(
    () => helperOptions.filter((o) => trip.helpers?.includes(o.employeeName)),
    [helperOptions, trip.helpers]
  );
  const selectedLoaders = useMemo(
    () => loaderOptions.filter((o) => (trip as any).loaders?.includes(o.employeeName)),
    [loaderOptions, trip.loaders]
  );

  useEffect(() => {
    if (loadedTripIdRef.current === trip.id) return;
    loadedTripIdRef.current = trip.id;
    setOpeningMeterText(formatNumericField(trip.openingMeter));
    setAdvanceText(formatNumericField(trip.advanceAmount));
    lastSyncedOpeningRef.current = trip.openingMeter;
    lastSyncedAdvanceRef.current = trip.advanceAmount;
  }, [trip.id, trip.openingMeter, trip.advanceAmount]);

  useEffect(() => {
    if (!trip.vehicleId) {
      setLastKnownMeter(null);
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const last = await fetchLastClosingMeter(trip.vehicleId);
        if (cancelled) return;
        setLastKnownMeter(last && last.closingMeter > 0 ? last.closingMeter : null);
      } catch {
        if (!cancelled) {
          setLastKnownMeter(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [trip.vehicleId]);

  useEffect(() => {
    if (lastKnownMeter === null) {
      setLastMeterError(null);
      return;
    }

    const val = openingMeterText.trim();
    if (val === "") {
      setLastMeterError(null);
      return;
    }

    const parsed = Number(val);
    if (!Number.isFinite(parsed)) {
      setLastMeterError(null);
      return;
    }

    setLastMeterError(parsed < lastKnownMeter ? `Starting KM must be >= ${lastKnownMeter} KM` : null);
  }, [openingMeterText, lastKnownMeter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const openingMeter = parseNumericField(openingMeterText);
      if (openingMeter === lastSyncedOpeningRef.current) return;
      lastSyncedOpeningRef.current = openingMeter;
      updateTrip({ openingMeter });
    }, FIELD_SYNC_DELAY_MS);

    return () => clearTimeout(timer);
  }, [openingMeterText, updateTrip]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const advanceAmount = parseNumericField(advanceText);
      if (advanceAmount === lastSyncedAdvanceRef.current) return;
      lastSyncedAdvanceRef.current = advanceAmount;
      updateTrip({ advanceAmount });
    }, FIELD_SYNC_DELAY_MS);

    return () => clearTimeout(timer);
  }, [advanceText, updateTrip]);

  useEffect(() => {
    if (advanceText.trim() === "") {
      setAdvanceError("Advance amount is required");
      return;
    }

    const amount = Number(advanceText);
    if (!Number.isFinite(amount)) {
      setAdvanceError("Advance amount is required");
    } else if (amount < 0) {
      setAdvanceError("Advance amount cannot be negative");
    } else {
      setAdvanceError(null);
    }
  }, [advanceText]);

  const handleHelpersChange = useCallback(
    (selectedOptions: any) => {
      const helpers = selectedOptions ? selectedOptions.map((opt: any) => opt.employeeName) : [];
      updateTrip({ helpers });
    },
    [updateTrip]
  );

  const handleLoadersChange = useCallback(
    (selectedOptions: any) => {
      const loaders = selectedOptions ? selectedOptions.map((opt: any) => opt.employeeName) : [];
      updateTrip({ loaders } as Partial<Trip>);
    },
    [updateTrip]
  );

  const inputsLocked = headerLoading || isSubmitting;
  const submitLabel = isSubmitting
    ? "Saving..."
    : trip.startStepSubmitted
    ? "Update Start Details"
    : "Submit Start Details";

  const handleSubmit = async () => {
    if (lastMeterError || advanceError) return;
    setIsSubmitting(true);
    updateTrip({
      openingMeter: parseNumericField(openingMeterText),
      advanceAmount: parseNumericField(advanceText),
    });
    const success = await submitStartStep({});
    if (success) {
      setIsLocalEditing(false);
    }
    setIsSubmitting(false);
  };

  // ─── LOCKED VIEW ───────────────────────────────────────────────────
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

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
          <div className="bg-white border border-slate-200/80 p-3 rounded-xl flex flex-col justify-between shadow-2xs">
            <span className="text-[10px] uppercase font-semibold text-slate-400 flex items-center gap-1 mb-1">
              <Clock size={12} className="text-slate-500" /> Start Time
            </span>
            <span className="text-xs font-bold text-slate-800 truncate">{trip.startTime || "--"}</span>
          </div>

          <div className="bg-white border border-slate-200/80 p-3 rounded-xl flex flex-col justify-between shadow-2xs">
            <span className="text-[10px] uppercase font-semibold text-slate-400 flex items-center gap-1 mb-1">
              <Truck size={12} className="text-blue-500" /> Vehicle No.
            </span>
            <span className="text-xs font-bold text-slate-800 truncate">{trip.vehicleNo || "--"}</span>
          </div>

          <div className="bg-white border border-slate-200/80 p-3 rounded-xl flex flex-col justify-between shadow-2xs">
            <span className="text-[10px] uppercase font-semibold text-slate-400 flex items-center gap-1 mb-1">
              <User size={12} className="text-indigo-500" /> Supervisor
            </span>
            <span className="text-xs font-bold text-slate-800 truncate">{trip.supervisorName || "--"}</span>
          </div>

          <div className="bg-white border border-slate-200/80 p-3 rounded-xl flex flex-col justify-between shadow-2xs">
            <span className="text-[10px] uppercase font-semibold text-slate-400 flex items-center gap-1 mb-1">
              <User size={12} className="text-emerald-500" /> Driver
            </span>
            <span className="text-xs font-bold text-slate-800 truncate">{trip.driverName || "--"}</span>
          </div>

          <div className="bg-white border border-slate-200/80 p-3 rounded-xl flex flex-col justify-between shadow-2xs">
            <span className="text-[10px] uppercase font-semibold text-slate-400 flex items-center gap-1 mb-1">
              <Gauge size={12} className="text-purple-500" /> Opening Meter
            </span>
            <span className="text-xs font-bold text-slate-800">{trip.openingMeter ? `${trip.openingMeter} KM` : "--"}</span>
          </div>

          <div className="bg-white border border-slate-200/80 p-3 rounded-xl flex flex-col justify-between shadow-2xs">
            <span className="text-[10px] uppercase font-semibold text-slate-400 flex items-center gap-1 mb-1">
              <Wallet size={12} className="text-amber-500" /> Advance / Expenses
            </span>
            <span className="text-xs font-bold text-slate-800">₹{(trip.advanceAmount ?? 0).toLocaleString()}</span>
          </div>

          <div className="bg-white border border-slate-200/80 p-3 rounded-xl flex flex-col justify-between shadow-2xs sm:col-span-1">
            <span className="text-[10px] uppercase font-semibold text-slate-400 flex items-center gap-1 mb-1">
              <User size={12} className="text-slate-500" /> Helpers
            </span>
            <span className="text-xs font-bold text-slate-800 truncate">{trip.helpers?.join(", ") || "--"}</span>
          </div>

          <div className="bg-white border border-slate-200/80 p-3 rounded-xl flex flex-col justify-between shadow-2xs sm:col-span-1">
            <span className="text-[10px] uppercase font-semibold text-slate-400 flex items-center gap-1 mb-1">
              <User size={12} className="text-amber-500" /> Loaders
            </span>
            <span className="text-xs font-bold text-slate-800 truncate">
              {(trip as any).loaders?.join(", ") || "--"}
            </span>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-3.5 flex items-center justify-between">
          <p className="text-xs text-slate-600 font-normal">
            Start details submitted successfully.
          </p>
        </div>
      </div>
    );
  }

  // ─── EDIT / ACTIVE STATE ───────────────────────────────────────────
  return (
    <>
      <style>{`
        .hide-spinner::-webkit-inner-spin-button,
        .hide-spinner::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
        .hide-spinner { -moz-appearance: textfield; appearance: none; }
      `}</style>
      <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-6 shadow-sm">
        {headerLoading && (
          <p className="text-xs text-slate-500">Loading trip header...</p>
        )}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 gap-3">
          <div className="flex items-center gap-2.5">
            <span className="bg-blue-600 text-white w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0">
              1
            </span>
            <h2 className="text-base font-bold text-slate-800 tracking-tight">
              TRIP START (AT OFFICE)
            </h2>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {headerSaveStatus === "saving" && (
              <span className="text-[11px] text-slate-400">Saving...</span>
            )}
            {headerSaveStatus === "saved" && (
              <span className="text-[11px] text-emerald-600">Saved</span>
            )}
            {((editable && trip.startStepSubmitted) || isLocalEditing) && (
              <span className="text-xs text-slate-700 font-medium bg-slate-100 px-3 py-1 rounded-full border border-slate-200 whitespace-nowrap">
                Editable View
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 sm:gap-x-6 gap-y-4 sm:gap-y-5">
          <div>
            <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
              <Clock size={14} className="text-slate-400" /> Start Time <span className="text-red-500">*</span>
            </label>
            <div className="mt-1 h-[42px] bg-white border border-slate-200 rounded-xl px-4 flex items-center text-sm font-medium text-slate-800">
              {trip.startTime ? (
                trip.startTime
              ) : (
                <span className="text-slate-400 font-normal text-xs">Will be captured when trip starts</span>
              )}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
              <Truck size={14} className="text-slate-400" /> Vehicle No. <span className="text-red-500">*</span>
            </label>
            <Select<{ id: number; vehicleNumber: string }, false>
              options={vehicleOptions}
              getOptionLabel={(e) => e?.vehicleNumber || ""}
              getOptionValue={(e) => String(e?.id ?? "")}
              value={selectedVehicle}
              onChange={(e) => updateTrip({ vehicleId: e?.id || 0, vehicleNo: e?.vehicleNumber || "" })}
              className="mt-1 text-sm"
              placeholder="Search Vehicle..."
              isSearchable
              isDisabled={inputsLocked}
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
              value={selectedSupervisor}
              onChange={(e) => updateTrip({ supervisorId: e?.id || 0, supervisorName: e?.employeeName || "" })}
              className="mt-1 text-sm"
              placeholder="Search Supervisor..."
              isSearchable
              isDisabled={inputsLocked}
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
              value={selectedDriver}
              onChange={(e) => updateTrip({ driverId: e?.id || 0, driverName: e?.employeeName || "" })}
              className="mt-1 text-sm"
              placeholder="Search Driver..."
              isSearchable
              isDisabled={inputsLocked}
              styles={selectStyles}
              menuPortalTarget={typeof document !== "undefined" ? document.body : undefined}
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
              <Gauge size={14} className="text-slate-400" /> Starting Meter (KM) <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={openingMeterText}
              onChange={(e) => setOpeningMeterText(e.target.value)}
              onWheel={(e) => e.currentTarget.blur()}
              disabled={inputsLocked}
              className={`hide-spinner w-full mt-1 h-[42px] rounded-xl border bg-white px-4 text-sm font-medium text-slate-800 outline-none transition-all placeholder:text-slate-400 ${
                lastMeterError
                  ? "border-red-500 focus:border-red-600 focus:ring-2 focus:ring-red-500/10"
                  : "border-slate-200 focus:border-blue-600 focus:ring-2 focus:ring-blue-500/10"
              }`}
              placeholder="0.00"
            />
            {lastKnownMeter !== null && !lastMeterError && (
              <p className="text-[11px] text-slate-400 mt-1">
                Last recorded closing meter: <span className="text-slate-700 font-semibold">{lastKnownMeter} KM</span>
              </p>
            )}
            {lastMeterError && (
              <p className="text-[11px] text-red-500 mt-1 font-medium flex items-center gap-1">
                <AlertCircle size={12} /> {lastMeterError}
              </p>
            )}
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
              <Wallet size={14} className="text-slate-400" /> Advance / Expenses <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={advanceText}
              onChange={(e) => setAdvanceText(e.target.value)}
              onWheel={(e) => e.currentTarget.blur()}
              disabled={inputsLocked}
              className={`hide-spinner w-full mt-1 h-[42px] rounded-xl border bg-white px-4 text-sm font-medium text-slate-800 outline-none transition-all placeholder:text-slate-400 ${
                advanceError
                  ? "border-red-500 focus:border-red-600 focus:ring-2 focus:ring-red-500/10"
                  : "border-slate-200 focus:border-blue-600 focus:ring-2 focus:ring-blue-500/10"
              }`}
              placeholder="0.00"
            />
            {advanceError && (
              <p className="text-[11px] text-red-500 mt-1 font-medium flex items-center gap-1">
                <AlertCircle size={12} /> {advanceError}
              </p>
            )}
          </div>

          <div className="col-span-1 sm:col-span-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                  <User size={14} className="text-slate-400" /> Helpers
                </label>
                <Select
                  options={helperOptions}
                  getOptionLabel={(e) => e?.employeeName || ""}
                  getOptionValue={(e) => e?.employeeName || ""}
                  value={selectedHelpers}
                  onChange={handleHelpersChange}
                  className="mt-1 text-sm"
                  placeholder="Select helpers..."
                  isMulti
                  isSearchable
                  isDisabled={inputsLocked}
                  styles={selectStyles}
                  menuPortalTarget={typeof document !== "undefined" ? document.body : undefined}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                  <User size={14} className="text-amber-500" /> Loaders
                </label>
                <Select
                  options={loaderOptions}
                  getOptionLabel={(e) => e?.employeeName || ""}
                  getOptionValue={(e) => e?.employeeName || ""}
                  value={selectedLoaders}
                  onChange={handleLoadersChange}
                  className="mt-1 text-sm"
                  placeholder="Select loaders..."
                  isMulti
                  isSearchable
                  isDisabled={inputsLocked}
                  styles={selectStyles}
                  menuPortalTarget={typeof document !== "undefined" ? document.body : undefined}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-4 border-t border-slate-100">
          {!trip.startStepSubmitted && !editable && (
            <button
              type="button"
              onClick={clearForm}
              disabled={inputsLocked}
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
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all active:scale-95"
            >
              <X size={14} /> Cancel
            </button>
          )}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={inputsLocked || !!lastMeterError || !!advanceError}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed shadow-sm transition-all active:scale-95"
          >
            {submitLabel}
          </button>
        </div>
      </div>
    </>
  );
}

export default React.memo(StepStart);
