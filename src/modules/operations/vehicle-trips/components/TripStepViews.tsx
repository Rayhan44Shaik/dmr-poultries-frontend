// src/modules/operations/vehicle-trips/components/TripStepViews.tsx
//
// Read-only Trip step views shared by every trip-history surface:
//   • the Trip List / Recent Trips TripViewModal (all 5 steps), and
//   • the Accounts → Farm Payment trip view (Step 2 + Step 3 only).
// Extracted so both surfaces render byte-identical step detail.

import { useState } from "react";
import { Image as ImageIcon, MapPin, Package, X } from "lucide-react";
import type { Trip } from "../types/trip";
import { useI18n } from "../../../../i18n";

/** Read-only Step 2 (Farm / Destination) details — with DC photos gallery. */
export function FarmStepView({ trip }: { trip: Trip }) {
  const { t } = useI18n();
  const [zoomPhoto, setZoomPhoto] = useState<string | null>(null);
  const gpsCaptured =
    trip.farmGpsLat != null &&
    trip.farmGpsLon != null &&
    Number.isFinite(Number(trip.farmGpsLat)) &&
    Number.isFinite(Number(trip.farmGpsLon)) &&
    !(Number(trip.farmGpsLat) === 0 && Number(trip.farmGpsLon) === 0);
  const notEntered = t("ops.trip.not_entered");
  const rows: Array<[string, string]> = [
    [t("operations.trip_no"), trip.tripNo || notEntered],
    [t("ops.trip.view_step2_status"), trip.farmStepSubmitted ? t("ops.trip.submitted") : t("ops.trip.not_submitted")],
    [t("ops.trip.farm_name"), trip.sourceFarm || notEntered],
    [t("ops.trip.field.farm_address"), trip.farmAddress?.trim() ? trip.farmAddress : notEntered],
    [t("ops.trip.field.farm_meter"), trip.destMeter ? `${trip.destMeter} KM` : notEntered],
    [t("ops.trip.field.reached_time"), trip.reachedTime || notEntered],
    [t("ops.trip.field.pickup_tolls"), trip.pickupTolls == null ? notEntered : String(trip.pickupTolls)],
    [t("ops.trip.field.avg_bird_weight"), trip.avgBirdWeight ? `${trip.avgBirdWeight} kg` : notEntered],
    [t("ops.trip.gps_latitude"), gpsCaptured ? String(trip.farmGpsLat) : notEntered],
    [t("ops.trip.gps_longitude"), gpsCaptured ? String(trip.farmGpsLon) : notEntered],
    [t("ops.trip.gps_accuracy"), gpsCaptured && trip.farmGpsAccuracy != null ? String(trip.farmGpsAccuracy) : notEntered],
    [t("ops.trip.gps_captured_time"), gpsCaptured && trip.farmGpsTime ? String(trip.farmGpsTime) : notEntered],
    [t("common.remarks"), trip.remarks?.trim() ? trip.remarks : notEntered],
  ];
  // DC (weighbridge / loading) photos captured at the farm — the visual proof
  // behind the DC weight the farm payment is priced on.
  const dcPhotos = [trip.dcPhotoData, trip.dcPhotoData2].filter(
    (d): d is string => Boolean(d) && d!.startsWith("data:image/")
  );
  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3 shadow-sm">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
          <MapPin size={15} className="text-indigo-600" />
          {t("ops.trip.view_step2")}
        </h3>
        <span
          className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold border ${
            gpsCaptured
              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
              : "bg-slate-100 text-slate-500 border-slate-200"
          }`}
        >
          {gpsCaptured ? t("ops.trip.gps_captured") : `GPS: ${t("ops.trip.not_captured")}`}
        </span>
      </div>
      <dl className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2.5">
        {rows.map(([label, value]) => (
          <div key={label} className="min-w-0 rounded-xl border border-slate-100 bg-slate-50/40 px-3 py-2.5">
            <dt className="truncate text-[10px] uppercase font-semibold text-slate-400">{label}</dt>
            <dd className="mt-0.5 truncate text-xs font-semibold text-slate-800" title={value}>
              {value}
            </dd>
          </div>
        ))}
      </dl>
      {dcPhotos.length > 0 && (
        <div className="rounded-xl border border-slate-200/70 bg-slate-50/40 p-3">
          <p className="text-[10px] uppercase font-semibold text-slate-400 mb-2 flex items-center gap-1.5">
            <ImageIcon size={12} />
            DC Photos ({dcPhotos.length})
          </p>
          <div className="flex flex-wrap gap-3">
            {dcPhotos.map((photo, index) => (
              <button
                key={index}
                type="button"
                onClick={() => setZoomPhoto(photo)}
                className="group relative h-24 w-32 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition hover:shadow-md hover:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                title="Click to enlarge"
              >
                <img
                  src={photo}
                  alt={`DC photo ${index + 1}`}
                  className="h-full w-full object-cover transition group-hover:scale-105"
                />
              </button>
            ))}
          </div>
        </div>
      )}
      {zoomPhoto && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-6 animate-fade-in"
          onClick={() => setZoomPhoto(null)}
          role="dialog"
          aria-modal="true"
        >
          <div className="relative max-h-[85vh] max-w-3xl" onClick={(e) => e.stopPropagation()}>
            <img
              src={zoomPhoto}
              alt="DC photo enlarged"
              className="max-h-[85vh] w-auto rounded-2xl border border-white/20 shadow-2xl"
            />
            <button
              type="button"
              onClick={() => setZoomPhoto(null)}
              className="absolute -top-3 -right-3 h-8 w-8 rounded-full bg-white text-slate-700 shadow-lg hover:bg-slate-100 flex items-center justify-center"
              aria-label={t("common.close")}
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

/** Read-only Step 3 (Pickup) details — summary + per-box table. */
export function PickupStepView({ trip }: { trip: Trip }) {
  const { t } = useI18n();
  const pickupBoxes = Array.isArray(trip.boxDetails) ? trip.boxDetails : [];
  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3 shadow-sm">
      <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
        <Package size={15} className="text-amber-600" />
        {t("ops.trip.view_step3")}
      </h3>
      <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="border border-slate-100 rounded-xl p-3 bg-slate-50/40">
          <dt className="text-[10px] uppercase font-semibold text-slate-400">{t("ops.trip.dc_weight")}</dt>
          <dd className="text-xs font-semibold text-slate-800 mt-0.5 break-words">
            {trip.dcWeight != null ? `${trip.dcWeight} KG` : t("ops.trip.not_entered")}
          </dd>
        </div>
        <div className="border border-slate-100 rounded-xl p-3 bg-slate-50/40">
          <dt className="text-[10px] uppercase font-semibold text-slate-400">{t("ops.trip.total_birds")}</dt>
          <dd className="text-xs font-semibold text-slate-800 mt-0.5 break-words">
            {trip.totalBirds != null ? String(trip.totalBirds) : t("ops.trip.not_entered")}
          </dd>
        </div>
        <div className="border border-slate-100 rounded-xl p-3 bg-slate-50/40">
          <dt className="text-[10px] uppercase font-semibold text-slate-400">{t("common.boxes")}</dt>
          <dd className="text-xs font-semibold text-slate-800 mt-0.5 break-words">
            {trip.boxes != null ? String(trip.boxes) : t("ops.trip.not_entered")}
          </dd>
        </div>
        <div className="border border-slate-100 rounded-xl p-3 bg-slate-50/40">
          <dt className="text-[10px] uppercase font-semibold text-slate-400">{t("ops.trip.avg_weight")}</dt>
          <dd className="text-xs font-semibold text-slate-800 mt-0.5 break-words">
            {trip.avgWeight != null ? `${trip.avgWeight} kg` : t("ops.trip.not_entered")}
          </dd>
        </div>
        <div className="border border-slate-100 rounded-xl p-3 bg-slate-50/40">
          <dt className="text-[10px] uppercase font-semibold text-slate-400">{t("ops.trip.pickup_load_time")}</dt>
          <dd className="text-xs font-semibold text-slate-800 mt-0.5 break-words">{trip.pickupLoadTime || t("ops.trip.not_entered")}</dd>
        </div>
        <div className="border border-slate-100 rounded-xl p-3 bg-slate-50/40">
          <dt className="text-[10px] uppercase font-semibold text-slate-400">{t("common.status")}</dt>
          <dd className="text-xs font-semibold text-slate-800 mt-0.5 break-words">
            {trip.pickupStepSubmitted ? t("ops.trip.submitted") : t("ops.trip.not_submitted")}
          </dd>
        </div>
      </dl>
      {pickupBoxes.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-slate-200/70">
          <table className="w-full text-xs">
            <thead className="bg-slate-50/80">
              <tr>
                {[t("table.s_no"), t("ops.trip.box"), t("common.birds"), t("ops.trip.weight_kg"), t("ops.trip.avg_wt")].map((h) => (
                  <th key={h} className="px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pickupBoxes.map((b, index) => {
                const birds = Number(b.birds || 0);
                const weight = Number(b.weight || 0);
                const avg =
                  b.avgWeight != null && Number.isFinite(Number(b.avgWeight))
                    ? Number(b.avgWeight)
                    : birds > 0 && weight > 0
                      ? Number((weight / birds).toFixed(3))
                      : null;
                return (
                  <tr key={b.boxNo} className="hover:bg-slate-50/60">
                    <td className="px-3 py-2 text-slate-500">{index + 1}</td>
                    <td className="px-3 py-2 font-semibold text-slate-800">#{b.boxNo}</td>
                    <td className="px-3 py-2 text-slate-700">{birds}</td>
                    <td className="px-3 py-2 text-slate-700 tabular-nums">{weight.toFixed(2)}</td>
                    <td className="px-3 py-2 text-slate-700 tabular-nums">{avg == null ? "--" : avg.toFixed(3)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
