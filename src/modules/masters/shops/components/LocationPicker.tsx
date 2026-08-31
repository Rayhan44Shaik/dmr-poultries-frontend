import { useState, useRef, useEffect, useCallback } from "react";
import {
  MapPin,
  Navigation,
  CheckCircle2,
  XCircle,
  Loader2,
} from "lucide-react";
import { resolveLocation } from "../services/shopService";

type LocationPickerProps = {
  latitude: string;
  longitude: string;
  address?: string;
  onChange: (lat: string, lng: string, address?: string) => void;
  disabled?: boolean;
};

function LocationPicker({
  latitude,
  longitude,
  address: initialAddress,
  onChange,
  disabled = false,
}: LocationPickerProps) {
  const [locationInput, setLocationInput] = useState("");
  const [isResolving, setIsResolving] = useState(false);
  const [isGettingGps, setIsGettingGps] = useState(false);
  const [error, setError] = useState("");
  const [capturedAddress, setCapturedAddress] = useState(initialAddress || "");
  const inputRef = useRef<HTMLInputElement>(null);

  const hasValidCoords =
    latitude &&
    longitude &&
    !isNaN(parseFloat(latitude)) &&
    !isNaN(parseFloat(longitude)) &&
    parseFloat(latitude) >= -90 &&
    parseFloat(latitude) <= 90 &&
    parseFloat(longitude) >= -180 &&
    parseFloat(longitude) <= 180;

  useEffect(() => {
    if (initialAddress) setCapturedAddress(initialAddress);
  }, [initialAddress]);

  const handleResolveInput = useCallback(async () => {
    const input = locationInput.trim();
    if (!input) return;
    setError("");
    setIsResolving(true);

    try {
      const result = await resolveLocation(input);
      onChange(result.latitude.toFixed(6), result.longitude.toFixed(6), result.address || undefined);
      if (result.address) setCapturedAddress(result.address);
      setLocationInput("");
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || "Unable to determine this location.";
      setError(msg);
    } finally {
      setIsResolving(false);
    }
  }, [locationInput, onChange]);

  const handleGetGps = useCallback(() => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser.");
      return;
    }
    setIsGettingGps(true);
    setError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        onChange(lat.toFixed(6), lng.toFixed(6));
        setCapturedAddress("");
        setIsGettingGps(false);
      },
      (err) => {
        setIsGettingGps(false);
        if (err.code === err.PERMISSION_DENIED) {
          setError("Location permission was denied. Please paste a valid Google Maps location or address.");
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setError("Location information is unavailable.");
        } else {
          setError("Location request timed out.");
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, [onChange]);

  const handleClearLocation = useCallback(() => {
    onChange("", "", "");
    setCapturedAddress("");
    setLocationInput("");
    setError("");
  }, [onChange]);

  const isLoading = isResolving || isGettingGps;

  return (
    <div className="space-y-2">
      {/* Location input + Get GPS */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            <MapPin size={15} />
          </div>
          <input
            ref={inputRef}
            type="text"
            value={locationInput}
            onChange={(e) => { setLocationInput(e.target.value); setError(""); }}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleResolveInput(); } }}
            placeholder="Paste address or Google Maps location..."
            className="w-full pl-10 pr-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-150 bg-white hover:shadow-sm focus:shadow-md"
            disabled={disabled || isLoading}
          />
        </div>
        <button
          type="button"
          onClick={handleGetGps}
          disabled={disabled || isLoading}
          className="inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-medium text-slate-600 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50 shrink-0"
        >
          {isGettingGps ? <Loader2 size={13} className="animate-spin" /> : <Navigation size={13} />}
          {isGettingGps ? "Getting..." : "Get GPS"}
        </button>
      </div>

      {/* Resolve button when input present */}
      {locationInput.trim() && !isLoading && (
        <button
          type="button"
          onClick={handleResolveInput}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
        >
          <MapPin size={12} />
          Capture Location
        </button>
      )}

      {/* Loading state */}
      {isResolving && (
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Loader2 size={13} className="animate-spin" />
          Resolving location...
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="text-red-600 text-xs">{error}</p>
      )}

      {/* Captured location card */}
      {hasValidCoords && !error && (
        <div className="px-3 py-2.5 bg-emerald-50/70 border border-emerald-200/60 rounded-lg">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 size={13} className="text-emerald-600" />
              <span className="text-xs font-medium text-emerald-800">Location captured</span>
            </div>
            <button
              type="button"
              onClick={handleClearLocation}
              className="text-[11px] font-medium text-slate-500 hover:text-slate-700"
            >
              Change
            </button>
          </div>
          {capturedAddress && (
            <p className="text-xs text-emerald-700 leading-relaxed pl-5">{capturedAddress}</p>
          )}
          <div className="flex items-center gap-2 pl-5 mt-0.5 text-[11px] text-emerald-600/80">
            <span>Lat {parseFloat(latitude).toFixed(6)}</span>
            <span className="text-emerald-400">·</span>
            <span>Lng {parseFloat(longitude).toFixed(6)}</span>
          </div>
        </div>
      )}

      {/* Not captured */}
      {!hasValidCoords && !error && !isResolving && (
        <p className="text-[11px] text-slate-400 italic pl-0.5">Location not captured</p>
      )}
    </div>
  );
}

export default LocationPicker;
