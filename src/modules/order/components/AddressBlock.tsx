// src/modules/order/components/AddressBlock.tsx
// Renders a structured address + GPS status compactly (no internal ids).

import type { Address, GpsCoordinate, GpsQuality } from "../types/orderTypes";
import GPSStatus from "./GPSStatus";

interface AddressBlockProps {
  title: string;
  address: Address | null | undefined;
  gps?: GpsCoordinate | null;
  gpsStatus?: GpsQuality;
}

export default function AddressBlock({ title, address, gps, gpsStatus }: AddressBlockProps) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3.5">
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{title}</p>
      {address ? (
        <div className="mt-1.5 space-y-0.5 text-xs text-slate-700">
          {address.line1 && <p>{address.line1}</p>}
          {address.line2 && <p>{address.line2}</p>}
          {address.area && <p>{address.area}</p>}
          <p className="font-medium">
            {[address.city, address.district].filter(Boolean).join(", ")}
          </p>
          <p>
            {[address.state, address.pinCode].filter(Boolean).join(" ")}
          </p>
        </div>
      ) : (
        <p className="mt-1.5 text-xs text-slate-400">Address not available</p>
      )}
      {gpsStatus && (
        <div className="mt-2">
          <GPSStatus gps={gps ?? null} status={gpsStatus} />
        </div>
      )}
    </div>
  );
}
