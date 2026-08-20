// src/modules/order/components/GPSStatus.tsx
// Displays a coordinate + a readable GPS availability label. Never assumes GPS
// is present; renders a clean placeholder when it is not.

import { MapPin, AlertTriangle } from "lucide-react";
import type { GpsAvailability, GpsCoordinate } from "../types/orderTypes";

const LABELS: Record<GpsAvailability, { text: string; className: string }> = {
  Available: { text: "Available", className: "text-emerald-600 bg-emerald-50 border-emerald-200" },
  "Not Available": { text: "Not Available", className: "text-slate-500 bg-slate-100 border-slate-200" },
  Pending: { text: "Pending", className: "text-amber-600 bg-amber-50 border-amber-200" },
  Stale: { text: "Stale", className: "text-orange-600 bg-orange-50 border-orange-200" },
  Invalid: { text: "Invalid", className: "text-rose-600 bg-rose-50 border-rose-200" },
  "Poor Accuracy": { text: "Poor Accuracy", className: "text-amber-600 bg-amber-50 border-amber-200" },
};

function formatCoordinate(gps: GpsCoordinate | null): string {
  if (!gps || gps.latitude == null || gps.longitude == null) return "—";
  return `${gps.latitude.toFixed(4)}, ${gps.longitude.toFixed(4)}`;
}

interface GPSStatusProps {
  gps: GpsCoordinate | null;
  status: GpsAvailability;
  /** Show the coordinate string. */
  showCoordinates?: boolean;
  label?: string;
}

export default function GPSStatus({ gps, status, showCoordinates = true, label }: GPSStatusProps) {
  const tone = LABELS[status] ?? LABELS["Not Available"];
  const unavailable = status === "Not Available" || status === "Invalid";

  return (
    <div className="flex items-center gap-2">
      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${tone.className}`}>
        {unavailable ? <AlertTriangle size={12} /> : <MapPin size={12} />}
        {label ? `${label}: ` : ""}
        {tone.text}
      </span>
      {showCoordinates && (
        <span className="font-mono text-xs text-slate-500">{formatCoordinate(gps)}</span>
      )}
    </div>
  );
}
