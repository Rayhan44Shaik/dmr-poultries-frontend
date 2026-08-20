// src/modules/order/components/MapPlaceholder.tsx
// Clean map container, ready for a real map provider later. Shows a simple
// schematic of pickup -> stops. Never renders fake live vehicle movement.

import { Map as MapIcon } from "lucide-react";
import type { DeliveryRoute } from "../types/routeTypes";

interface MapPlaceholderProps {
  route?: DeliveryRoute | null;
}

export default function MapPlaceholder({ route }: MapPlaceholderProps) {
  return (
    <div className="relative flex h-full min-h-[320px] w-full flex-col items-center justify-center overflow-hidden rounded-xl border border-dashed border-slate-300 bg-slate-50/70 p-6">
      <div className="absolute inset-0 opacity-[0.04] [background-image:linear-gradient(#0f172a_1px,transparent_1px),linear-gradient(90deg,#0f172a_1px,transparent_1px)] [background-size:24px_24px]" />
      <div className="relative z-10 flex flex-col items-center gap-3 text-center">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-slate-400 shadow-card">
          <MapIcon size={22} />
        </span>
        <p className="text-sm font-semibold text-slate-700">Route Map</p>
        <p className="text-xs text-slate-400">Map integration ready — connect a map provider later.</p>
      </div>

      {route && route.stops.length > 0 && (
        <div className="relative z-10 mt-4 w-full max-w-xs rounded-xl border border-slate-200 bg-white p-4 shadow-card">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
            <span className="h-2.5 w-2.5 rounded-full bg-brand-600" />
            {route.pickup.farmName}
          </div>
          <div className="ml-1 border-l-2 border-dashed border-slate-200 pl-4">
            {route.stops.map((stop) => (
              <div key={stop.orderId} className="flex items-center gap-2 py-1.5 text-xs text-slate-600">
                <span className="h-2 w-2 rounded-full bg-slate-400" />
                {stop.shopName}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
