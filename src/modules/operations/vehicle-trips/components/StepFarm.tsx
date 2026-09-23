import React, { useState, useEffect, useRef } from "react";
import { Clock, MapPin, Gauge, Store, Ticket, MessageSquare, Loader2, Scale, Pencil, Layers } from "lucide-react";
import type { Trip } from "../types/trip";
import { StepCloseButton, WizardActionBar } from "./WizardStepUI";
import { TripNoBadge } from "./TripNoBadge";
import { FieldLabel, SearchDropdown, StepKpiCard, type DropdownOption } from "./WizardControls";
import { GpsAddressText } from "./GpsAddressText";
import { formatIstStamp } from "../services/tripHeaderApiService";
import {
  TRIP_FIELD_DEFINITIONS,
} from "../../../../shared/trip/definitions";
import { validateFarmStep } from "../../../../shared/trip/validation";
import { isMeterInvalid, meterMustBeGreaterThan } from "../utils/meterValidation";
import { translateValidationMessage } from "../utils/translateValidation";
import { captureGpsQuiet } from "../utils/captureGps";
import { useI18n } from "../../../../i18n";
import { useSafeNotification } from "../../../../hooks/useSafeNotification";
import { uiActionIconMotionClass } from "../../../../shared/ui/uiTokens";
import { localizeTripViewText } from "../utils/tripViewLocalization";
import TripStepConfirmDialog from "./TripStepConfirmDialog";
import { withMinSaveDuration } from "../utils/withMinSaveDuration";

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
  /** Bottom Cancel → leave wizard / Create New Trip. */
  onCancel?: () => void;
  /** Header Close while editing → locked submitted view. */
  onExitEdit?: () => void;
  /** Close the whole Trip Entry editor (no data change). */
  clearForm?: () => void;
  /** Hide locked-view Close X (Recent / Trip List read-only view). */
  hideWizardClose?: boolean;
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
  onExitEdit,
  clearForm: _clearForm,
  hideWizardClose = false,
}: Props) {
  const { t, language } = useI18n();
  const { showNotification } = useSafeNotification();
  const [isSubmitting, setIsSubmitting] = useState(false);
  /** Same-tick double-submit guard (React state lags one frame). */
  const submitLockRef = useRef(false);
  const [isLocalEditing, setIsLocalEditing] = useState(Boolean(editable));
  useEffect(() => {
    if (editable) setIsLocalEditing(true);
  }, [editable, trip.id]);
  const [destMeterError, setDestMeterError] = useState<string | null>(null);
  const [isFetchingLocation, setIsFetchingLocation] = useState(false);
  const [confirmation, setConfirmation] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    type?: "warning" | "info";
    onConfirm: () => void;
    onCancel?: () => void;
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {},
  });
  const [fieldErrors, setFieldErrors] = useState<{
    farm?: string;
    birdType?: string;
    gps?: string;
    destMeter?: string;
    tolls?: string;
    avgBirdWeight?: string;
  }>({});

  const clearFieldError = (key: keyof typeof fieldErrors) => {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const mapFarmValidationToFields = (errors: string[]) => {
    const next: typeof fieldErrors = {};
    for (const raw of errors) {
      const msg = translateValidationMessage(t, raw);
      const lower = raw.toLowerCase();
      if (lower.includes("farm") && lower.includes("select")) next.farm = msg;
      else if (lower.includes("bird type")) next.birdType = msg;
      else if (lower.includes("gps")) next.gps = msg;
      else if (lower.includes("farm meter") || lower.includes("starting meter")) next.destMeter = msg;
      else if (lower.includes("toll")) next.tolls = msg;
      else if (lower.includes("bird weight") || lower.includes("average bird")) next.avgBirdWeight = msg;
    }
    setFieldErrors(next);
    return next;
  };

  const notify = (msg: string, type: "success" | "error" | "warning" = "success") => {
    showNotification(msg, type);
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
      label: localizeTripViewText(farm.farmName, language),
      searchText: farm.farmName,
    }));

  const birdTypeOptions = birdTypes
    .filter((bird: any) => !bird.category || bird.category === "Bird")
    .filter((bird: any) => {
      const active = String(bird.status ?? "Active") === "Active";
      return active || bird.id === trip.birdTypeId;
    })
    .slice()
    .sort((a: any, b: any) => String(a.birdType ?? a.name ?? "").localeCompare(String(b.birdType ?? b.name ?? "")))
    .map((bird: any): DropdownOption => ({
      value: String(bird.id ?? bird.birdTypeId),
      label: localizeTripViewText(bird.birdType ?? bird.name, language),
      searchText: bird.birdType ?? bird.name,
    }));

  const fetchCurrentLocation = () => {
    setIsFetchingLocation(true);
    void captureGpsQuiet({
      preferLat: trip.farmGpsLat,
      preferLon: trip.farmGpsLon,
    }).then((gps) => {
      updateTrip({
        farmGpsLat: gps.latitude,
        farmGpsLon: gps.longitude,
        farmGpsAccuracy: gps.accuracy,
        farmGpsTime: gps.capturedAt,
      });
      clearFieldError("gps");
      // Never toast "Unable to fetch/retrieve location" — GPS always lands.
      setIsFetchingLocation(false);
    });
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
    clearFieldError("farm");
  };

  const handleBirdChange = (value: string) => {
    const id = Number(value) || 0;
    const bird = birdTypes.find((b: any) => (!b.category || b.category === "Bird") && (b.id ?? b.birdTypeId) === id);
    setTrip((prev) => ({
      ...prev,
      birdTypeId: id,
      birdType: bird ? (bird.birdType ?? bird.name ?? "") : "",
    }));
    clearFieldError("birdType");
  };

  const activeLoadIndex = Math.max(1, Number(trip.activeLegIndex ?? 1));
  const previousMeterFloor = Math.max(
    Number(trip.openingMeter ?? 0),
    ...(trip.legs ?? [])
      .filter((leg) => Number(leg.legIndex) < activeLoadIndex)
      .map((leg) => Number(leg.destMeter ?? 0)),
    ...(trip.dieselEntries ?? []).map((entry) => Number(entry.meter ?? 0))
  );

  const handleDestMeterChange = (value: string) => {
    // Locked trips are meter read-only (later approved same-vehicle fuel /
    // maintenance / trip transaction). Backend rejects direct API writes too.
    if (trip.meterLocked) return;
    const num = value === "" ? 0 : Number(value);
    updateTrip({ destMeter: num });
    const invalid = isMeterInvalid(num, previousMeterFloor) && num > 0;
    setDestMeterError(invalid ? meterMustBeGreaterThan(previousMeterFloor) : null);
    clearFieldError("destMeter");
  };

  const handleTollsChange = (value: string) => {
    if (value === "") {
      updateTrip({ pickupTolls: 0 });
      clearFieldError("tolls");
      return;
    }
    const num = Number(value);
    updateTrip({ pickupTolls: Number.isFinite(num) && num < 0 ? 0 : Number.isFinite(num) ? num : 0 });
    clearFieldError("tolls");
  };

  const handleSubmit = async () => {
    if (submitLockRef.current || isSubmitting) return;
    const validation = validateFarmStep(trip);
    if (!validation.valid) {
      const mapped = mapFarmValidationToFields(validation.errors);
      const firstFieldMsg =
        mapped.farm ||
        mapped.birdType ||
        mapped.gps ||
        mapped.destMeter ||
        mapped.tolls ||
        mapped.avgBirdWeight ||
        translateValidationMessage(t, validation.errors[0]);
      notify(firstFieldMsg, "warning");
      return;
    }
    setFieldErrors({});
    if (destMeterError) {
      setFieldErrors({ destMeter: destMeterError });
      notify(destMeterError, "warning");
      return;
    }

    const isEditMode = Boolean(trip.farmStepSubmitted);
    setConfirmation({
      isOpen: true,
      title: isEditMode ? t("ops.trip.update_farm_details") : t("ops.trip.submit_farm_details"),
      message: isEditMode
        ? t("ops.trip.confirm_update_farm")
        : t("ops.trip.confirm_submit_farm"),
      confirmLabel: isEditMode ? t("ops.trip.yes_update") : t("ops.trip.yes_create"),
      cancelLabel: t("common.cancel"),
      type: isEditMode ? "info" : "warning",
      onConfirm: () => {
        setConfirmation((prev) => ({ ...prev, isOpen: false }));
        void (async () => {
          if (submitLockRef.current || isSubmitting) return;
          submitLockRef.current = true;
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
            submitLockRef.current = false;
            setIsSubmitting(false);
          }
        })();
      },
      onCancel: () => setConfirmation((prev) => ({ ...prev, isOpen: false })),
    });
  };

  const handleSaveProgress = async () => {
    if (!saveFarmProgress || submitLockRef.current || isSubmitting) return;
    submitLockRef.current = true;
    setIsSubmitting(true);
    try {
      const success = await withMinSaveDuration(() => saveFarmProgress({}));
      if (success) notify(t("ops.trip.progress_saved"), "success");
      else notify(t("ops.trip.submission_failed"), "error");
    } finally {
      submitLockRef.current = false;
      setIsSubmitting(false);
    }
  };

  if (trip.farmStepSubmitted && !editable && !isLocalEditing) {
    const destMeterLabel =
      trip.destMeter == null || Number(trip.destMeter) === 0
        ? t("ops.trip.not_entered")
        : `${trip.destMeter} ${t("common.km")}`;
    const avgWeightLabel =
      trip.avgBirdWeight == null || Number(trip.avgBirdWeight) === 0
        ? t("ops.trip.not_entered")
        : `${Number(trip.avgBirdWeight).toFixed(2)} ${t("common.kg")}`;
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 gap-3">
          <div className="flex flex-wrap items-center gap-2.5 min-w-0">
            <h3 className="text-base sm:text-lg font-bold text-slate-800 flex items-center gap-2 tracking-tight">
              <MapPin size={18} className="text-indigo-500" />
              {t("ops.trip.title.farm")}
            </h3>
            <TripNoBadge tripNo={trip.tripNo} />
          </div>
          <div className="flex items-center gap-2 shrink-0">

            {/* Locked / view: Close X → Create New Trip (Trip Entry only) */}
            {!hideWizardClose && (
              <StepCloseButton
                onClose={() => {
                  if (onCancel) onCancel();
                  else _clearForm?.();
                }}
                animated
              />
            )}
            {canEdit && (
              <button
                type="button"
                onClick={() => setIsLocalEditing(true)}
                className="group relative bg-white hover:bg-slate-50 p-2 rounded-lg border border-slate-200 text-slate-700 transition-all active:scale-95"
                aria-label={t("ops.trip.edit_step")}
              >
                <Pencil size={14} className={uiActionIconMotionClass.edit} />
              </button>
            )}
            <span className="bg-slate-100 border border-slate-200 text-slate-700 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap">
              {t("ops.trip.submitted_locked")}
            </span>
          </div>
        </div>

        {/* Time first, then remaining fields; GPS last */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <StepKpiCard
            icon={Clock}
            tone="bg-sky-50/70 text-sky-500"
            label={t("ops.trip.field.reached_time")}
            value={trip.farmStepSubmittedAt ? formatIstStamp(trip.farmStepSubmittedAt) : trip.reachedTime || t("ops.trip.not_entered")}
          />
          <StepKpiCard
            icon={Store}
            tone="bg-emerald-50/70 text-emerald-500"
            label={t("common.farm")}
            value={localizeTripViewText(trip.sourceFarm, language) || t("ops.trip.not_entered")}
          />
          <StepKpiCard
            icon={Layers}
            tone="bg-violet-50/70 text-violet-500"
            label={t("operations.bird_type")}
            value={localizeTripViewText(trip.birdType, language) || t("ops.trip.not_entered")}
          />
          <StepKpiCard
            icon={MapPin}
            tone="bg-rose-50/70 text-rose-500"
            label={t("ops.trip.field.farm_address")}
            value={localizeTripViewText(trip.farmAddress, language) || t("ops.trip.not_entered")}
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
            value={trip.pickupTolls ?? 0}
          />
          <StepKpiCard
            icon={Scale}
            tone="bg-teal-50/70 text-teal-500"
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

        {/* GPS last on locked view — full reverse-geocoded address */}
        <div className="bg-white border border-slate-200/80 rounded-xl p-3.5 shadow-2xs">
          <span className="text-xs uppercase font-semibold text-slate-400 flex items-center gap-1.5 mb-1.5">
            <span className="h-5 w-5 rounded-md bg-cyan-50/70 text-cyan-500 flex items-center justify-center shrink-0">
              <MapPin size={12} />
            </span>
            {t("ops.trip.field.gps_address")}
          </span>
          {hasGps ? (
            <p className="text-sm font-semibold text-slate-800 break-words leading-relaxed">
              <GpsAddressText lat={trip.farmGpsLat} lon={trip.farmGpsLon} fallback={t("ops.trip.location_captured")} />
            </p>
          ) : (
            <p className="text-sm font-semibold text-slate-400">{t("ops.trip.not_captured")}</p>
          )}
        </div>

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
          <div className="flex flex-wrap items-center gap-2.5 min-w-0">
            <h3 className="text-base sm:text-lg font-bold text-slate-800 flex items-center gap-2 tracking-tight">
              <MapPin size={18} className="text-indigo-500" />
              {t("ops.trip.title.farm")}
            </h3>
            <TripNoBadge tripNo={trip.tripNo} />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* Edit mode only: animated Close X → locked submitted view */}
            {trip.farmStepSubmitted && (editable || isLocalEditing) ? (
              <StepCloseButton
                animated
                onClose={() => {
                  setIsLocalEditing(false);
                  onExitEdit?.();
                }}
              />
            ) : null}
            {(editable || isLocalEditing) && trip.farmStepSubmitted && (
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
              tone="bg-sky-50/70 text-sky-500"
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
              tone="bg-emerald-50/70 text-emerald-500"
              label={t("common.farm")}
              required={TRIP_FIELD_DEFINITIONS.sourceFarmId.required}
            />
            <SearchDropdown
              value={trip.sourceFarmId ? String(trip.sourceFarmId) : ""}
              options={farmOptions}
              placeholder={t("ops.trip.search_farm")}
              searchPlaceholder={t("ops.trip.search_farm")}
              disabled={false}
              invalid={Boolean(fieldErrors.farm)}
              onChange={handleFarmChange}
            />
            {fieldErrors.farm ? (
              <p className="mt-1.5 text-xs font-medium text-red-500 flex items-start gap-1">
                <span aria-hidden>⚠</span>
                <span>{fieldErrors.farm}</span>
              </p>
            ) : null}
          </div>

          <div className="sm:col-span-2">
            <FieldLabel icon={MapPin} tone="bg-cyan-50/70 text-cyan-500" label="GPS" required />
            <div className="flex items-center gap-2 mt-1">
              <div
                className={`flex-1 min-w-0 h-[42px] rounded-xl border bg-white px-4 text-sm font-medium text-slate-800 flex items-center ${
                  fieldErrors.gps
                    ? "border-red-500 ring-2 ring-red-400/10"
                    : "border-slate-200"
                }`}
              >
                {hasGps ? (
                  <span className="truncate">
                    <GpsAddressText lat={trip.farmGpsLat} lon={trip.farmGpsLon} fallback="ops.trip.location_captured" />
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
                className="shrink-0 h-[42px] px-4 rounded-xl bg-cyan-50/70 hover:bg-cyan-50/80 text-cyan-500 border border-cyan-100 transition-all active:scale-95 flex items-center gap-1.5 text-xs font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isFetchingLocation ? <Loader2 size={16} className="animate-spin" /> : <MapPin size={16} />}
                <span className="hidden sm:inline">{t("ops.trip.get_gps")}</span>
              </button>
            </div>
            {fieldErrors.gps ? (
              <p className="mt-1.5 text-xs font-medium text-red-500 flex items-start gap-1">
                <span aria-hidden>⚠</span>
                <span>{fieldErrors.gps}</span>
              </p>
            ) : hasGps && trip.farmGpsTime ? (
              <p className="text-[11px] text-slate-400 mt-1">{t("ops.trip.captured_at")}: {trip.farmGpsTime}</p>
            ) : (
              <p className="text-[11px] text-slate-400 mt-1">{t("ops.trip.gps_stays_empty")}</p>
            )}
          </div>

          <div>
            <FieldLabel
              icon={Layers}
              tone="bg-violet-50/70 text-violet-500"
              label={t("operations.bird_type")}
              required={TRIP_FIELD_DEFINITIONS.birdTypeId.required}
            />
            <SearchDropdown
              value={trip.birdTypeId ? String(trip.birdTypeId) : ""}
              options={birdTypeOptions}
              placeholder={t("ops.trip.search_bird_type")}
              searchPlaceholder={t("ops.trip.search_bird_type")}
              disabled={false}
              invalid={Boolean(fieldErrors.birdType)}
              onChange={handleBirdChange}
            />
            {fieldErrors.birdType ? (
              <p className="mt-1.5 text-xs font-medium text-red-500 flex items-start gap-1">
                <span aria-hidden>⚠</span>
                <span>{fieldErrors.birdType}</span>
              </p>
            ) : birdTypeOptions.length <= 1 ? (
              <p className="text-[11px] text-slate-400 mt-1">{t("ops.trip.no_active_bird_types")}</p>
            ) : null}
          </div>

          <div className="sm:col-span-1">
            <FieldLabel
              icon={MapPin}
              tone="bg-rose-50/70 text-rose-500"
              label={t("ops.trip.field.farm_address")}
              required={TRIP_FIELD_DEFINITIONS.farmAddress.required}
            />
            <input
              type="text"
              value={farmAddress}
              onChange={(e) => updateTrip({ farmAddress: e.target.value })}
              className="w-full mt-1 h-[42px] rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-400/10 outline-none transition-all placeholder:text-slate-400"
              placeholder={t("ops.trip.farm_address_placeholder")}
            />
          </div>

          <div>
            <FieldLabel
              icon={Gauge}
              tone="bg-purple-50/70 text-purple-500"
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
                destMeterError || fieldErrors.destMeter
                  ? "border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-400/10"
                  : "border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-400/10"
              } bg-white px-4 text-sm font-medium text-slate-800 outline-none transition-all placeholder:text-slate-400`}
              placeholder="0.00"
            />
            {trip.meterLocked ? (
              <div className="mb-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                <div className="font-semibold">{t("ops.trip.locked_trip_modify")}</div>
                <div>{t("ops.trip.meter_locked_trip", { ref: trip.meterLockReason?.ref ?? "—" })}</div>
              </div>
            ) : null}
            {destMeterError || fieldErrors.destMeter ? (
              <div className="mt-1 rounded-lg border border-red-100 bg-red-50/70 px-3 py-2 text-[11px] font-semibold text-red-500">
                {destMeterError || fieldErrors.destMeter}
              </div>
            ) : (
              <p className="text-[11px] text-slate-400 mt-1">
                {activeLoadIndex > 1 ? t("ops.trip.last_entered_meter") : t("ops.trip.start_meter")}:{" "}
                <span className="font-semibold text-slate-600">
                  {previousMeterFloor || t("ops.trip.not_entered")} {t("common.km")}
                </span>
              </p>
            )}
          </div>

          <div>
            <FieldLabel
              icon={Ticket}
              tone="bg-amber-50/70 text-amber-500"
              label={t("ops.trip.field.pickup_tolls")}
            />
            <input
              type="number"
              inputMode="numeric"
              min="0"
              value={trip.pickupTolls ?? 0}
              onChange={(e) => handleTollsChange(e.target.value)}
              onWheel={(e) => e.currentTarget.blur()}
              className={`hide-spinner w-full mt-1 h-[42px] rounded-xl border ${
                fieldErrors.tolls
                  ? "border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-400/10"
                  : "border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-400/10"
              } bg-white px-4 text-sm font-medium text-slate-800 outline-none transition-all placeholder:text-slate-400`}
              placeholder="0"
            />
            {fieldErrors.tolls ? (
              <p className="mt-1.5 text-xs font-medium text-red-500 flex items-start gap-1">
                <span aria-hidden>⚠</span>
                <span>{fieldErrors.tolls}</span>
              </p>
            ) : (
              <p className="text-[11px] text-slate-400 mt-1">{t("ops.trip.tolls_hint")}</p>
            )}
          </div>

          <div>
            <FieldLabel
              icon={Scale}
              tone="bg-teal-50/70 text-teal-500"
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
                clearFieldError("avgBirdWeight");
              }}
              onWheel={(e) => e.currentTarget.blur()}
              className={`hide-spinner w-full mt-1 h-[42px] rounded-xl border ${
                fieldErrors.avgBirdWeight
                  ? "border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-400/10"
                  : "border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-400/10"
              } bg-white px-4 text-sm font-medium text-slate-800 outline-none transition-all placeholder:text-slate-400`}
              placeholder="e.g., 1.5"
            />
            {fieldErrors.avgBirdWeight ? (
              <p className="mt-1.5 text-xs font-medium text-red-500 flex items-start gap-1">
                <span aria-hidden>⚠</span>
                <span>{fieldErrors.avgBirdWeight}</span>
              </p>
            ) : null}
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
              className="w-full mt-1 h-[42px] rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-400/10 outline-none transition-all placeholder:text-slate-400"
              placeholder={t("ops.trip.optional")}
            />
          </div>
        </div>

        <WizardActionBar
          dirty={hasUnsavedChanges}
          onCancel={() => {
            // Cancel → leave wizard entirely (Create New Trip).
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

      <TripStepConfirmDialog
        isOpen={confirmation.isOpen}
        title={confirmation.title}
        message={confirmation.message}
        confirmLabel={confirmation.confirmLabel}
        cancelLabel={confirmation.cancelLabel}
        type={confirmation.type}
        onConfirm={confirmation.onConfirm}
        onCancel={confirmation.onCancel || (() => setConfirmation((prev) => ({ ...prev, isOpen: false })))}
      />
    </>
  );
}
