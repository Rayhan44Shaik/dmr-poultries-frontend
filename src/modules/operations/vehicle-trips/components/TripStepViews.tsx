// src/modules/operations/vehicle-trips/components/TripStepViews.tsx
//
// Read-only Trip step views shared by every trip-history surface:
//   • the Trip List / Recent Trips TripViewModal (all 5 steps), and
//   • the Accounts → Farm Payment trip view (Step 2 + Step 3 only).
// Extracted so both surfaces render byte-identical step detail.
//
// All step views share the SAME "Farm Details" layout: a plain title
// (no "View" prefix, no numbered badge), optional full-width address block
// on top, then colour-coded KPI cards below. No raw latitude/longitude/
// accuracy rows and no DC-photo gallery on Step 2 (DC photos belong to
// Step 3, where they are captured).

import { Box, Bird, Clock, MapPin, Gauge, Store, Ticket, Scale, Layers, Package } from "lucide-react";
import type { Trip } from "../types/trip";
import { StepKpiCard } from "./WizardControls";
import { GpsAddressText } from "./GpsAddressText";
import { formatIstStamp } from "../services/tripHeaderApiService";
import { useI18n } from "../../../../i18n";

function hasFarmGps(trip: Trip): boolean {
  return (
    trip.farmGpsLat != null &&
    trip.farmGpsLon != null &&
    Number.isFinite(Number(trip.farmGpsLat)) &&
    Number.isFinite(Number(trip.farmGpsLon)) &&
    !(Number(trip.farmGpsLat) === 0 && Number(trip.farmGpsLon) === 0)
  );
}

/** Full-width GPS address block — the complete reverse-geocoded address on its
 *  own full line (no truncation), exactly like the submitted Step 2 view. */
function GpsAddressBlock({ trip }: { trip: Trip }) {
  const { t } = useI18n();
  const captured = hasFarmGps(trip);
  return (
    <div className="bg-white border border-slate-200/80 rounded-xl p-3.5 shadow-2xs">
      <span className="text-[13px] uppercase font-semibold text-slate-400 flex items-center gap-1.5 mb-1.5">
        <span className="h-5 w-5 rounded-md bg-cyan-50/70 text-cyan-500 flex items-center justify-center shrink-0">
          <MapPin size={12} />
        </span>
        {t("ops.trip.field.gps_address")}
      </span>
      {captured ? (
        <p className="text-[15px] font-semibold text-slate-800 break-words leading-relaxed">
          <GpsAddressText lat={trip.farmGpsLat} lon={trip.farmGpsLon} fallback={t("ops.trip.location_captured")} />
        </p>
      ) : (
        <p className="text-[15px] font-semibold text-slate-400">{t("ops.trip.not_captured")}</p>
      )}
    </div>
  );
}

/** Read-only Step 2 (Farm / Destination) details — full GPS address + KPI cards. */
export function FarmStepView({ trip }: { trip: Trip }) {
  const { t } = useI18n();
  const notEntered = t("ops.trip.not_entered");
  const destMeterLabel =
    trip.destMeter == null || Number(trip.destMeter) === 0
      ? notEntered
      : `${trip.destMeter} KM`;
  const avgWeightLabel =
    trip.avgBirdWeight == null || Number(trip.avgBirdWeight) === 0
      ? notEntered
      : `${Number(trip.avgBirdWeight).toFixed(2)} kg`;
  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3 shadow-sm">
      <h3 className="text-[17px] sm:text-lg font-bold text-slate-800 flex items-center gap-2 tracking-tight">
        <MapPin size={18} className="text-indigo-500" />
        {t("ops.trip.title.farm")}
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <StepKpiCard
          icon={Clock}
          tone="bg-sky-50/70 text-sky-500"
          label={t("ops.trip.field.reached_time")}
          value={trip.farmStepSubmittedAt ? formatIstStamp(trip.farmStepSubmittedAt) : trip.reachedTime || notEntered}
        />
        <StepKpiCard
          icon={Store}
          tone="bg-emerald-50/70 text-emerald-500"
          label={t("common.farm")}
          value={trip.sourceFarm || notEntered}
        />
        <StepKpiCard
          icon={Layers}
          tone="bg-violet-50/70 text-violet-500"
          label={t("operations.bird_type")}
          value={trip.birdType || notEntered}
        />
        <StepKpiCard
          icon={MapPin}
          tone="bg-rose-50/70 text-rose-500"
          label={t("ops.trip.field.farm_address")}
          value={trip.farmAddress?.trim() ? trip.farmAddress : notEntered}
        />
        <StepKpiCard
          icon={Gauge}
          tone="bg-purple-50/70 text-purple-500"
          label={t("ops.trip.field.farm_meter")}
          value={destMeterLabel}
        />
        <StepKpiCard
          icon={Ticket}
          tone="bg-amber-50/70 text-amber-500"
          label={t("ops.trip.field.pickup_tolls")}
          value={trip.pickupTolls == null ? notEntered : String(trip.pickupTolls)}
        />
        <StepKpiCard
          icon={Scale}
          tone="bg-teal-50/70 text-teal-500"
          label={t("ops.trip.field.avg_bird_weight")}
          value={avgWeightLabel}
        />
      </div>

      <GpsAddressBlock trip={trip} />
    </section>
  );
}

/** Read-only Step 3 (Pickup) details — same KPI-card format + per-box table. */
export function PickupStepView({ trip }: { trip: Trip }) {
  const { t } = useI18n();
  const notEntered = t("ops.trip.not_entered");
  const pickupBoxes = Array.isArray(trip.boxDetails) ? trip.boxDetails : [];
  const time =
    trip.pickupStepSubmittedAt
      ? formatIstStamp(trip.pickupStepSubmittedAt)
      : trip.pickupLoadTime || notEntered;

  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4 shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3 gap-3">
        <h3 className="text-[17px] sm:text-lg font-bold text-slate-800 flex items-center gap-2 tracking-tight">
          <Package size={18} className="text-amber-500" />
          {t("ops.trip.title.pickup")}
        </h3>
        <span className="bg-slate-100 border border-slate-200 text-slate-700 px-3 py-1.5 rounded-full text-[13px] font-semibold whitespace-nowrap">
          {t("ops.trip.submitted_locked")}
        </span>
      </div>

      {/* Time first — same StepKpiCard font as all other steps */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 pt-2">
        <StepKpiCard icon={Clock} tone="bg-blue-50/70 text-blue-500" label={t("ops.trip.time")} value={time} />
        <StepKpiCard
          icon={Scale}
          tone="bg-emerald-50/70 text-emerald-500"
          label={t("ops.trip.dc_wt")}
          value={trip.dcWeight != null ? `${Number(trip.dcWeight).toFixed(2)} Kg` : notEntered}
        />
        <StepKpiCard
          icon={Bird}
          tone="bg-sky-50/70 text-sky-500"
          label={t("common.birds")}
          value={trip.totalBirds != null ? String(trip.totalBirds) : notEntered}
        />
        <StepKpiCard
          icon={Box}
          tone="bg-amber-50/70 text-amber-500"
          label={t("common.boxes")}
          value={trip.boxes != null ? String(trip.boxes) : notEntered}
        />
        <StepKpiCard
          icon={Gauge}
          tone="bg-purple-50/70 text-purple-500"
          label={t("ops.trip.avg_wt")}
          value={trip.avgWeight != null ? `${trip.avgWeight} Kg` : "—"}
        />
      </div>

      {pickupBoxes.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto max-h-96 overflow-y-auto">
          <table className="w-full table-fixed border-collapse text-[13px]">
            <thead>
              <tr className="bg-slate-50 text-slate-600 text-[11px] uppercase sticky top-0 z-10 border-b border-slate-200">
                <th className="text-center px-2 py-2 font-bold border-r border-slate-200">{t("ops.trip.box")}</th>
                <th className="text-center px-2 py-2 font-bold border-r border-slate-200">{t("common.birds")}</th>
                <th className="text-center px-2 py-2 font-bold border-r border-slate-200">{t("ops.trip.wt_kg")}</th>
                <th className="text-center px-2 py-2 font-bold">{t("ops.trip.avg_wt_kg")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {pickupBoxes.map((b) => {
                const birds = Number(b.birds || 0);
                const weight = Number(b.weight || 0);
                const avg =
                  b.avgWeight != null && Number.isFinite(Number(b.avgWeight))
                    ? Number(b.avgWeight)
                    : birds > 0 && weight > 0
                      ? Number((weight / birds).toFixed(3))
                      : null;
                return (
                  <tr key={b.boxNo} className="bg-white hover:bg-slate-50">
                    <td className="text-center px-2 py-2 font-semibold text-slate-800 border-r border-slate-200">{b.boxNo}</td>
                    <td className="text-center px-2 py-2 font-bold text-slate-800 border-r border-slate-200">{birds || notEntered}</td>
                    <td className="text-center px-2 py-2 font-semibold text-slate-800 border-r border-slate-200">
                      {weight ? weight.toFixed(2) : notEntered}
                    </td>
                    <td className="text-center px-2 py-2 font-semibold text-slate-800">
                      {avg == null ? "—" : String(avg)}
                    </td>
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
