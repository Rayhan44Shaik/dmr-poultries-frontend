import React, { useState } from "react";
import { Clock, MapPin, Gauge, Store, Ticket, MessageSquare, Loader2, Scale, Pencil, Layers } from "lucide-react";
import type { Trip } from "../types/trip";
import { StepCloseButton, WizardActionBar, WizardStepNotice } from "./WizardStepUI";
import { FieldLabel, SearchDropdown, StepKpiCard, type DropdownOption } from "./WizardControls";
import { GpsAddressText } from "./GpsAddressText";
import { formatIstStamp } from "../services/tripHeaderApiService";
import {
  TRIP_FIELD_DEFINITIONS,
} from "../../../../shared/trip/definitions";
import { validateFarmStep } from "../../../../shared/trip/validation";
import { isMeterInvalid, meterMustBeGreaterThan } from "../utils/meterValidation";
import { translateValidationMessage } from "../utils/translateValidation";
import { useI18n } from "../../../../i18n";

interface Props {
  trip: Trip;
  setTrip: React.Dispatch<React.SetStateAction<Trip>>;
  updateTrip: (updates: Partial<Trip>) => void;
  submitFarmStep: (data: Partial<Trip>) => boolean | Promise<boolean>;
  saveFarmProgress?: (data: Partial<Trip>) => Promise<boolean>;
  hasUnsavedChanges?: boolean;
  farms: any[];
  birdTypes: any[];
  editable?: boolean;
  canEdit?: boolean;
  onCancel?: () => void;
  /** Close the whole Trip Entry editor (no data change). */
  clearForm?: () => void;
  showNotification?: (message: string, type?: "info" | "success" | "error" | "warning") => void;
}

function farmMasterAddress(farm: any): string {
  return String(farm?.address ?? farm?.farmAddress ?? "").trim();
}

export default function StepFarm({
  trip,
  setTrip,
  updateTrip,
  submitFarmStep,
  saveFarmProgress,
  hasUnsavedChanges = false,
  farms,
  birdTypes,
  editable = false,
  canEdit = false,
  onCancel,
  clearForm,
  showNotification,
}: Props) {
  const { t } = useI18n();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLocalEditing, setIsLocalEditing] = useState(false);
  const [destMeterError, setDestMeterError] = useState<string | null>(null);
  const [isFetchingLocation, setIsFetchingLocation] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "warning" } | null>(null);

  const notify = (msg: string, type: "success" | "error" | "warning" = "success") => {
    if (showNotification) {
      showNotification(msg, type);
    } else {
      setToast({ message: msg, type });
    }
  };

  const farmAddress = trip.farmAddress || "";
  const remarks = trip.remarks || "";
  const avgBirdWeight = trip.avgBirdWeight || 0;
  const hasGps =
    trip.farmGpsLat != null &&
    trip.farmGpsLon != null &&
    Number.isFinite(Number(trip.farmGpsLat)) &&
    Number.isFinite(Number(trip.farmGpsLon)) &&
    !(Number(trip.farmGpsLat) === 0 && Number(trip.farmGpsLon) === 0);

  const farmOptions = farms
    .filter((farm: any) => {
      const active = String(farm.status ?? "Active") === "Active";
      return active || farm.id === trip.sourceFarmId;
    })
    .slice()
    .sort((a: any, b: any) => String(a.farmName ?? "").localeCompare(String(b.farmName ?? "")))
    .map((farm: any) => ({
      value: String(farm.id),
      label: farm.farmName,
    }));

  const birdTypeOptions = birdTypes
    .filter((bird: any) => {
      const active = String(bird.status ?? "Active") === "Active";
      return active || bird.id === trip.birdTypeId;
    })
    .slice()
    .sort((a: any, b: any) => String(a.birdType ?? a.name ?? "").localeCompare(String(b.birdType ?? b.name ?? "")))
    .map((bird: any): DropdownOption => ({
      value: String(bird.id ?? bird.birdTypeId),
      label: bird.birdType ?? bird.name,
    }));

  const fetchCurrentLocation = () => {
    if (!navigator.geolocation) {
      notify(t("ops.trip.geo_unsupported"), "error");
      return;
    }
    setIsFetchingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        if (
          !Number.isFinite(latitude) ||
          !Number.isFinite(longitude) ||
          latitude < -90 ||
          latitude > 90 ||
          longitude < -180 ||
          longitude > 180 ||
          (latitude === 0 && longitude === 0)
        ) {
          notify(t("ops.trip.gps_invalid_coords"), "error");
          setIsFetchingLocation(false);
          return;
        }
        updateTrip({
          farmGpsLat: latitude,
          farmGpsLon: longitude,
          farmGpsAccuracy: Number.isFinite(accuracy) && accuracy >= 0 ? accuracy : null,
          farmGpsTime: new Date(position.timestamp).toISOString(),
        });
        setIsFetchingLocation(false);
      },
      (error) => {
        notify(t("ops.trip.gps_unable_fetch"), "error");
        setIsFetchingLocation(false);
        void error;
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // Same selection semantics as before: empty value = clear (id 0, name "",
  // address reset), a picked option resolves the master record.
  const handleFarmChange = (value: string) => {
    const id = Number(value) || 0;
    const farm = farms.find((f: any) => f.id === id);
    setTrip((prev) => ({
      ...prev,
      sourceFarmId: id,
      sourceFarm: farm ? farm.farmName : "",
      farmAddress: farm ? farmMasterAddress(farm) : "",
    }));
  };

  const handleBirdChange = (value: string) => {
    const id = Number(value) || 0;
    const bird = birdTypes.find((b: any) => (b.id ?? b.birdTypeId) === id);
    setTrip((prev) => ({
      ...prev,
      birdTypeId: id,
      birdType: bird ? (bird.birdType ?? bird.name ?? "") : "",
    }));
  };

  const handleDestMeterChange = (value: string) => {
    const num = value === "" ? 0 : Number(value);
    updateTrip({ destMeter: num });
    const prev = Number(trip.openingMeter ?? 0);
    const invalid = isMeterInvalid(num, prev) && num > 0;
    setDestMeterError(invalid ? meterMustBeGreaterThan(prev) : null);
  };

  const handleTollsChange = (value: string) => {
    if (value === "") {
      updateTrip({ pickupTolls: 0 });
      return;
    }
    const num = Number(value);
    updateTrip({ pickupTolls: Number.isFinite(num) && num < 0 ? 0 : Number.isFinite(num) ? num : 0 });
  };

  const handleSubmit = async () => {
    const validation = validateFarmStep(trip);
    if (!validation.valid) {
      notify(translateValidationMessage(t, validation.errors[0]), "warning");
      return;
    }
    if (destMeterError) {
      notify(destMeterError, "warning");
      return;
    }

    setIsSubmitting(true);
    try {
      const success = await submitFarmStep({});
      if (success) {
        setIsLocalEditing(false);
        notify(t("ops.trip.step2_submitted"), "success");
      } else {
        notify(t("ops.trip.submission_failed"), "error");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveProgress = async () => {
    if (!saveFarmProgress) return;
    setIsSubmitting(true);
    try {
      const success = await saveFarmProgress({});
      if (success) notify(t("ops.trip.progress_saved"), "success");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (trip.farmStepSubmitted && !editable && !isLocalEditing) {
    const destMeterLabel =
      trip.destMeter == null || Number(trip.destMeter) === 0
        ? t("ops.trip.not_entered")
        : `${trip.destMeter} KM`;
    const avgWeightLabel =
      trip.avgBirdWeight == null || Number(trip.avgBirdWeight) === 0
        ? t("ops.trip.not_entered")
        : `${Number(trip.avgBirdWeight).toFixed(2)} kg`;
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 gap-3">
          <div className="flex items-center gap-2.5">
            <span className="bg-blue-600 text-white w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold shrink-0">
              2
            </span>
            <h2 className="text-xl font-bold text-slate-800 tracking-tight">
              {t("ops.trip.title.farm").toUpperCase()}
            </h2>
          </div>
          <div className="flex items-center gap-2 shrink-0">

            {canEdit && (
              <button
                type="button"
                onClick={() => setIsLocalEditing(true)}
                className="bg-white hover:bg-slate-50 p-2 rounded-lg border border-slate-200 text-slate-700 transition-all active:scale-95"
                title={t("ops.trip.edit_step")}
              >
                <Pencil size={14} />
              </button>
            )}
            <StepCloseButton onClose={clearForm} />
            <span className="bg-slate-100 border border-slate-200 text-slate-700 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap">
              {t("ops.trip.submitted_locked")}
            </span>
          </div>
        </div>

        {/* GPS — complete reverse-geocoded address on its own full line */}
        <div className="bg-white border border-slate-200/80 rounded-xl p-3.5 shadow-2xs">
          <span className="text-xs uppercase font-semibold text-slate-400 flex items-center gap-1.5 mb-1.5">
            <span className="h-5 w-5 rounded-md bg-cyan-50 text-cyan-600 flex items-center justify-center shrink-0">
              <MapPin size={12} />
            </span>
            {t("ops.trip.field.gps_address")}
          </span>
          {hasGps ? (
            <>
              <p className="text-sm font-semibold text-slate-800 break-words leading-relaxed">
                <GpsAddressText lat={trip.farmGpsLat} lon={trip.farmGpsLon} fallback={t("ops.trip.location_captured")} />
              </p>
              <p className="text-[11px] text-slate-400 mt-1.5">
                {Number(trip.farmGpsLat).toFixed(6)}, {Number(trip.farmGpsLon).toFixed(6)}
                {trip.farmGpsAccuracy != null ? `  ·  ±${Number(trip.farmGpsAccuracy).toFixed(1)} m` : ""}
              </p>
            </>
          ) : (
            <p className="text-sm font-semibold text-slate-400">{t("ops.trip.not_captured")}</p>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <StepKpiCard
            icon={Clock}
            tone="bg-sky-50 text-sky-600"
            label={t("ops.trip.field.reached_time")}
            value={trip.farmStepSubmittedAt ? formatIstStamp(trip.farmStepSubmittedAt) : trip.reachedTime || t("ops.trip.not_entered")}
          />
          <StepKpiCard
            icon={Store}
            tone="bg-emerald-50 text-emerald-600"
            label={t("common.farm")}
            value={trip.sourceFarm || t("ops.trip.not_entered")}
          />
          <StepKpiCard
            icon={Layers}
            tone="bg-violet-50 text-violet-600"
            label={t("operations.bird_type")}
            value={trip.birdType || t("ops.trip.not_entered")}
          />
          <StepKpiCard
            icon={MapPin}
            tone="bg-rose-50 text-rose-600"
            label={t("ops.trip.field.farm_address")}
            value={trip.farmAddress || t("ops.trip.not_entered")}
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
            value={trip.pickupTolls ?? 0}
          />
          <StepKpiCard
            icon={Scale}
            tone="bg-teal-50 text-teal-600"
            label={t("ops.trip.field.avg_bird_weight")}
            value={avgWeightLabel}
          />
        </div>
        {trip.remarks ? (
          <p className="text-xs text-slate-600">
            <span className="font-semibold text-slate-400 uppercase text-[10px]">{t("common.remarks")} </span>
            {trip.remarks}
          </p>
        ) : null}

        <div className="bg-white rounded-xl border border-slate-200 p-3.5 flex items-center justify-between">
          <p className="text-xs text-slate-600 font-normal">{t("ops.trip.farm_submitted_ok")}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        .hide-spinner::-webkit-inner-spin-button,
        .hide-spinner::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
        .hide-spinner { -moz-appearance: textfield; appearance: none; }
      `}</style>
      <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-6 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 gap-3">
          <div className="flex items-center gap-2.5">
            <span className="bg-blue-600 text-white w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold shrink-0">
              2
            </span>
            <h2 className="text-xl font-bold text-slate-800 tracking-tight">
              {t("ops.trip.title.farm").toUpperCase()}
            </h2>
          </div>
          <div className="flex items-center gap-2 shrink-0">

            {editable && trip.farmStepSubmitted && (
              <span className="text-xs text-slate-700 font-medium bg-slate-100 px-3 py-1 rounded-full border border-slate-200 whitespace-nowrap">
                {t("ops.trip.editable_view")}
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 sm:gap-x-6 gap-y-4 sm:gap-y-5">
          <div>
            <FieldLabel
              icon={Clock}
              tone="bg-sky-50 text-sky-600"
              label={t("ops.trip.field.reached_time")}
              required={TRIP_FIELD_DEFINITIONS.reachedTime.required}
            />
            <div className="mt-1 h-[42px] bg-white border border-slate-200 rounded-xl px-4 flex items-center text-sm font-medium text-slate-800">
              {trip.farmStepSubmittedAt
                ? formatIstStamp(trip.farmStepSubmittedAt)
                : trip.reachedTime
                  ? trip.reachedTime
                  : <span className="text-slate-400 font-normal text-xs">{t("ops.trip.auto_captured_on_submit")}</span>}
            </div>
          </div>

          <div>
            <FieldLabel
              icon={Store}
              tone="bg-emerald-50 text-emerald-600"
              label={t("common.farm")}
              required={TRIP_FIELD_DEFINITIONS.sourceFarmId.required}
            />
            <SearchDropdown
              value={trip.sourceFarmId ? String(trip.sourceFarmId) : ""}
              options={farmOptions}
              placeholder={t("ops.trip.search_farm")}
              searchPlaceholder={t("ops.trip.search_farm")}
              disabled={false}
              onChange={handleFarmChange}
            />
          </div>

          <div className="sm:col-span-2">
            <FieldLabel icon={MapPin} tone="bg-cyan-50 text-cyan-600" label="GPS" required />
            <div className="flex items-center gap-2 mt-1">
              <div className="flex-1 min-w-0 h-[42px] rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-800 flex items-center">
                {hasGps ? (
                  <span className="truncate" title={`${Number(trip.farmGpsLat).toFixed(6)}, ${Number(trip.farmGpsLon).toFixed(6)}`}>
                    <GpsAddressText lat={trip.farmGpsLat} lon={trip.farmGpsLon} fallback="Location captured" />
                    {trip.farmGpsAccuracy != null ? ` (±${Number(trip.farmGpsAccuracy).toFixed(1)} m)` : ""}
                  </span>
                ) : (
                  <span className="text-slate-400 font-normal text-xs">GPS: {t("ops.trip.not_captured")}</span>
                )}
              </div>
              <button
                type="button"
                onClick={fetchCurrentLocation}
                disabled={isFetchingLocation}
                className="shrink-0 h-[42px] px-4 rounded-xl bg-cyan-50 hover:bg-cyan-100 text-cyan-700 border border-cyan-200 transition-all active:scale-95 flex items-center gap-1.5 text-xs font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isFetchingLocation ? <Loader2 size={16} className="animate-spin" /> : <MapPin size={16} />}
                <span className="hidden sm:inline">{t("ops.trip.get_gps")}</span>
              </button>
            </div>
            {hasGps && trip.farmGpsTime ? (
              <p className="text-[11px] text-slate-400 mt-1">{t("ops.trip.captured_at")}: {trip.farmGpsTime}</p>
            ) : (
              <p className="text-[11px] text-slate-400 mt-1">{t("ops.trip.gps_stays_empty")}</p>
            )}
          </div>

          <div>
            <FieldLabel
              icon={Layers}
              tone="bg-violet-50 text-violet-600"
              label={t("operations.bird_type")}
              required={TRIP_FIELD_DEFINITIONS.birdTypeId.required}
            />
            <SearchDropdown
              value={trip.birdTypeId ? String(trip.birdTypeId) : ""}
              options={birdTypeOptions}
              placeholder={t("ops.trip.search_bird_type")}
              searchPlaceholder={t("ops.trip.search_bird_type")}
              disabled={false}
              onChange={handleBirdChange}
            />
            {birdTypeOptions.length <= 1 && (
              <p className="text-[11px] text-slate-400 mt-1">{t("ops.trip.no_active_bird_types")}</p>
            )}
          </div>

          <div className="sm:col-span-1">
            <FieldLabel
              icon={MapPin}
              tone="bg-rose-50 text-rose-600"
              label={t("ops.trip.field.farm_address")}
            />
            <input
              type="text"
              value={farmAddress}
              onChange={(e) => updateTrip({ farmAddress: e.target.value })}
              className="w-full mt-1 h-[42px] rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-800 focus:border-blue-600 focus:ring-2 focus:ring-blue-500/10 outline-none transition-all placeholder:text-slate-400"
              placeholder={t("ops.trip.farm_address_placeholder")}
            />
          </div>

          <div>
            <FieldLabel
              icon={Gauge}
              tone="bg-purple-50 text-purple-600"
              label={t("ops.trip.field.dest_meter")}
              required={TRIP_FIELD_DEFINITIONS.destMeter.required}
            />
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={trip.destMeter === 0 ? "" : trip.destMeter ?? ""}
              onChange={(e) => handleDestMeterChange(e.target.value)}
              onWheel={(e) => e.currentTarget.blur()}
              className={`hide-spinner w-full mt-1 h-[42px] rounded-xl border ${
                destMeterError
                  ? "border-red-500 focus:border-red-600 focus:ring-2 focus:ring-red-500/10"
                  : "border-slate-200 focus:border-blue-600 focus:ring-2 focus:ring-blue-500/10"
              } bg-white px-4 text-sm font-medium text-slate-800 outline-none transition-all placeholder:text-slate-400`}
              placeholder="0.00"
            />
            {destMeterError ? (
              <div className="mt-1 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-[11px] font-semibold text-red-700">
                {destMeterError}
              </div>
            ) : (
              <p className="text-[11px] text-slate-400 mt-1">
                {t("ops.trip.start_meter")}: <span className="font-semibold text-slate-600">{trip.openingMeter ?? t("ops.trip.not_entered")} KM</span>
              </p>
            )}
          </div>

          <div>
            <FieldLabel
              icon={Ticket}
              tone="bg-amber-50 text-amber-600"
              label={t("ops.trip.field.pickup_tolls")}
            />
            <input
              type="number"
              inputMode="numeric"
              min="0"
              value={trip.pickupTolls ?? 0}
              onChange={(e) => handleTollsChange(e.target.value)}
              onWheel={(e) => e.currentTarget.blur()}
              className="hide-spinner w-full mt-1 h-[42px] rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-800 focus:border-blue-600 focus:ring-2 focus:ring-blue-500/10 outline-none transition-all placeholder:text-slate-400"
              placeholder="0"
            />
            <p className="text-[11px] text-slate-400 mt-1">{t("ops.trip.tolls_hint")}</p>
          </div>

          <div>
            <FieldLabel
              icon={Scale}
              tone="bg-teal-50 text-teal-600"
              label={t("ops.trip.field.avg_bird_weight")}
              required={TRIP_FIELD_DEFINITIONS.avgBirdWeight.required}
            />
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={avgBirdWeight === 0 ? "" : avgBirdWeight}
              onChange={(e) => {
                const val = e.target.value === "" ? 0 : Number(e.target.value);
                updateTrip({ avgBirdWeight: val });
              }}
              onWheel={(e) => e.currentTarget.blur()}
              className="hide-spinner w-full mt-1 h-[42px] rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-800 focus:border-blue-600 focus:ring-2 focus:ring-blue-500/10 outline-none transition-all placeholder:text-slate-400"
              placeholder="e.g., 1.5"
            />
          </div>

          <div>
            <FieldLabel
              icon={MessageSquare}
              tone="bg-slate-100 text-slate-500"
              label={t("common.remarks")}
            />
            <input
              type="text"
              value={remarks}
              onChange={(e) => updateTrip({ remarks: e.target.value })}
              className="w-full mt-1 h-[42px] rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-800 focus:border-blue-600 focus:ring-2 focus:ring-blue-500/10 outline-none transition-all placeholder:text-slate-400"
              placeholder={t("ops.trip.optional")}
            />
          </div>
        </div>

        <WizardStepNotice
          notice={toast ? { type: toast.type === "warning" ? "info" : toast.type, message: toast.message } : null}
          dirty={hasUnsavedChanges}
        />
        <WizardActionBar
          onCancel={() => {
            // Cancel = discard unsaved edits. The parent reverts the working
            // copy to the last saved trip and remounts this step, so exiting
            // local-edit mode here is enough; we must still call onCancel so a
            // pencil-edit of a SUBMITTED step drops the in-progress changes
            // (e.g. a re-picked Bird Type) instead of leaving them in state.
            setIsLocalEditing(false);
            onCancel?.();
          }}
          onSave={saveFarmProgress ? handleSaveProgress : undefined}
          onSubmit={handleSubmit}
          busy={isSubmitting}
          saveDisabled={!hasUnsavedChanges}
          submitDisabled={!!destMeterError}
          submitLabel={trip.farmStepSubmitted ? "ops.trip.update_farm_details" : "ops.trip.submit_farm_details"}
        />
      </div>
    </>
  );
}
