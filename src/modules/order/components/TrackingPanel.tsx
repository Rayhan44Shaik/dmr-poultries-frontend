// src/modules/order/components/TrackingPanel.tsx
// Live tracking readout. Shows "GPS Tracking Not Connected" when no backend
// feed is available — never simulates live positions as real data.

import { Activity, Gauge, MapPin, Navigation, Satellite, Timer } from "lucide-react";
import type { VehicleTrackingSnapshot } from "../types/trackingTypes";

interface TrackingPanelProps {
  snapshot: VehicleTrackingSnapshot | null;
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2">
      <span className="text-slate-400">{icon}</span>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
        <p className="truncate text-sm font-semibold text-slate-700">{value}</p>
      </div>
    </div>
  );
}

export default function TrackingPanel({ snapshot }: TrackingPanelProps) {
  if (!snapshot || !snapshot.connected) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50/60 px-6 py-10 text-center">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-slate-400 shadow-card">
          <Satellite size={22} />
        </span>
        <p className="text-sm font-semibold text-slate-700">GPS Tracking Not Connected</p>
        <p className="max-w-xs text-xs text-slate-400">
          Live vehicle positions will appear here once a GPS backend is connected.
        </p>
      </div>
    );
  }

  const coord =
    snapshot.latitude != null && snapshot.longitude != null
      ? `${snapshot.latitude.toFixed(5)}, ${snapshot.longitude.toFixed(5)}`
      : "Updating…";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-bold text-slate-800">{snapshot.vehicleNo}</p>
          <p className="text-xs text-slate-400">Status: {snapshot.status}</p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
          Live
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Stat icon={<MapPin size={15} />} label="Lat / Lng" value={coord} />
        <Stat icon={<Gauge size={15} />} label="Speed" value={snapshot.speedKmh != null ? `${snapshot.speedKmh} km/h` : "—"} />
        <Stat icon={<Activity size={15} />} label="GPS Accuracy" value={snapshot.accuracyMeters != null ? `${snapshot.accuracyMeters} m` : "—"} />
        <Stat icon={<Navigation size={15} />} label="Heading" value={snapshot.heading != null ? `${snapshot.heading}°` : "—"} />
        <Stat icon={<Timer size={15} />} label="Last Updated" value={snapshot.lastUpdated ?? "—"} />
        <Stat icon={<MapPin size={15} />} label="Current Stop" value={snapshot.currentStop ?? "—"} />
        <Stat icon={<MapPin size={15} />} label="Next Stop" value={snapshot.nextStop ?? "—"} />
        <Stat icon={<Timer size={15} />} label="ETA" value={snapshot.etaMinutes != null ? `~${snapshot.etaMinutes}m` : "—"} />
      </div>
    </div>
  );
}
