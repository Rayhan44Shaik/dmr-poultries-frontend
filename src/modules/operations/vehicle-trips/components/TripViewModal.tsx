// src/modules/operations/vehicle-trips/components/TripViewModal.tsx
// Read-only Trip View. Never reuses editable Step wizard controls.
// Completed trips are reviewed through the 5-step wizard — each step shows
// ONLY its own persisted data. Incomplete trips keep the existing read-only
// step presentation. Email status (Send All Mail → Total / Sent / Failed)
// is per-shop and stays visible after the batch finishes.

import React, { useState, useCallback } from "react";
import {
  FileText,
  Mail,
  ShieldCheck,
  Send,
  Loader2,
  Clock,
  UserCheck,
  MapPin,
  Package,
  Receipt,
  FileDown,
} from "lucide-react";
import { WhatsAppIcon } from "../../../../ui/WhatsAppIcon";
import type { Trip, ShopDelivery } from "../types/trip";
import {
  getTripWizardCompletedMask,
  isTripWizardComplete,
  TRIP_STEP_LABELS,
} from "../../../../shared/trip";
import { generateShopPDF } from "../utils/generateShopPDF";
import { generateTripReportPDF, type TripReportEmailInfo } from "../utils/generateTripPDF";
import { useTripDeliveryEmails } from "../hooks/useTripDeliveryEmails";
import { useTripDeliveryWhatsApps } from "../hooks/useTripDeliveryWhatsApps";
import TripViewShopCards from "./TripViewShopCards";
import { getNextIncompleteTripStep } from "../../../../shared/trip";
import { useI18n } from "../../../../i18n";

// --- Read-only step presentation (incomplete trips only) ---
import TripWizardStepper from "./TripWizardStepper";
import StepStart from "./StepStart";
import StepPickup from "./StepPickup";
import StepDeliveries from "./StepDeliveries";
import StepEnd from "./Step_5/StepEnd";
import TripFinalKPI from "./TripFinalKPI";

interface Props {
  open: boolean;
  trip: Trip | null;
  onClose: () => void;
  shops: any[];
  birdTypes: any[];
}

/** Read-only Step 1 (Trip Start) details. */
function Step1View({ trip }: { trip: Trip }) {
  const { t } = useI18n();
  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3 shadow-sm">
      <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
        <Clock size={15} className="text-indigo-600" />
        {t("ops.trip.view_step1")}
      </h3>
      <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="border border-slate-100 rounded-xl p-3 bg-slate-50/40">
          <dt className="text-[10px] uppercase font-semibold text-slate-400">{t("ops.trip.field.trip_date")}</dt>
          <dd className="text-xs font-semibold text-slate-800 mt-0.5 break-words">{trip.tripDate || "—"}</dd>
        </div>
        <div className="border border-slate-100 rounded-xl p-3 bg-slate-50/40">
          <dt className="text-[10px] uppercase font-semibold text-slate-400">{t("ops.trip.field.start_time")}</dt>
          <dd className="text-xs font-semibold text-slate-800 mt-0.5 break-words">{trip.startTime || "—"}</dd>
        </div>
        <div className="border border-slate-100 rounded-xl p-3 bg-slate-50/40">
          <dt className="text-[10px] uppercase font-semibold text-slate-400">{t("common.vehicle")}</dt>
          <dd className="text-xs font-semibold text-slate-800 mt-0.5 break-words">{trip.vehicleNo || "—"}</dd>
        </div>
        <div className="border border-slate-100 rounded-xl p-3 bg-slate-50/40">
          <dt className="text-[10px] uppercase font-semibold text-slate-400">{t("common.supervisor")}</dt>
          <dd className="text-xs font-semibold text-slate-800 mt-0.5 break-words">{trip.supervisorName || "—"}</dd>
        </div>
        <div className="border border-slate-100 rounded-xl p-3 bg-slate-50/40">
          <dt className="text-[10px] uppercase font-semibold text-slate-400">{t("common.driver")}</dt>
          <dd className="text-xs font-semibold text-slate-800 mt-0.5 break-words">{trip.driverName || "—"}</dd>
        </div>
        <div className="border border-slate-100 rounded-xl p-3 bg-slate-50/40">
          <dt className="text-[10px] uppercase font-semibold text-slate-400">{t("ops.trip.field.opening_meter")}</dt>
          <dd className="text-xs font-semibold text-slate-800 mt-0.5 break-words">
            {trip.openingMeter != null ? `${trip.openingMeter} KM` : t("ops.trip.not_entered")}
          </dd>
        </div>
        <div className="border border-slate-100 rounded-xl p-3 bg-slate-50/40">
          <dt className="text-[10px] uppercase font-semibold text-slate-400">{t("operations.advance")}</dt>
          <dd className="text-xs font-semibold text-slate-800 mt-0.5 break-words">
            {trip.advanceAmount != null ? `₹ ${trip.advanceAmount.toLocaleString()}` : t("ops.trip.not_entered")}
          </dd>
        </div>
        <div className="border border-slate-100 rounded-xl p-3 bg-slate-50/40">
          <dt className="text-[10px] uppercase font-semibold text-slate-400">{t("ops.trip.field.helpers")}</dt>
          <dd className="text-xs font-semibold text-slate-800 mt-0.5 break-words">{trip.helpers?.join(", ") || "—"}</dd>
        </div>
        <div className="border border-slate-100 rounded-xl p-3 bg-slate-50/40">
          <dt className="text-[10px] uppercase font-semibold text-slate-400">{t("ops.trip.field.loaders")}</dt>
          <dd className="text-xs font-semibold text-slate-800 mt-0.5 break-words">{trip.loaders?.join(", ") || "—"}</dd>
        </div>
        <div className="border border-slate-100 rounded-xl p-3 bg-slate-50/40">
          <dt className="text-[10px] uppercase font-semibold text-slate-400">{t("common.status")}</dt>
          <dd className="text-xs font-semibold text-slate-800 mt-0.5 break-words">
            {trip.startStepSubmitted ? t("ops.trip.submitted") : t("ops.trip.not_submitted")}
          </dd>
        </div>
      </dl>
    </section>
  );
}

/** Read-only Step 2 (Farm / Destination) details — compact, fits the view. */
function Step2View({ trip }: { trip: Trip }) {
  const { t } = useI18n();
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
    </section>
  );
}

/** Read-only Step 3 (Pickup) details. */
function Step3View({ trip }: { trip: Trip }) {
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

/** Read-only Step 5 (End / Expenses / Diesel) details. */
function Step5View({ trip }: { trip: Trip }) {
  const { t } = useI18n();
  const totalKm =
    trip.totalKm != null && Number.isFinite(Number(trip.totalKm))
      ? Number(trip.totalKm)
      : Number(trip.closingMeter || 0) - Number(trip.openingMeter || 0);

  const submittedDiesel = Array.isArray(trip.dieselEntries)
    ? trip.dieselEntries.filter((e) => e.submitted !== false)
    : [];
  const totalDieselLitres = submittedDiesel.reduce((acc, e) => acc + Number(e.litres || 0), 0);
  const totalDieselAmount = submittedDiesel.reduce((acc, e) => acc + Number(e.amount || 0), 0);

  const expensePairs: Array<[string, number]> = [
    [t("ops.trip.exp_meals"), Number(trip.meals || 0)],
    [t("ops.trip.exp_loading"), Number(trip.loading || 0)],
    [t("ops.trip.exp_meals_tiffin"), Number(trip.mealsTiffin || 0)],
    [t("ops.trip.exp_vehicle_maintenance"), Number(trip.vehicleMaintenance || 0)],
    [t("ops.trip.exp_tea"), Number(trip.othersRC || 0)],
    [t("ops.trip.exp_driver"), Number(trip.others1Amt || 0)],
    [t("ops.trip.exp_supervisor"), Number(trip.others2Amt || 0)],
    [t("ops.trip.exp_helper_loader"), Number(trip.others3Amt || 0)],
    [t("common.other"), Number(trip.others4Amt || 0)],
    [t("common.other"), Number(trip.others5Amt || 0)],
  ];
  const positiveExpenses = expensePairs.filter(([, amt]) => amt > 0);
  const totalExpenses = positiveExpenses.reduce((acc, [, amt]) => acc + amt, 0);

  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3 shadow-sm">
      <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
        <Receipt size={15} className="text-orange-600" />
        {t("ops.trip.view_step5")}
      </h3>
      <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="border border-slate-100 rounded-xl p-3 bg-slate-50/40">
          <dt className="text-[10px] uppercase font-semibold text-slate-400">{t("ops.trip.field.end_meter")}</dt>
          <dd className="text-xs font-semibold text-slate-800 mt-0.5 break-words">
            {trip.closingMeter != null ? `${trip.closingMeter} KM` : t("ops.trip.not_entered")}
          </dd>
        </div>
        <div className="border border-slate-100 rounded-xl p-3 bg-slate-50/40">
          <dt className="text-[10px] uppercase font-semibold text-slate-400">{t("ops.trip.delivery_tolls")}</dt>
          <dd className="text-xs font-semibold text-slate-800 mt-0.5 break-words">
            {trip.deliveryTolls != null ? String(trip.deliveryTolls) : t("ops.trip.not_entered")}
          </dd>
        </div>
        <div className="border border-slate-100 rounded-xl p-3 bg-slate-50/40">
          <dt className="text-[10px] uppercase font-semibold text-slate-400">{t("ops.trip.total_distance")}</dt>
          <dd className="text-xs font-semibold text-slate-800 mt-0.5 break-words">{Math.max(0, totalKm)} KM</dd>
        </div>
        <div className="border border-slate-100 rounded-xl p-3 bg-slate-50/40">
          <dt className="text-[10px] uppercase font-semibold text-slate-400">{t("ops.trip.mileage")}</dt>
          <dd className="text-xs font-semibold text-slate-800 mt-0.5 break-words">
            {trip.mileageKmL != null && Number.isFinite(Number(trip.mileageKmL))
              ? `${Number(trip.mileageKmL).toFixed(2)} km/L`
              : t("ops.trip.not_available")}
          </dd>
        </div>
        <div className="border border-slate-100 rounded-xl p-3 bg-slate-50/40">
          <dt className="text-[10px] uppercase font-semibold text-slate-400">{t("operations.total_expenses")}</dt>
          <dd className="text-xs font-semibold text-slate-800 mt-0.5 break-words">₹ {totalExpenses.toFixed(2)}</dd>
        </div>
        <div className="border border-slate-100 rounded-xl p-3 bg-slate-50/40">
          <dt className="text-[10px] uppercase font-semibold text-slate-400">{t("ops.trip.total_diesel")}</dt>
          <dd className="text-xs font-semibold text-slate-800 mt-0.5 break-words">
            {totalDieselLitres} Ltrs · ₹ {totalDieselAmount.toFixed(2)}
          </dd>
        </div>
        <div className="border border-slate-100 rounded-xl p-3 bg-slate-50/40">
          <dt className="text-[10px] uppercase font-semibold text-slate-400">{t("common.status")}</dt>
          <dd className="text-xs font-semibold text-slate-800 mt-0.5 break-words">
            {isTripWizardComplete(trip) ? t("ops.trip.submitted") : t("ops.trip.not_submitted")}
          </dd>
        </div>
      </dl>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">{t("operations.general_expenses")}</h4>
          {positiveExpenses.length ? (
            <div className="rounded-xl border border-slate-200/70 overflow-hidden">
              <table className="w-full text-xs">
                <tbody className="divide-y divide-slate-100">
                  {positiveExpenses.map(([label, amt]) => (
                    <tr key={label} className="hover:bg-slate-50/60">
                      <td className="px-3 py-2 text-slate-600">{label}</td>
                      <td className="px-3 py-2 text-right font-semibold text-slate-800 tabular-nums">₹ {amt.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-slate-400">{t("ops.trip.no_expenses_recorded")}</p>
          )}
        </div>
        <div>
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">{t("ops.trip.diesel_fuel")}</h4>
          {submittedDiesel.length ? (
            <div className="overflow-x-auto rounded-xl border border-slate-200/70">
              <table className="w-full text-xs">
                <thead className="bg-slate-50/80">
                  <tr>
                    {[t("table.s_no"), t("ops.trip.litres"), t("common.rate"), t("table.amount"), t("ops.trip.meter"), t("ops.trip.bunk")].map((h) => (
                      <th key={h} className="px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {submittedDiesel.map((e, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/60">
                      <td className="px-3 py-2 text-slate-500">{idx + 1}</td>
                      <td className="px-3 py-2 text-slate-700 tabular-nums">{String(e.litres ?? "")}</td>
                      <td className="px-3 py-2 text-slate-700 tabular-nums">{String(e.rate ?? "")}</td>
                      <td className="px-3 py-2 text-slate-700 tabular-nums">₹ {Number(e.amount ?? 0).toFixed(2)}</td>
                      <td className="px-3 py-2 text-slate-700">{String(e.meter ?? "--")}</td>
                      <td className="px-3 py-2 text-slate-700">{String(e.bunkName || "--")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-slate-400">{t("ops.trip.no_diesel_entries")}</p>
          )}
        </div>
      </div>
    </section>
  );
}

/** Communication Summary panel showing Mail and WhatsApp stats side by side. */
function CommunicationSummary({
  emailCounts,
  whatsappCounts,
}: {
  emailCounts: { sent: number; pending: number; sending: number; failed: number; total: number };
  whatsappCounts: { sent: number; pending: number; sending: number; failed: number; total: number };
}) {
  const { t } = useI18n();
  const emailProcessing = emailCounts.sending + emailCounts.pending;
  const whatsappProcessing = whatsappCounts.sending + whatsappCounts.pending;

  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-sm">
      <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
        <Package size={15} className="text-emerald-600" />
        {t("ops.trip.communication_summary")}
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Mail Summary */}
        {emailCounts.total > 0 && (
          <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Mail size={18} className="text-sky-600" />
              <span className="text-sm font-bold text-sky-800">Mail</span>
            </div>
            <dl className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <dt className="text-slate-500">{t("ops.trip.total_shops")}</dt>
                <dd className="font-semibold text-slate-800">{emailCounts.total}</dd>
              </div>
              <div>
                <dt className="text-slate-500">{t("common.sent")}</dt>
                <dd className="font-semibold text-emerald-700">{emailCounts.sent}</dd>
              </div>
              <div>
                <dt className="text-slate-500">{t("common.failed")}</dt>
                <dd className="font-semibold text-red-700">{emailCounts.failed}</dd>
              </div>
              <div>
                <dt className="text-slate-500">{t("common.pending")}</dt>
                <dd className="font-semibold text-slate-500">{emailCounts.pending}</dd>
              </div>
              {emailProcessing > 0 && (
                <>
                  <div>
                    <dt className="text-slate-500">{t("ops.trip.processing")}</dt>
                    <dd className="font-semibold text-sky-700">{emailProcessing}</dd>
                  </div>
                </>
              )}
            </dl>
          </div>
        )}

        {/* WhatsApp Summary */}
        {whatsappCounts.total > 0 && (
          <div className="rounded-xl border border-green-200 bg-green-50 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <WhatsAppIcon size={18} className="text-green-600" />
              <span className="text-sm font-bold text-green-800">WhatsApp</span>
            </div>
            <dl className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <dt className="text-slate-500">{t("ops.trip.total_shops")}</dt>
                <dd className="font-semibold text-slate-800">{whatsappCounts.total}</dd>
              </div>
              <div>
                <dt className="text-slate-500">{t("common.sent")}</dt>
                <dd className="font-semibold text-emerald-700">{whatsappCounts.sent}</dd>
              </div>
              <div>
                <dt className="text-slate-500">{t("common.failed")}</dt>
                <dd className="font-semibold text-red-700">{whatsappCounts.failed}</dd>
              </div>
              <div>
                <dt className="text-slate-500">{t("common.pending")}</dt>
                <dd className="font-semibold text-slate-500">{whatsappCounts.pending}</dd>
              </div>
              {whatsappProcessing > 0 && (
                <>
                  <div>
                    <dt className="text-slate-500">{t("ops.trip.processing")}</dt>
                    <dd className="font-semibold text-sky-700">{whatsappProcessing}</dd>
                  </div>
                </>
              )}
            </dl>
          </div>
        )}
      </div>
    </section>
  );
}

function TripViewModal({ open, trip, onClose, shops }: Props) {
  const { t } = useI18n();
  // Completed trips open on Step 4 (Shop Deliveries); incomplete on Step 1.
  const [viewStepIndex, setViewStepIndex] = useState(() =>
    trip && trip.status === "Completed" && isTripWizardComplete(trip) ? 3 : 0
  );
  const [lastTripId, setLastTripId] = useState<number | null>(trip?.id ?? null);

  // Reset the selected step when a different trip is opened (render-phase
  // adjustment — the official "adjust state when props change" pattern).
  if (trip && trip.id !== lastTripId) {
    setLastTripId(trip.id);
    setViewStepIndex(trip.status === "Completed" && isTripWizardComplete(trip) ? 3 : 0);
  }

  const noopSubscribeSaveStatus = useCallback(() => () => {}, []);
  const getIdleSaveStatus = useCallback(() => "idle" as const, []);

  const emailState = useTripDeliveryEmails(trip, shops);
  const whatsappState = useTripDeliveryWhatsApps(trip, shops);

  // ─── Early return – ensures trip is never null after this ─────
  if (!open || !trip) return null;

  const isCompleted = trip.status === "Completed" && isTripWizardComplete(trip);

  // ─── STEP STATE FLAGS (backend submitted flags only) ───
  const isStartCompleted = Boolean(trip.startStepSubmitted);
  const isDeliveryCompleted = Boolean(trip.deliveryStepSubmitted);
  const isEndCompleted = isTripWizardComplete(trip);
  const completedMask = getTripWizardCompletedMask(trip);
  // Read-only view: future steps on an incomplete trip stay locked; a completed
  // trip can review every step.
  const maxAllowedViewStep = isTripWizardComplete(trip)
    ? 4
    : getNextIncompleteTripStep(trip);
  const lockedSteps = TRIP_STEP_LABELS.map((_, index) => index > maxAllowedViewStep);
  const safeViewStepIndex = Math.min(Math.max(0, viewStepIndex), maxAllowedViewStep);

  const downloadShopPDF = async (delivery: ShopDelivery) => {
    await generateShopPDF(
      delivery,
      trip.boxDetails || [],
      trip.tripNo,
      trip.vehicleNo,
      trip.supervisorName,
      undefined,
      trip.tripDate,
      undefined,
      undefined,
      delivery.autoCaptureTime,
      trip.driverName
    );
  };

  // ─── Create PDF — professional A4 portrait trip report ────────────
  const downloadTripReport = async () => {
    const emailInfo: TripReportEmailInfo | null =
      emailCounts.total > 0
        ? {
            total: emailCounts.total,
            sent: emailCounts.sent,
            failed: emailCounts.failed,
            pending: emailCounts.pending,
            byShop: (trip.deliveries || []).map((delivery) => ({
              shopName: delivery.shopName,
              status: emailState.effectiveStatus(delivery.id),
            })),
          }
        : null;
    await generateTripReportPDF(trip, emailInfo);
  };

  // ─── Dummy functions for read‑only steps (incomplete trips) ───
  const noop = () => {};
  const noopDispatch = () => {};

  const renderViewStep = () => {
    if (safeViewStepIndex === 0 && isStartCompleted) {
      return (
        <StepStart
          tripId={trip.id}
          tripNo={trip.tripNo}
          startTime={trip.startTime}
          startStepSubmitted={trip.startStepSubmitted}
          loadSnapshot={trip}
          updateTrip={noop}
          submitStartStep={async () => false}
          vehicleOptions={[]}
          employeeOptions={[]}
          subscribeHeaderSaveStatus={noopSubscribeSaveStatus}
          getHeaderSaveStatus={getIdleSaveStatus}
        />
      );
    }
    if (safeViewStepIndex === 1) {
      return <Step2View trip={trip} />;
    }
    if (safeViewStepIndex === 2) {
      return (
        <StepPickup
          trip={trip}
          setTrip={noopDispatch}
          updateTrip={noop}
          submitPickupStep={() => false}
          updateBoxDetails={noop}
        />
      );
    }
    if (safeViewStepIndex === 3 && isDeliveryCompleted) {
      return <StepDeliveries rows={trip.deliveries || []} setRows={noopDispatch} shops={shops} birdTypes={[]} trip={trip} updateDeliveries={noop} submitDeliveriesStep={() => false} clearForm={noop} readOnly={true} canEdit={false} />;
    }
    if (safeViewStepIndex === 4 && isEndCompleted) {
      return (
        <StepEnd
          trip={trip}
          setTrip={noopDispatch}
          updateTrip={noop}
          submitExpensesStep={() => false}
          submitStartStep={() => false}
          editable={false}
          canEdit={false}
          onCancel={noop}
          clearForm={noop}
        />
      );
    }
    return <div className="mt-8 text-center p-12 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 text-sm">{t("ops.trip.select_completed_step")}</div>;
  };

  /** Completed trips: show ONLY the selected step's own persisted data. */
  const renderCompletedStep = () => {
    switch (safeViewStepIndex) {
      case 0:
        return <Step1View trip={trip} />;
      case 1:
        return <Step2View trip={trip} />;
      case 2:
        return <Step3View trip={trip} />;
      case 3:
        return (
          <TripViewShopCards
            trip={trip}
            shops={shops}
            effectiveStatus={emailState.effectiveStatus}
            busyIds={emailState.busyIds}
            isBulkSending={emailState.isBulkSending}
            bulkProgress={emailState.bulkProgress}
            shopEmailFor={emailState.shopEmailFor}
            failureReasonFor={emailState.failureReasonFor}
            sendCountFor={emailState.sendCountFor}
            onSendOne={(delivery) => void emailState.sendOne(delivery)}
            onDownloadPdf={(delivery) => void downloadShopPDF(delivery)}
            emailCounts={emailCounts}
            // WhatsApp props
            whatsappEffectiveStatus={whatsappState.effectiveStatus}
            whatsappBusyIds={whatsappState.busyIds}
            whatsappIsBulkSending={whatsappState.isBulkSending}
            shopWhatsAppFor={whatsappState.shopWhatsAppFor}
            whatsappFailureReasonFor={whatsappState.failureReasonFor}
            whatsappSendCountFor={whatsappState.sendCountFor}
            onSendOneWhatsApp={(delivery) => void whatsappState.sendOne(delivery)}
            whatsappCounts={whatsappCounts}
          />
        );
      case 4:
        return <Step5View trip={trip} />;
      default:
        return null;
    }
  };

  const emailCounts = emailState.counts;
  const whatsappCounts = whatsappState.counts;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 overflow-y-auto animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-7xl max-h-[92vh] overflow-hidden flex flex-col">
        {/* ─── Header ─────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4 px-6 md:px-8 py-5 border-b border-slate-100 bg-gradient-to-r from-emerald-50/80 via-white to-emerald-50/80">
          <div className="flex items-center gap-4 min-w-0">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20 text-white shrink-0">
              <FileText className="w-7 h-7" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg md:text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2 flex-wrap">
                <span className="truncate">{trip.tripNo || t("ops.trip.trip_details")}</span>
                {isCompleted ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 text-white px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                    <ShieldCheck size={11} /> {t("ops.trip.submitted_locked")}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-700 border border-amber-200 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                    {trip.status || t("status.pending")}
                  </span>
                )}
              </h2>
              <p className="text-xs font-medium text-slate-400 mt-1">{t("ops.trip.read_only_overview")}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap justify-end shrink-0">
            {isCompleted && trip.approvedBy && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 border border-slate-200 shadow-sm">
                <UserCheck size={12} className="text-emerald-600" />
                {t("table.approved_by")}: {trip.approvedBy}
              </span>
            )}
            {isCompleted && emailCounts.total > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700 border border-sky-200 shadow-sm" role="status" aria-live="polite">
                <Mail size={12} />
                {emailState.isBulkSending ? (
                  <>
                    {t("ops.trip.sending")}... {emailState.bulkProgress?.sent ?? emailCounts.sent} / {emailState.bulkProgress?.total ?? emailCounts.total}
                  </>
                ) : (
                  <>
                    {emailCounts.total} {t("ops.trip.shops")} · {emailCounts.sent} {t("common.sent")}
                    {emailCounts.pending > 0 ? ` · ${emailCounts.pending} ${t("common.pending")}` : ""}
                    {emailCounts.failed > 0 ? ` · ${emailCounts.failed} ${t("common.failed")}` : ""}
                  </>
                )}
              </span>
            )}
            {isCompleted && whatsappCounts.total > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-700 border border-green-200 shadow-sm" role="status" aria-live="polite">
                <WhatsAppIcon size={12} />
                {whatsappState.isBulkSending ? (
                  <>
                    {t("ops.trip.sending")}... {whatsappState.bulkProgress?.sent ?? whatsappCounts.sent} / {whatsappState.bulkProgress?.total ?? whatsappCounts.total}
                  </>
                ) : (
                  <>
                    {whatsappCounts.total} {t("ops.trip.shops")} · {whatsappCounts.sent} {t("common.sent")}
                    {whatsappCounts.pending > 0 ? ` · ${whatsappCounts.pending} ${t("common.pending")}` : ""}
                    {whatsappCounts.failed > 0 ? ` · ${whatsappCounts.failed} ${t("common.failed")}` : ""}
                  </>
                )}
              </span>
            )}
            {isCompleted && emailCounts.total > 0 && (
              <button
                type="button"
                onClick={() => void emailState.sendAll()}
                disabled={emailState.isBulkSending}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-emerald-500/20 transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
                title={t("ops.trip.send_email_all")}
              >
                {emailState.isBulkSending ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Send size={14} />
                )}
                {emailState.isBulkSending ? `${t("ops.trip.sending")}...` : t("ops.trip.send_all_mail")}
              </button>
            )}
            {isCompleted && whatsappCounts.total > 0 && (
              <button
                type="button"
                onClick={() => void whatsappState.sendAll()}
                disabled={whatsappState.isBulkSending}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-green-500/20 transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
                title={t("ops.trip.send_whatsapp_all")}
              >
                {whatsappState.isBulkSending ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <WhatsAppIcon size={14} />
                )}
                {whatsappState.isBulkSending ? `${t("ops.trip.sending")}...` : t("ops.trip.send_all_whatsapp")}
              </button>
            )}
            <button
              type="button"
              onClick={() => void downloadTripReport()}
              className="inline-flex items-center justify-center rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 p-2 text-red-700 shadow-sm transition-all active:scale-95"
              title={t("ops.trip.create_pdf_title")}
              aria-label={t("ops.trip.create_pdf")}
            >
              <FileDown size={16} />
            </button>
          </div>
        </div>

        {/* ─── Body ─────────────────────────────────────────────────── */}
        <div className="py-6 md:py-8 px-4 md:px-8 overflow-y-auto space-y-5 flex-1">
          <TripWizardStepper
            steps={TRIP_STEP_LABELS}
            currentStep={safeViewStepIndex}
            completedMask={completedMask}
            lockedSteps={lockedSteps}
            onStepClick={setViewStepIndex}
            onLockedStepClick={() => {
              if (!isTripWizardComplete(trip)) {
                setViewStepIndex(maxAllowedViewStep);
              }
            }}
          />
          <div key={`${trip.id}-step-${safeViewStepIndex}`} className="animate-fade-in-up">
            {isCompleted ? renderCompletedStep() : renderViewStep()}
          </div>
          {/* Communication Summary - only on Shop Deliveries step for completed trips */}
          {isCompleted && safeViewStepIndex === 3 && (emailCounts.total > 0 || whatsappCounts.total > 0) && (
            <CommunicationSummary
              emailCounts={emailCounts}
              whatsappCounts={whatsappCounts}
            />
          )}
          <TripFinalKPI trip={trip} deliveries={trip.deliveries} />
        </div>

        {/* ─── Footer ───────────────────────────────────────────────── */}
        <div className="px-6 md:px-8 py-5 border-t border-slate-100 bg-gradient-to-r from-slate-50/80 via-white to-slate-50/80 flex items-center justify-end gap-3">
          <button onClick={onClose} className="inline-flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-all active:scale-95">
            {t("common.close")}
          </button>
        </div>
      </div>
    </div>
  );
}

export default React.memo(TripViewModal);