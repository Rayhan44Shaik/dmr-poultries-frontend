import React, { useState } from "react";
import { Clock, MapPin, Gauge, Store, Ticket, MessageSquare, Pencil, X, Loader2, Scale } from "lucide-react";
import Select from "react-select";
import type { Trip } from "../types/trip";

interface Props {
  trip: Trip;
  setTrip: React.Dispatch<React.SetStateAction<Trip>>;
  updateTrip: (updates: Partial<Trip>) => void;
  submitFarmStep: (data: Partial<Trip>) => boolean;
  farms: any[];
  editable?: boolean;
  canEdit?: boolean;
  onCancel?: () => void;
  showNotification?: (message: string, type?: "info" | "success" | "error" | "warning") => void; // ← new
}

export default function StepFarm({
  trip,
  setTrip,
  updateTrip,
  submitFarmStep,
  farms,
  editable = false,
  canEdit = false,
  onCancel,
  showNotification, // ← new
}: Props) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLocalEditing, setIsLocalEditing] = useState(false);
  const [destMeterError, setDestMeterError] = useState<string | null>(null);
  const [isFetchingLocation, setIsFetchingLocation] = useState(false);

  const farmAddress = (trip as any).farmAddress || "";
  const remarks = trip.remarks || "";
  const avgBirdWeight = (trip as any).avgBirdWeight || 0;

  const farmOptions = farms.map((farm: any) => ({
    value: farm.id,
    label: farm.farmName,
  }));

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

  const fetchCurrentLocation = () => {
    if (!navigator.geolocation) {
      showNotification?.("Geolocation is not supported by your browser.", "error");
      return;
    }
    setIsFetchingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`
          );
          const data = await response.json();
          if (data && data.display_name) {
            updateTrip({ farmAddress: data.display_name } as any);
          } else {
            const fallback = `Lat: ${latitude.toFixed(6)}, Lon: ${longitude.toFixed(6)}`;
            updateTrip({ farmAddress: fallback } as any);
          }
        } catch (error) {
          console.error("Reverse geocoding error:", error);
          const fallback = `Lat: ${latitude.toFixed(6)}, Lon: ${longitude.toFixed(6)}`;
          updateTrip({ farmAddress: fallback } as any);
        } finally {
          setIsFetchingLocation(false);
        }
      },
      (error) => {
        console.error("Geolocation error:", error);
        showNotification?.("Unable to fetch location. Check browser permissions.", "error");
        setIsFetchingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleAddressChange = (value: string) => {
    updateTrip({ farmAddress: value } as any);
  };

  const handleDestMeterChange = (value: string) => {
    const num = value === "" ? 0 : Number(value);
    updateTrip({ destMeter: num });
    if (num > 0 && trip.openingMeter > 0 && num <= trip.openingMeter) {
      setDestMeterError(`Destination Meter must be greater than Start Meter (${trip.openingMeter} KM)`);
    } else {
      setDestMeterError(null);
    }
  };

  const handleClear = () => {
    updateTrip({
      sourceFarmId: 0,
      sourceFarm: "",
      destMeter: 0,
      pickupTolls: 0,
      remarks: "",
      farmAddress: "",
      avgBirdWeight: 0,
    } as any);
    setDestMeterError(null);
  };

  const handleSubmit = async () => {
    if (!trip.sourceFarmId || !trip.sourceFarm) {
      showNotification?.("Please select a Destination / Farm.", "warning");
      return;
    }
    if (!trip.destMeter || trip.destMeter <= 0) {
      showNotification?.("Please enter a valid Destination Meter (KM).", "warning");
      return;
    }
    if (destMeterError) {
      showNotification?.(destMeterError, "warning");
      return;
    }
    if (trip.pickupTolls === undefined || trip.pickupTolls < 0) {
      showNotification?.("Please enter valid Toll Gates.", "warning");
      return;
    }
    if (!(trip as any).avgBirdWeight || (trip as any).avgBirdWeight <= 0) {
      showNotification?.("Please enter a valid Average Bird Weight.", "warning");
      return;
    }

    setIsSubmitting(true);
    const success = submitFarmStep({});
    if (success) {
      setIsLocalEditing(false);
      showNotification?.("Destination details saved successfully.", "success");
    } else {
      showNotification?.("Submission failed. Please try again.", "error");
    }
    setIsSubmitting(false);
  };

  // LOCKED VIEW
  if (trip.farmStepSubmitted && !editable && !isLocalEditing) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 gap-3">
          <div className="flex items-center gap-2.5">
            <span className="bg-blue-600 text-white w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0">
              2
            </span>
            <h2 className="text-base font-bold text-slate-800 tracking-tight">
              REACHED FARM / DESTINATION
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
            <p className="text-xs text-slate-500 font-medium">Reached Time</p>
            <p className="font-semibold text-slate-900 mt-0.5">{trip.reachedTime || "--"}</p>
          </div>
          <div className="bg-white border border-slate-200/80 p-4 rounded-xl">
            <p className="text-xs text-slate-500 font-medium">Farm</p>
            <p className="font-semibold text-slate-900 mt-0.5 truncate">{trip.sourceFarm || "--"}</p>
          </div>
          <div className="bg-white border border-slate-200/80 p-4 rounded-xl col-span-2">
            <p className="text-xs text-slate-500 font-medium">Farm Address</p>
            <p className="font-semibold text-slate-900 mt-0.5 truncate">{farmAddress || "--"}</p>
          </div>
          <div className="bg-white border border-slate-200/80 p-4 rounded-xl">
            <p className="text-xs text-slate-500 font-medium">Destination Meter</p>
            <p className="font-semibold text-slate-900 mt-0.5">{trip.destMeter ? `${trip.destMeter} KM` : "--"}</p>
          </div>
          <div className="bg-white border border-slate-200/80 p-4 rounded-xl">
            <p className="text-xs text-slate-500 font-medium">Toll Gates (Pickup)</p>
            <p className="font-semibold text-slate-900 mt-0.5">{trip.pickupTolls ?? "--"}</p>
          </div>
          <div className="bg-white border border-slate-200/80 p-4 rounded-xl col-span-2 md:col-span-2">
            <p className="text-xs text-slate-500 font-medium">Avg Bird Weight (kg)</p>
            <p className="font-semibold text-slate-900 mt-0.5">{avgBirdWeight > 0 ? `${avgBirdWeight} kg` : "--"}</p>
          </div>
          <div className="bg-white border border-slate-200/80 p-4 rounded-xl col-span-2 md:col-span-2">
            <p className="text-xs text-slate-500 font-medium">Remarks</p>
            <p className="font-semibold text-slate-900 mt-0.5 truncate">{remarks || "--"}</p>
          </div>
        </div>

        <p className="text-xs text-slate-600 bg-white p-3 rounded-xl border border-slate-200 mt-2">
          Destination details submitted successfully.
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
              2
            </span>
            <h2 className="text-base font-bold text-slate-800 tracking-tight">
              REACHED FARM / DESTINATION
            </h2>
          </div>
          {((editable && trip.farmStepSubmitted) || isLocalEditing) && (
            <span className="text-xs text-slate-700 font-medium bg-slate-100 px-3 py-1 rounded-full border border-slate-200 whitespace-nowrap">
              Editable View
            </span>
          )}
        </div>

        {/* Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 sm:gap-x-6 gap-y-3.5 sm:gap-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
              <Clock size={14} className="text-slate-400" /> Reached Time <span className="text-red-500">*</span>
            </label>
            <div className="mt-1 h-[42px] bg-white border border-slate-200 rounded-xl px-4 flex items-center text-sm font-medium text-slate-800">
              {trip.reachedTime ? trip.reachedTime : <span className="text-slate-400 font-normal">Auto-captured on submit</span>}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
              <Store size={14} className="text-slate-400" /> Farm <span className="text-red-500">*</span>
            </label>
            <Select<{ value: number; label: string }, false>
              options={farmOptions}
              getOptionLabel={(e) => e?.label || ""}
              getOptionValue={(e) => e?.value.toString() || ""}
              value={farmOptions.find((o) => o.value === trip.sourceFarmId) || null}
              onChange={(e) =>
                setTrip((prev) => ({
                  ...prev,
                  sourceFarmId: e?.value || 0,
                  sourceFarm: e?.label || "",
                }))
              }
              className="mt-1 text-sm"
              placeholder="Search Farm..."
              isSearchable
              styles={selectStyles}
              menuPortalTarget={typeof document !== "undefined" ? document.body : undefined}
            />
          </div>

          <div className="sm:col-span-2">
            <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
              <MapPin size={14} className="text-slate-400" /> Detailed Farm Address
            </label>
            <div className="flex items-center gap-2 mt-1">
              <input
                type="text"
                value={farmAddress}
                onChange={(e) => handleAddressChange(e.target.value)}
                className="flex-1 h-[42px] rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-800 focus:border-blue-600 focus:ring-2 focus:ring-blue-500/10 outline-none transition-all placeholder:text-slate-400"
                placeholder="Enter farm address details..."
              />
              <button
                type="button"
                onClick={fetchCurrentLocation}
                disabled={isFetchingLocation}
                className="shrink-0 h-[42px] px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-all active:scale-95 flex items-center gap-1.5 text-xs font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isFetchingLocation ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <MapPin size={16} />
                )}
                <span className="hidden sm:inline">Get GPS</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Auto-fill address using current device location</p>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
              <Gauge size={14} className="text-slate-400" /> Destination Meter (KM) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={trip.destMeter === 0 ? "" : trip.destMeter ?? ""}
              onChange={(e) => handleDestMeterChange(e.target.value)}
              onWheel={(e) => e.currentTarget.blur()}
              className={`hide-spinner w-full mt-1 h-[42px] rounded-xl border ${
                destMeterError ? "border-red-500" : "border-slate-200"
              } bg-white px-4 text-sm font-medium text-slate-800 focus:border-blue-600 focus:ring-2 focus:ring-blue-500/10 outline-none transition-all placeholder:text-slate-400`}
              placeholder="0.00"
            />
            {destMeterError ? (
              <p className="text-[11px] text-red-500 font-medium mt-1">{destMeterError}</p>
            ) : (
              <p className="text-[11px] text-slate-400 mt-1">
                Start Meter: <span className="font-semibold text-slate-600">{trip.openingMeter || 0} KM</span>
              </p>
            )}
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
              <Ticket size={14} className="text-slate-400" /> Toll Gates (Pickup) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              inputMode="numeric"
              min="0"
              value={trip.pickupTolls === 0 ? "" : trip.pickupTolls ?? ""}
              onChange={(e) =>
                updateTrip({ pickupTolls: e.target.value === "" ? 0 : Number(e.target.value) })
              }
              onWheel={(e) => e.currentTarget.blur()}
              className="hide-spinner w-full mt-1 h-[42px] rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-800 focus:border-blue-600 focus:ring-2 focus:ring-blue-500/10 outline-none transition-all placeholder:text-slate-400"
              placeholder="0"
            />
            <p className="text-[11px] text-slate-400 mt-1">Total tolls passed on the way</p>
          </div>

          {/* SAME HEIGHT PAIR: Avg Bird Weight & Remarks */}
          <div>
            <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
              <Scale size={14} className="text-slate-400" /> Avg Bird Weight (kg) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={avgBirdWeight === 0 ? "" : avgBirdWeight}
              onChange={(e) => {
                const val = e.target.value === "" ? 0 : Number(e.target.value);
                updateTrip({ avgBirdWeight: val } as any);
              }}
              onWheel={(e) => e.currentTarget.blur()}
              className="hide-spinner w-full mt-1 h-[42px] rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-800 focus:border-blue-600 focus:ring-2 focus:ring-blue-500/10 outline-none transition-all placeholder:text-slate-400"
              placeholder="e.g., 1.5"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
              <MessageSquare size={14} className="text-slate-400" /> Remarks
            </label>
            <input
              type="text"
              value={remarks}
              onChange={(e) => updateTrip({ remarks: e.target.value })}
              className="w-full mt-1 h-[42px] rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-800 focus:border-blue-600 focus:ring-2 focus:ring-blue-500/10 outline-none transition-all placeholder:text-slate-400"
              placeholder="Enter any additional notes..."
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-3 border-t border-slate-100">
          {!trip.farmStepSubmitted && !editable && (
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
              !!destMeterError ||
              !trip.sourceFarmId ||
              !(trip as any).avgBirdWeight ||
              (trip as any).avgBirdWeight <= 0
            }
            className={`w-full sm:w-auto px-6 py-2.5 rounded-xl text-xs font-bold text-white transition-all active:scale-95 ${
              isSubmitting ||
              !!destMeterError ||
              !trip.sourceFarmId ||
              !(trip as any).avgBirdWeight ||
              (trip as any).avgBirdWeight <= 0
                ? "bg-blue-400 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700 shadow-sm"
            }`}
          >
            {isSubmitting
              ? "Saving..."
              : trip.farmStepSubmitted
              ? "Update Destination Details"
              : "Submit Destination Details"}
          </button>
        </div>
      </div>
    </>
  );
}