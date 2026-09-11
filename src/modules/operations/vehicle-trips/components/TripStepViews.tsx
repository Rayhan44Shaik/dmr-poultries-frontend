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

import { Box, Bird, Clock, MapPin, Gauge, Store, Ticket, Scale, Layers, Package, ShieldCheck } from "lucide-react";
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
      <span className="text-xs uppercase font-semibold text-slate-400 flex items-center gap-1.5 mb-1.5">
        <span className="h-5 w-5 rounded-md bg-cyan-50 text-cyan-600 flex items-center justify-center shrink-0">
          <MapPin size={12} />
        </span>
        {t("ops.trip.field.gps_address")}
      </span>
      {captured ? (
        <p className="text-sm font-semibold text-slate-800 break-words leading-relaxed">
          <GpsAddressText lat={trip.farmGpsLat} lon={trip.farmGpsLon} fallback={t("ops.trip.location_captured")} />
        </p>
      ) : (
        <p className="text-sm font-semibold text-slate-400">{t("ops.trip.not_captured")}</p>
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
      <h3 className="text-base sm:text-lg font-bold text-slate-800 flex items-center gap-2 tracking-tight">
        <MapPin size={18} className="text-indigo-600" />
        {t("ops.trip.title.farm")}
      </h3>

      <GpsAddressBlock trip={trip} />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <StepKpiCard
          icon={Clock}
          tone="bg-sky-50 text-sky-600"
          label={t("ops.trip.field.reached_time")}
          value={trip.farmStepSubmittedAt ? formatIstStamp(trip.farmStepSubmittedAt) : trip.reachedTime || notEntered}
        />
        <StepKpiCard
          icon={Store}
          tone="bg-emerald-50 text-emerald-600"
          label={t("common.farm")}
          value={trip.sourceFarm || notEntered}
        />
        <StepKpiCard
          icon={Layers}
          tone="bg-violet-50 text-violet-600"
          label={t("operations.bird_type")}
          value={trip.birdType || notEntered}
        />
        <StepKpiCard
          icon={MapPin}
          tone="bg-rose-50 text-rose-600"
          label={t("ops.trip.field.farm_address")}
          value={trip.farmAddress?.trim() ? trip.farmAddress : notEntered}
        />
        <StepKpiCard
          icon={Gauge}
          tone="bg-purple-50 text-purple-600"
          label={t("ops.trip.field.farm_meter")}
          value={destMeterLabel}
        />
        <StepKpiCard
          icon={Ticket}
          tone="bg-amber-50 text-amber-600"
          label={t("ops.trip.field.pickup_tolls")}
          value={trip.pickupTolls == null ? notEntered : String(trip.pickupTolls)}
        />
        <StepKpiCard
          icon={Scale}
          tone="bg-teal-50 text-teal-600"
          label={t("ops.trip.field.avg_bird_weight")}
          value={avgWeightLabel}
        />
      </div>
    </section>
  );
}

/** Read-only Step 3 (Pickup) details — same KPI-card format + per-box table. */
export function PickupStepView({ trip }: { trip: Trip }) {
  const { t } = useI18n();
  const pickupBoxes = Array.isArray(trip.boxDetails) ? trip.boxDetails : [];
  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3 shadow-sm">
      <h3 className="text-base sm:text-lg font-bold text-slate-800 flex items-center gap-2 tracking-tight">
        <Package size={18} className="text-amber-600" />
        {t("ops.trip.title.pickup")}
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <StepKpiCard
          icon={Scale}
          tone="bg-emerald-50 text-emerald-600"
          label={t("ops.trip.dc_weight")}
          value={trip.dcWeight != null ? `${trip.dcWeight} KG` : t("ops.trip.not_entered")}
        />
        <StepKpiCard
          icon={Bird}
          tone="bg-sky-50 text-sky-600"
          label={t("ops.trip.total_birds")}
          value={trip.totalBirds != null ? String(trip.totalBirds) : t("ops.trip.not_entered")}
        />
        <StepKpiCard
          icon={Box}
          tone="bg-amber-50 text-amber-600"
          label={t("common.boxes")}
          value={trip.boxes != null ? String(trip.boxes) : t("ops.trip.not_entered")}
        />
        <StepKpiCard
          icon={Gauge}
          tone="bg-purple-50 text-purple-600"
          label={t("ops.trip.avg_weight")}
          value={trip.avgWeight != null ? `${trip.avgWeight} kg` : t("ops.trip.not_entered")}
        />
        <StepKpiCard
          icon={Clock}
          tone="bg-blue-50 text-blue-600"
          label={t("ops.trip.pickup_load_time")}
          value={trip.pickupLoadTime || t("ops.trip.not_entered")}
        />
        <StepKpiCard
          icon={ShieldCheck}
          tone="bg-indigo-50 text-indigo-600"
          label={t("common.status")}
          value={trip.pickupStepSubmitted ? t("ops.trip.submitted") : t("ops.trip.not_submitted")}
        />
      </div>
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
                    <td className="px-3 py-2 text-slate-500">{String(index + 1).padStart(2, "0")}</td>
                    <td className="px-3 py-2 font-semibold text-slate-800">{b.boxNo}</td>
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
