// src/modules/order/components/GPSStatus.tsx
// Displays a coordinate + a readable GPS quality label. Never assumes GPS is
// present; renders a clean placeholder when it is not.

import { AlertTriangle, MapPin, Navigation } from "lucide-react";
import type { GpsCoordinate, GpsQuality } from "../types/orderTypes";

const LABELS: Record<GpsQuality, { text: string; className: string; dot: string }> = {
  Fresh: { text: "Fresh", className: "text-emerald-600 bg-emerald-50 border-emerald-200", dot: "bg-emerald-500" },
  Stale: { text: "Stale", className: "text-orange-600 bg-orange-50 border-orange-200", dot: "bg-orange-500" },
  Unavailable: { text: "Unavailable", className: "text-slate-500 bg-slate-100 border-slate-200", dot: "bg-slate-400" },
  Invalid: { text: "Invalid", className: "text-rose-600 bg-rose-50 border-rose-200", dot: "bg-rose-500" },
  "Poor Accuracy": { text: "Poor Accuracy", className: "text-amber-600 bg-amber-50 border-amber-200", dot: "bg-amber-500" },
};

function formatCoordinate(gps: GpsCoordinate | null): string {
  if (!gps || gps.latitude == null || gps.longitude == null) return "—";
  return `${gps.latitude.toFixed(4)}, ${gps.longitude.toFixed(4)}`;
}

interface GPSStatusProps {
  gps: GpsCoordinate | null;
  status: GpsQuality;
  /** Show the coordinate string. */
  showCoordinates?: boolean;
  /** Show accuracy + timestamp details. */
  showDetails?: boolean;
  label?: string;
}

export default function GPSStatus({ gps, status, showCoordinates = true, showDetails = false, label }: GPSStatusProps) {
  const tone = LABELS[status] ?? LABELS.Unavailable;
  const warning = status === "Unavailable" || status === "Invalid";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${tone.className}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} aria-hidden="true" />
        {warning ? <AlertTriangle size={12} /> : <MapPin size={12} />}
        {label ? `${label}: ` : ""}
        {tone.text}
      </span>
      {showCoordinates && (
        <span className="font-mono text-xs text-slate-500">{formatCoordinate(gps)}</span>
      )}
      {showDetails && gps && (
        <span className="flex items-center gap-2 text-[11px] text-slate-400">
          {gps.accuracyMeters != null && (
            <span className="inline-flex items-center gap-1">
              <Navigation size={11} />
              ±{gps.accuracyMeters} m
            </span>
          )}
          {gps.timestamp && <span>{new Date(gps.timestamp).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span>}
        </span>
      )}
    </div>
  );
}
