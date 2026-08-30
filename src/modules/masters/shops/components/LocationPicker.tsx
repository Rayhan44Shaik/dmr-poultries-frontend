import { useState, useRef, useEffect } from "react";
import {
  MapPin,
  Navigation,
  ClipboardList,
  Globe,
  CheckCircle2,
  XCircle,
  Loader2,
  Map,
} from "lucide-react";
import { useI18n } from "../../../../i18n";

// Google Maps type declarations
declare global {
  namespace google {
    namespace maps {
      class Map {
        constructor(mapDiv: HTMLElement, opts?: MapOptions);
        setCenter(latLng: LatLng | LatLngLiteral): void;
        setZoom(zoom: number): void;
      }
      class Marker {
        constructor(opts?: MarkerOptions);
        setPosition(latLng: LatLng | LatLngLiteral): void;
        getPosition(): LatLng;
        addListener(eventName: string, handler: Function): void;
      }
      class LatLng {
        constructor(lat: number, lng: number);
        lat(): number;
        lng(): number;
      }
      interface LatLngLiteral {
        lat: number;
        lng: number;
      }
      interface MapOptions {
        center?: LatLng | LatLngLiteral;
        zoom?: number;
        mapTypeControl?: boolean;
        streetViewControl?: boolean;
        fullscreenControl?: boolean;
        zoomControl?: boolean;
      }
      interface MarkerOptions {
        position?: LatLng | LatLngLiteral;
        map?: Map;
        draggable?: boolean;
        title?: string;
      }
      namespace places {
        class Autocomplete {
          constructor(inputField: HTMLInputElement, opts?: AutocompleteOptions);
          getPlace(): PlaceResult;
          addListener(eventName: string, handler: Function): void;
        }
        interface AutocompleteOptions {
          fields?: string[];
          types?: string[];
        }
        interface PlaceResult {
          geometry?: {
            location?: LatLng;
          };
          name?: string;
        }
      }
    }
  }
}

type LocationPickerProps = {
  latitude: string;
  longitude: string;
  onChange: (lat: string, lng: string) => void;
  onLocationCaptured?: () => void;
  disabled?: boolean;
  onOpenMapPicker?: () => void;
  onOpenPasteDialog?: () => void;
  onUseCurrentLocation?: () => void;
};

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

function parseGoogleMapsInput(input: string): { lat: number; lng: number } | null {
  const trimmed = input.trim();
  
  if (!trimmed) return null;
  
  const coordMatch = trimmed.match(/^(-?\d+\.?\d*)\s*[,;]\s*(-?\d+\.?\d*)$/);
  if (coordMatch) {
    const lat = parseFloat(coordMatch[1]);
    const lng = parseFloat(coordMatch[2]);
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { lat, lng };
    }
  }
  
  const urlPatterns = [
    /@(-?\d+\.?\d*),(-?\d+\.?\d*)/,
    /\?q=(-?\d+\.?\d*)%2C(-?\d+\.?\d*)/,
    /\?q=(-?\d+\.?\d*),(-?\d+\.?\d*)/,
    /\/place\/[^/]+\/(-?\d+\.?\d*),(-?\d+\.?\d*)/,
    /\/@(-?\d+\.?\d*),(-?\d+\.?\d*)/,
  ];
  
  for (const pattern of urlPatterns) {
    const match = trimmed.match(pattern);
    if (match) {
      const lat = parseFloat(match[1]);
      const lng = parseFloat(match[2]);
      if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        return { lat, lng };
      }
    }
  }
  
  return null;
}

function LocationPicker({
  latitude,
  longitude,
  onChange,
  onLocationCaptured,
  disabled = false,
  onOpenMapPicker,
  onOpenPasteDialog,
  onUseCurrentLocation,
}: LocationPickerProps) {
  const { t } = useI18n();
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [showPasteDialog, setShowPasteDialog] = useState(false);
  const [pasteInput, setPasteInput] = useState("");
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number }>({ lat: 16.5441, lng: 81.5235 });
  const [mapMarker, setMapMarker] = useState<{ lat: number; lng: number } | null>(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  const hasValidCoords = latitude && longitude && 
    parseFloat(latitude) >= -90 && parseFloat(latitude) <= 90 &&
    parseFloat(longitude) >= -180 && parseFloat(longitude) <= 180;

  useEffect(() => {
    if (latitude && longitude) {
      const lat = parseFloat(latitude);
      const lng = parseFloat(longitude);
      if (!isNaN(lat) && !isNaN(lng)) {
        setMapCenter({ lat, lng });
        setMapMarker({ lat, lng });
      }
    }
  }, [latitude, longitude]);

  useEffect(() => {
    if (showMapPicker && mapContainerRef.current && !mapLoaded && GOOGLE_MAPS_API_KEY) {
      loadGoogleMaps();
    }
  }, [showMapPicker, mapLoaded]);

  const loadGoogleMaps = async () => {
    if (typeof window !== "undefined" && (window as any).google?.maps) {
      initMap();
      return;
    }

    if (typeof window !== "undefined" && (window as any).googleMapsLoading) {
      await new Promise<void>((resolve) => {
        const checkLoaded = setInterval(() => {
          if ((window as any).google?.maps) {
            clearInterval(checkLoaded);
            resolve();
          }
        }, 100);
      });
      initMap();
      return;
    }

    if (typeof window !== "undefined") {
      (window as any).googleMapsLoading = true;
      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places`;
      script.async = true;
      script.defer = true;
      script.onload = () => {
        (window as any).googleMapsLoading = false;
        initMap();
      };
      script.onerror = () => {
        (window as any).googleMapsLoading = false;
      };
      document.head.appendChild(script);
    }
  };

  const initMap = () => {
    if (!mapContainerRef.current || mapRef.current) return;

    const center = mapMarker || mapCenter;
    
    mapRef.current = new (window as any).google.maps.Map(mapContainerRef.current, {
      center,
      zoom: 15,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true,
      zoomControl: true,
    });

    markerRef.current = new (window as any).google.maps.Marker({
      position: center,
      map: mapRef.current,
      draggable: true,
      title: t("masters.shops.location.marker_title"),
    });

    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = t("masters.shops.location.search_placeholder");
    input.className = "block w-full px-3 py-2 text-sm border border-slate-300 rounded-lg mb-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500";
    mapContainerRef.current.parentElement?.insertBefore(input, mapContainerRef.current);

    autocompleteRef.current = new (window as any).google.maps.places.Autocomplete(input, {
      fields: ["geometry", "name"],
      types: ["establishment", "geocode"],
    });

    autocompleteRef.current?.addListener("place_changed", () => {
      const place = autocompleteRef.current?.getPlace();
      if (place?.geometry?.location) {
        const lat = place.geometry.location.lat();
        const lng = place.geometry.location.lng();
        setMapCenter({ lat, lng });
        setMapMarker({ lat, lng });
        markerRef.current?.setPosition({ lat, lng });
        mapRef.current?.setCenter({ lat, lng });
        mapRef.current?.setZoom(17);
      }
    });

    markerRef.current?.addListener("dragend", () => {
      const pos = markerRef.current?.getPosition();
      if (pos) {
        const lat = pos.lat();
        const lng = pos.lng();
        setMapMarker({ lat, lng });
      }
    });

    (mapRef.current as any)?.addListener("click", (e: any) => {
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();
      setMapMarker({ lat, lng });
      markerRef.current?.setPosition({ lat, lng });
    });

    setMapLoaded(true);
  };

  const handleUseCurrentLocation = async () => {
    if (!navigator.geolocation) {
      alert(t("masters.shops.location.geolocation_not_supported"));
      return;
    }

    setIsGettingLocation(true);
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        onChange(lat.toFixed(6), lng.toFixed(6));
        setMapCenter({ lat, lng });
        setMapMarker({ lat, lng });
        if (markerRef.current) {
          markerRef.current.setPosition({ lat, lng });
          mapRef.current?.setCenter({ lat, lng });
          mapRef.current?.setZoom(17);
        }
        setIsGettingLocation(false);
        onLocationCaptured?.();
      },
      (error) => {
        setIsGettingLocation(false);
        let message = t("masters.shops.location.permission_denied");
        if (error.code === error.PERMISSION_DENIED) {
          message = t("masters.shops.location.permission_denied");
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          message = t("masters.shops.location.position_unavailable");
        } else if (error.code === error.TIMEOUT) {
          message = t("masters.shops.location.timeout");
        }
        alert(message);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handlePasteLocation = () => {
    const parsed = parseGoogleMapsInput(pasteInput);
    if (parsed) {
      onChange(parsed.lat.toFixed(6), parsed.lng.toFixed(6));
      setMapCenter(parsed);
      setMapMarker(parsed);
      if (markerRef.current) {
        markerRef.current.setPosition(parsed);
        mapRef.current?.setCenter(parsed);
        mapRef.current?.setZoom(17);
      }
      setPasteInput("");
      setShowPasteDialog(false);
      onLocationCaptured?.();
    } else {
      alert(t("masters.shops.location.invalid_format"));
    }
  };

  const handleMapConfirm = () => {
    if (mapMarker) {
      onChange(mapMarker.lat.toFixed(6), mapMarker.lng.toFixed(6));
      onLocationCaptured?.();
    }
    setShowMapPicker(false);
  };

  const handleManualChange = (field: "lat" | "lng", value: string) => {
    const num = parseFloat(value);
    if (field === "lat" && !isNaN(num) && num >= -90 && num <= 90) {
      onChange(value, longitude);
      setMapMarker(prev => prev ? { ...prev, lat: num } : { lat: num, lng: parseFloat(longitude) || 0 });
    } else if (field === "lng" && !isNaN(num) && num >= -180 && num <= 180) {
      onChange(latitude, value);
      setMapMarker(prev => prev ? { ...prev, lng: num } : { lat: parseFloat(latitude) || 0, lng: num });
    }
  };

  const inputClass = (hasError = false) =>
    `w-full pl-11 pr-4 py-2.5 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-150 ${
      hasError ? "border-red-500" : "border-slate-200"
    } bg-white hover:shadow-sm focus:shadow-md appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`;

  return (
    <div className="space-y-3">
      {/* Latitude/Longitude Inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="relative">
          <label className="block text-xs font-medium text-slate-600 mb-1.5">
            {t("masters.shops.form.latitude")}
          </label>
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              <MapPin size={16} />
            </div>
            <input
              type="text"
              value={latitude}
              onChange={(e) => handleManualChange("lat", e.target.value)}
              placeholder={t("masters.shops.form.latitude_placeholder")}
              className={inputClass()}
              disabled={disabled}
            />
          </div>
        </div>

        <div className="relative">
          <label className="block text-xs font-medium text-slate-600 mb-1.5">
            {t("masters.shops.form.longitude")}
          </label>
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              <MapPin size={16} />
            </div>
            <input
              type="text"
              value={longitude}
              onChange={(e) => handleManualChange("lng", e.target.value)}
              placeholder={t("masters.shops.form.longitude_placeholder")}
              className={inputClass()}
              disabled={disabled}
            />
          </div>
        </div>
      </div>

      {/* Location captured indicator */}
      {hasValidCoords && (
        <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg">
          <svg className="h-4 w-4 text-emerald-600 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
          <span className="text-xs font-medium text-emerald-800">{t("masters.shops.location.captured")}</span>
          <span className="text-[11px] text-emerald-600 ml-auto">
            {t("masters.shops.location.coordinates", { lat: parseFloat(latitude).toFixed(6), lng: parseFloat(longitude).toFixed(6) })}
          </span>
          <button
            type="button"
            onClick={() => window.open(`https://www.google.com/maps/@${latitude},${longitude},17z`, "_blank")}
            className="text-xs font-medium text-blue-600 hover:text-blue-700 underline"
          >
            {t("masters.shops.location.view_on_map")}
          </button>
        </div>
      )}

      {/* Map Picker Modal */}
      {showMapPicker && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
              <h2 className="text-lg font-bold text-slate-800">{t("masters.shops.location.select_on_map")}</h2>
              <button
                onClick={() => setShowMapPicker(false)}
                className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
              >
                <XCircle size={20} />
              </button>
            </div>
            <div className="flex-1 flex flex-col min-h-0 p-4">
              <div className="mb-3" ref={(el) => {
                if (el) mapContainerRef.current = el.querySelector("div") as HTMLDivElement;
              }}>
                <div className="h-[50vh] w-full rounded-lg overflow-hidden" style={{ minHeight: "300px" }} ref={mapContainerRef} />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3 shrink-0">
              <button
                onClick={() => setShowMapPicker(false)}
                className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              >
                {t("masters.shops.dialog.cancel")}
              </button>
              <button
                onClick={handleMapConfirm}
                disabled={!mapMarker}
                className="px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {t("masters.shops.location.confirm_location")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Paste Google Maps Location Modal */}
      {showPasteDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-800">{t("masters.shops.location.paste_google_maps")}</h2>
              <button
                onClick={() => setShowPasteDialog(false)}
                className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
              >
                <XCircle size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-600">{t("masters.shops.location.paste_instructions")}</p>
              <div className="space-y-2">
                <p className="text-xs text-slate-500 font-medium">{t("masters.shops.location.supported_formats")}</p>
                <ul className="text-xs text-slate-500 space-y-1 pl-4 list-disc">
                  <li>16.544123, 81.523456</li>
                  <li>https://www.google.com/maps/@16.544...,81.52...,17z</li>
                  <li>https://maps.google.com/?q=16.544,81.52</li>
                </ul>
              </div>
              <textarea
                value={pasteInput}
                onChange={(e) => setPasteInput(e.target.value)}
                placeholder={t("masters.shops.location.paste_placeholder")}
                rows={3}
                className="w-full px-4 py-2.5 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-150 border-slate-200 bg-white hover:shadow-sm focus:shadow-md resize-y"
              />
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowPasteDialog(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  {t("masters.shops.dialog.cancel")}
                </button>
                <button
                  onClick={handlePasteLocation}
                  className="px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {t("masters.shops.location.extract_coordinates")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default LocationPicker;