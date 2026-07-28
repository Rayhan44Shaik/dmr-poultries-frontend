import React, { useState, useEffect } from "react";
import { Clock, MapPin, Gauge, Lock, MessageSquare, Store, Ticket, Pencil, X, CheckCircle, Loader2 } from "lucide-react";
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
}: Props) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLocalEditing, setIsLocalEditing] = useState(false);
  const [destMeterError, setDestMeterError] = useState<string | null>(null);
  const [isFetchingLocation, setIsFetchingLocation] = useState(false);

  // ─── Use farmAddress from trip (fallback to empty string) ──────────
  const farmAddress = (trip as any).farmAddress || "";
  const remarks = trip.remarks || "";

  const farmOptions = farms.map((farm: any) => ({ value: farm.id, label: farm.farmName }));

  const selectStyles = {
    menuPortal: (base: any) => ({ ...base, zIndex: 9999 }),
    control: (base: any, state: any) => ({ ...base, minHeight: 38, borderRadius: 12, borderColor: state.isFocused ? "#2563eb" : "#e2e8f0", backgroundColor: "#ffffff", boxShadow: state.isFocused ? "0 0 0 4px rgba(37, 99, 235, 0.1)" : "none", "&:hover": { borderColor: "#cbd5e1" } }),
    option: (base: any, { isFocused, isSelected }: any) => ({ ...base, backgroundColor: isSelected ? "#2563eb" : isFocused ? "#f1f5f9" : "transparent", color: isSelected ? "white" : "#334155", fontSize: "13px", cursor: "pointer" }),
    menu: (base: any) => ({ ...base, maxHeight: 150, overflowY: "auto", scrollbarWidth: "none", "::-webkit-scrollbar": { display: "none" } }),
  };

  // ─── Fetch current location ──────────────────────────────────────────
  const fetchCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
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
            const address = data.display_name;
            // ✅ Store in farmAddress field
            updateTrip({ farmAddress: address } as any);
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
        alert("Unable to fetch location. Please check your browser permissions and try again.");
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
    if (num > 0 && num <= trip.openingMeter && trip.openingMeter > 0) {
      setDestMeterError(`Dest. Meter must be greater than the Start Meter (${trip.openingMeter})`);
    } else {
      setDestMeterError(null);
    }
  };

  const handleClear = () => {
    updateTrip({ sourceFarmId: 0, sourceFarm: "", destMeter: 0, pickupTolls: 0, remarks: "", farmAddress: "" } as any);
    setDestMeterError(null);
  };

  const handleSubmit = async () => {
    if (!trip.sourceFarmId || !trip.sourceFarm) return alert("Please select a Destination / Farm.");
    if (!trip.destMeter || trip.destMeter <= 0) return alert("Please enter a valid Destination Meter (KM).");
    if (destMeterError) return alert(destMeterError);
    if (!trip.pickupTolls || trip.pickupTolls <= 0) return alert("Please enter the number of Toll Gates on the pickup route.");

    setIsSubmitting(true);
    const success = submitFarmStep({});
    if (success) setIsLocalEditing(false);
    setIsSubmitting(false);
  };

  // LOCKED VIEW
  if (trip.farmStepSubmitted && !editable && !isLocalEditing) {
    return (
      <div className="bg-blue-50/30 border-2 border-blue-100 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-blue-200 pb-3">
          <div className="flex items-center gap-3">
            <span className="bg-blue-700 text-white w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold">2</span>
            <h2 className="text-lg font-bold text-blue-800">REACHED FARM / DESTINATION</h2>
          </div>
          <div className="flex items-center gap-2">
            {canEdit && (
              <button onClick={() => setIsLocalEditing(true)} className="bg-white hover:bg-blue-50 p-1.5 rounded-lg border border-blue-200 text-blue-600 shadow-sm transition-all active:scale-95" title="Edit Step">
                <Pencil size={14} />
              </button>
            )}
            <span className="bg-slate-200 text-slate-600 px-3 py-1.5 rounded-full text-xs font-bold border border-slate-300 shadow-sm flex items-center gap-1.5">
              <Lock size={12} /> Locked
            </span>
          </div>
        </div>
        
        <div className="space-y-6 pt-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white border border-slate-100 rounded-xl p-4 shadow-sm flex flex-col gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5"><Clock size={14} className="text-indigo-500" /> Reached Time</span>
              <span className="text-sm font-medium text-slate-800">{trip.reachedTime || '--'}</span>
            </div>
            <div className="bg-white border border-slate-100 rounded-xl p-4 shadow-sm flex flex-col gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5"><Store size={14} className="text-indigo-500" /> Farm</span>
              <span className="text-sm font-medium text-slate-800 truncate">{trip.sourceFarm || '--'}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="md:col-span-3 bg-white border border-slate-100 rounded-xl p-4 shadow-sm flex flex-col gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5"><MapPin size={14} className="text-indigo-500" /> Farm Address</span>
              <span className="text-sm font-medium text-slate-800 truncate">{farmAddress || '--'}</span>
            </div>
            <div className="md:col-span-1 bg-white border border-slate-100 rounded-xl p-4 shadow-sm flex flex-col gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5"><Gauge size={14} className="text-indigo-500" /> Dest. Meter (KM)</span>
              <span className="text-sm font-medium text-slate-800">{trip.destMeter} KM</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="md:col-span-1 bg-white border border-slate-100 rounded-xl p-4 shadow-sm flex flex-col gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5"><Ticket size={14} className="text-indigo-500" /> Toll Gates (Pickup)</span>
              <span className="text-sm font-medium text-slate-800">{trip.pickupTolls}</span>
            </div>
            <div className="md:col-span-3 bg-white border border-slate-100 rounded-xl p-4 shadow-sm flex flex-col gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5"><MessageSquare size={14} className="text-indigo-500" /> Remarks</span>
              <span className="text-sm font-medium text-slate-800 truncate">{remarks || '—'}</span>
            </div>
          </div>
        </div>
        <p className="text-sm text-emerald-700 bg-emerald-50 p-3 rounded-lg mt-2 border border-emerald-200">✅ Destination submitted successfully.</p>
      </div>
    );
  }

  // EDIT / ACTIVE STATE
  return (
    <>
      <style>{`.hide-spinner::-webkit-inner-spin-button,.hide-spinner::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}.hide-spinner{-moz-appearance:textfield;appearance:none}`}</style>
      <div className="bg-white border border-slate-200/80 shadow-sm rounded-2xl p-6 space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <span className="bg-blue-700 text-white w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold">2</span>
            <h2 className="text-lg font-bold text-slate-800 tracking-tight">REACHED FARM / DESTINATION</h2>
          </div>
          {((editable && trip.farmStepSubmitted) || isLocalEditing) && <span className="text-xs text-blue-600 font-medium bg-blue-50 px-3 py-1 rounded-full border border-blue-200">✏️ Editable View</span>}
        </div>

        <div className="space-y-6">
          {/* Row 1: Time & Farm */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5"><Clock size={14} className="text-slate-400" /> Reached Time</label>
              <div className="mt-1.5 h-[38px] bg-slate-50/80 border border-slate-200 rounded-xl px-4 py-2.5 flex items-center text-sm font-medium text-slate-700">
                <Clock size={16} className="text-slate-400 mr-2" />
                <span>{trip.reachedTime || '—'}</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1.5">Auto captured on submit</p>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5"><Store size={14} className="text-slate-400" /> Farm <span className="text-red-500">*</span></label>
              <Select<{ value: number; label: string }, false> options={farmOptions} getOptionLabel={(e) => e?.label || ""} getOptionValue={(e) => e?.value.toString() || ""} value={farmOptions.find((o) => o.value === trip.sourceFarmId) || null} onChange={(e) => setTrip((prev) => ({ ...prev, sourceFarmId: e?.value || 0, sourceFarm: e?.label || "" }))} className="mt-1.5 text-sm w-full" placeholder="Select" isSearchable styles={selectStyles} menuPortalTarget={document.body} />
            </div>
          </div>

          {/* Row 2: Address (with location button) */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="md:col-span-3">
              <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                <MapPin size={14} className="text-slate-400" /> Detailed Farm Address
              </label>
              <div className="flex items-center gap-2 mt-1.5">
                <input
                  type="text"
                  value={farmAddress}
                  onChange={(e) => handleAddressChange(e.target.value)}
                  className="flex-1 rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-2.5 text-sm font-medium text-slate-800 focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
                  placeholder="Enter farm address details..."
                />
                <button
                  type="button"
                  onClick={fetchCurrentLocation}
                  disabled={isFetchingLocation}
                  className="shrink-0 h-[42px] px-4 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition-all active:scale-95 flex items-center gap-1.5 text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isFetchingLocation ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <MapPin size={18} />
                  )}
                  <span className="hidden sm:inline">Get Location</span>
                </button>
              </div>
              <p className="text-[11px] text-slate-400 mt-1.5">Use your device's GPS to fill the address automatically</p>
            </div>

            <div className="md:col-span-1">
              <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5"><Gauge size={14} className="text-slate-400" /> Dest. Meter (KM) <span className="text-red-500">*</span></label>
              <div>
                <input type="number" step="0.01" min="0" onWheel={(e) => e.currentTarget.blur()} value={trip.destMeter || ""} onChange={(e) => handleDestMeterChange(e.target.value)} className={`hide-spinner w-full mt-1.5 rounded-xl border ${destMeterError ? "border-red-500" : "border-slate-200"} bg-slate-50/80 px-4 py-2.5 text-sm font-medium text-slate-800 focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all`} placeholder="Enter destination meter reading..." />
                <p className="text-[11px] text-slate-400 mt-1.5">Start: <span className="font-medium text-slate-600">{trip.openingMeter.toLocaleString()}</span></p>
                {destMeterError && <p className="mt-1 text-xs text-red-600 font-medium flex items-center gap-1"><span className="block w-1 h-1 rounded-full bg-red-600" /> {destMeterError}</p>}
              </div>
            </div>
          </div>

          {/* Row 3: Toll Gates & Remarks */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="md:col-span-1">
              <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5"><Ticket size={14} className="text-slate-400" /> Toll Gates <span className="text-red-500">*</span></label>
              <div className="mt-1.5">
                <input type="number" min="0" onWheel={(e) => e.currentTarget.blur()} value={trip.pickupTolls || ""} onChange={(e) => updateTrip({ pickupTolls: Number(e.target.value) })} className="hide-spinner w-full rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-2.5 text-sm font-medium text-slate-800 focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all" placeholder="0" />
                <p className="text-[11px] text-slate-400 mt-1.5">Tolls covered on pickup</p>
              </div>
            </div>
            <div className="md:col-span-3">
              <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5"><MessageSquare size={14} className="text-slate-400" /> Remarks</label>
              <textarea rows={1} value={remarks} onChange={(e) => updateTrip({ remarks: e.target.value })} className="w-full mt-1.5 rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-2.5 text-sm font-medium text-slate-800 focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all resize-none" placeholder="Enter any additional remarks about the farm..." />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center gap-4 pt-4 border-t border-slate-100 mt-6">
          {!trip.farmStepSubmitted && !editable && (
            <button onClick={handleClear} className="px-6 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-sm font-medium text-slate-600 transition-all shadow-sm active:scale-95">
              Clear Form
            </button>
          )}
          {(editable || isLocalEditing) && (
            <button onClick={() => {
              if (editable && onCancel) onCancel();
              else setIsLocalEditing(false);
            }} className="px-6 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-sm font-medium text-slate-600 transition-all shadow-sm active:scale-95 flex items-center gap-2">
              <X size={15} /> Close
            </button>
          )}
          <button onClick={handleSubmit} disabled={isSubmitting || !!destMeterError || !trip.sourceFarmId} className={`px-8 py-2.5 rounded-xl text-sm font-semibold text-white shadow-md transition-all active:scale-[0.98] flex items-center gap-1.5 ${isSubmitting || !!destMeterError || !trip.sourceFarmId ? "bg-blue-400/60 cursor-not-allowed shadow-none" : "bg-blue-700 hover:bg-blue-800 shadow-blue-200"}`}>
            <CheckCircle size={15} />
            {isSubmitting ? "Saving..." : (trip.farmStepSubmitted ? "Update Destination" : "Submit Destination")}
          </button>
        </div>
      </div>
    </>
  );
}