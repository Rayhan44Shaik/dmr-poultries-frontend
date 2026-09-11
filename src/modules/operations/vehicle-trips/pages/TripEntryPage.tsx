// src/modules/operations/vehicle-trips/pages/TripEntryPage.tsx

import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { FileText, Plus } from "lucide-react";

// --- Components ---
import TripRecentTable from "../components/TripRecentTable";
import TripViewModal from "../components/TripViewModal";
import TripWizardStepper from "../components/TripWizardStepper";
import { WizardStepNotice } from "../components/WizardStepUI";
import { TripNoBadge } from "../components/TripNoBadge";
import StepStart from "../components/StepStart";
import StepDeliveries from "../components/StepDeliveries";
import StepFarm from "../components/StepFarm";
import StepPickup from "../components/StepPickup";
import StepEnd from "../components/Step_5/StepEnd";
import TripFinalKPI from "../components/TripFinalKPI";

// --- Hooks ---
import { useTripEntry } from "../hooks/useTripEntry";
import useTrips from "../hooks/useTrips";
import { fetchAvailableResources, loadTripById } from "../services/tripHeaderApiService";
import { useFarms } from "../../../masters/farms/hooks/useFarms";
import { useShops } from "../../../masters/shops/hooks/useShops";
import { useBirdTypes } from "../../../masters/bird-types/hooks/useBirdTypes";
import { useSafeNotification } from "../../../../hooks/useSafeNotification";
import { useI18n } from "../../../../i18n";

// --- Utils ---
import { canEditItem } from "../../../../utils/dateUtils";
import {
  clampTripStepIndex,
  getLastSubmittedTripStep,
  getNextIncompleteTripStep,
  getTripStepLockMask,
  getTripWizardCompletedMask,
  isTripEnded as hasTripEnded,
  isTripWizardComplete,
  TRIP_STEP_LABELS,
  type Trip,
  type ShopDelivery,
  type TripStatus,
} from "../../../../shared/trip";

type TripEntryPageProps = { embedded?: boolean; };

/**
 * Default operational date for a NEW trip: the current LOCAL calendar day.
 *
 * Trip Entry, the Orders module (`localToday()`), and the server
 * (`CURRENT_DATE`) must agree on "today" — otherwise a freshly-created trip
 * lands on a different operational day than the Orders collection/assignment
 * for the same session, and the Orders ↔ Trip Entry flow cannot connect.
 * Uses local date components (never `toISOString()`, which is UTC and rolls
 * a day early for zones ahead of UTC).
 */
const getTripEntryDate = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
};

type EntryScreen = "prompt" | "form";

function TripEntryPage({ embedded = false }: TripEntryPageProps) {
  const { t } = useI18n();
  const location = useLocation();
  const navigate = useNavigate();
  const { farms } = useFarms();
  const { shops } = useShops();
  const { birdTypes } = useBirdTypes();

  const { showNotification } = useSafeNotification();
  const { allTrips, refreshTrips, deleteTrip, changeStatus } = useTrips(showNotification, {
    includeDeleted: true,
  });

  const {
    trip,
    savedTrip,
    setTrip,
    isEditing,
    setIsEditing,
    endStepSubmitted,
    headerLoading,
    subscribeHeaderSaveStatus,
    getHeaderSaveStatus,
    updateTrip,
    updateDeliveries,
    updateBoxDetails,
    submitStartStep,
    updateStartStep,
    submitFarmStep,
    saveFarmProgress,
    submitPickupStep,
    savePickupProgress,
    submitDeliveriesStep,
    saveDeliveriesProgress,
    submitEndTrip,
    saveEndProgress,
    loadTripFromApi,
    clearTrip,
    updateStartTrip,
    registerStep1SuccessCallback,
    registerStep2SuccessCallback,
    registerStep3SuccessCallback,
    registerStep4SuccessCallback,
    registerTripIdCallback,
  } = useTripEntry(showNotification, refreshTrips);

  const [rows, setRows] = useState<ShopDelivery[]>([]);
  const [viewTrip, setViewTrip] = useState<Trip | null>(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [viewStepIndex, setViewStepIndex] = useState(0);

  const [entryScreen, setEntryScreen] = useState<EntryScreen>("prompt");
  const [editingSubmittedStep, setEditingSubmittedStep] = useState<number | null>(null);
  /** Bumped by "Cancel" (discard changes) to force the open step to remount
   *  and re-hydrate every field from the last saved trip state. */
  const [stepRemountNonce, setStepRemountNonce] = useState(0);

  /** Trip id whose URL resume must be suppressed for one close cycle.
   *
   *  Closing the wizard (`clearForm` / `createNewTrip`) resets `trip.id` to 0
   *  immediately, but the router transition that removes `tripId` from the URL
   *  (react-router wraps `navigate` in `startTransition`) lands a beat later.
   *  In that window the URL-resume effect below would see a stale `tripId`
   *  together with `trip.id === 0` and re-open the trip we just closed — the
   *  "closes for a fraction, then comes back to the same step" bug. */
  const suppressUrlResumeRef = useRef<number | null>(null);

  /** Set tripId in URL so refresh can resume the active wizard. */
  const setTripIdInUrl = useCallback((tripId: number) => {
    const params = new URLSearchParams(location.search);
    params.set("tab", "trip-entry");
    params.set("tripId", String(tripId));
    navigate(`/operations?${params.toString()}`, { replace: true });
  }, [location.search, navigate]);

  /** Clear tripId from URL when explicitly creating a new blank trip. */
  const clearTripIdFromUrl = useCallback(() => {
    const params = new URLSearchParams(location.search);
    if (!params.has("tripId")) return;
    params.set("tab", "trip-entry");
    params.delete("tripId");
    navigate(`/operations?${params.toString()}`, { replace: true });
  }, [location.search, navigate]);

  /** Register callback to sync tripId to URL when a trip is created/saved. */
  useEffect(() => {
    registerTripIdCallback(setTripIdInUrl);
  }, [registerTripIdCallback, setTripIdInUrl]);

  /**
   * On mount / refresh: if a tripId is in the URL, load that trip AND reopen the
   * wizard on it (so a browser refresh mid-wizard resumes exactly where the user
   * was — required for Part K Step 5 draft restoration, and for resume-by-URL).
   */
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const urlTripId = params.get("tripId");
    const id = urlTripId ? Number(urlTripId) : null;
    if (id != null && Number.isFinite(id) && id > 0 && !trip.id) {
      if (suppressUrlResumeRef.current === id) {
        // The app just closed this trip and the router transition that removes
        // `tripId` from the URL is still in flight — do NOT re-open it.
        return;
      }
      void loadTripFromApi(id).then((loaded) => {
        if (!loaded) return;
        setRows(loaded.deliveries || []);
        setEntryScreen("form");
        setEditingSubmittedStep(null);
        setViewStepIndex(getNextIncompleteTripStep(loaded));
      });
    }
    if (!urlTripId) {
      // URL no longer points at a trip — the close transition completed.
      suppressUrlResumeRef.current = null;
    }
  }, [location.search, loadTripFromApi, trip.id]);

  const handleStatusChange = (trip: Trip, status: TripStatus) => {
    changeStatus(trip, status);
  };

  /** Bilingual, human-readable name for a step index (never a raw i18n key). */
  const stepDisplayName = useCallback(
    (index: number) => {
      const key = `ops.trip.step${index + 1}_label`;
      const translated = t(key);
      if (translated !== key) return translated;
      return TRIP_STEP_LABELS[index] ?? t("ops.trip.step_label", { step: index + 1 });
    },
    [t]
  );

  const handleView = (selectedTrip: Trip) => {
    setViewTrip(selectedTrip);
    setViewOpen(true);
    void loadTripById(selectedTrip.id)
      .then((loaded) => setViewTrip(loaded))
      .catch(() => {
        showNotification(t("ops.trip.refresh_failed_using_cached"), "info");
      });
  };

  const openExistingTrip = async (
    selectedTrip: Trip,
    targetStep: number,
    message: string,
    editSubmittedStep: number | null
  ) => {
    setEntryScreen("form");
    setIsEditing(true);
    setEditingSubmittedStep(editSubmittedStep);
    showNotification(message, "success");

    // The backend is the source of truth for step completion. Load the full
    // trip from the API and derive the step to open from THAT state, never
    // from a possibly stale Recent Trips row or the URL.
    const loaded = await loadTripFromApi(selectedTrip.id);
    const authoritative = loaded ?? selectedTrip;
    setRows(authoritative.deliveries || []);

    let resolvedStep = targetStep;
    if (editSubmittedStep == null) {
      // Resume: reopen at the first incomplete step per authoritative state.
      resolvedStep = getNextIncompleteTripStep(authoritative);
    }
    // Authoritative per-step gating: a locked target falls back to the first
    // incomplete step (never "trip exists = every step open").
    setViewStepIndex(clampTripStepIndex(authoritative, resolvedStep));
  };

  const handleResume = (selectedTrip: Trip) => {
    if (selectedTrip.deleted || selectedTrip.status !== "Draft" || isTripWizardComplete(selectedTrip)) {
      return;
    }
    const targetStep = getNextIncompleteTripStep(selectedTrip);
    const resumeLabel = `${t("ops.trip.step_label", { step: targetStep + 1 })}: ${stepDisplayName(targetStep)}`;
    void openExistingTrip(
      selectedTrip,
      targetStep,
      t("ops.trip.resuming", { no: selectedTrip.tripNo, label: resumeLabel }),
      null
    );
  };

  const handleEdit = (selectedTrip: Trip) => {
    const targetStep = getLastSubmittedTripStep(selectedTrip);
    if (targetStep == null) return;
    void openExistingTrip(
      selectedTrip,
      targetStep,
      t("ops.trip.edit_mode", {
        no: selectedTrip.tripNo,
        step: targetStep + 1,
        name: stepDisplayName(targetStep),
      }),
      targetStep
    );
  };

  const handleRefresh = async () => {
    await refreshTrips();
    showNotification(t("ops.trip.table_refreshed"), "success");
  };

  const isInitialMount = useRef(true);

  useEffect(() => {
    if (isInitialMount.current) {
      if (!trip.tripDate) {
        const initialDate = getTripEntryDate();
        setTrip((prev) => ({ ...prev, tripDate: initialDate }));
      }
      isInitialMount.current = false;
    }
  }, []);

  useEffect(() => {
    if (!isEditing && !trip.startStepSubmitted) return;
    if (!trip.deliveries) return;
    setRows(trip.deliveries);
  }, [trip.deliveries, isEditing, trip.startStepSubmitted]);

  useEffect(() => {
    refreshTrips();
  }, [
    trip.id,
    trip.tripNo,
    trip.status,
    trip.startStepSubmitted,
    trip.farmStepSubmitted,
    trip.pickupStepSubmitted,
    trip.deliveryStepSubmitted,
    trip.endStepSubmitted,
    refreshTrips,
  ]);

  const clearForm = useCallback(() => {
    const urlTripId = Number(new URLSearchParams(location.search).get("tripId"));
    if (Number.isFinite(urlTripId) && urlTripId > 0) {
      suppressUrlResumeRef.current = urlTripId;
    }
    clearTrip();
    setRows([]);
    setEntryScreen("prompt");
    setViewStepIndex(0);
    setIsEditing(false);
    setEditingSubmittedStep(null);
    setTrip((prev) => ({ ...prev, tripDate: getTripEntryDate() }));
    clearTripIdFromUrl();
  }, [clearTrip, clearTripIdFromUrl, setIsEditing, setTrip, location.search]);

  // After ANY step submit: close the wizard and show "Create New Trip".
  // Resume the same trip from Recent Trip Activity when the next step is needed.
  // Success toast is emitted centrally in useTripEntry.
  useEffect(() => {
    registerStep1SuccessCallback(() => {
      clearForm();
    });
  }, [registerStep1SuccessCallback, clearForm]);

  useEffect(() => {
    registerStep2SuccessCallback(() => {
      clearForm();
    });
  }, [registerStep2SuccessCallback, clearForm]);

  useEffect(() => {
    registerStep3SuccessCallback(() => {
      clearForm();
    });
  }, [registerStep3SuccessCallback, clearForm]);

  useEffect(() => {
    registerStep4SuccessCallback(() => {
      clearForm();
    });
  }, [registerStep4SuccessCallback, clearForm]);

  /**
   * Bottom "Cancel" on any step = DISCARD unsaved local edits only.
   *
   *  - A brand-new trip that was never created has nothing persisted → close
   *    the editor back to the landing screen (handled by each step calling
   *    `clearForm` while its own step is not submitted).
   *  - Otherwise revert the working copy to the last server-confirmed state
   *    (`savedTrip`, updated by every successful Save Progress / Submit) and
   *    force the step to remount so any component-local form mirror
   *    (StepStart's `form`, box tables, delivery rows…) re-hydrates from it.
   *
   * It NEVER deletes the trip or a step, and NEVER touches submitted flags or
   * status — a successful Save survives Cancel + reopen (CASE B / D).
   */
  const discardStepChanges = useCallback(() => {
    if (!trip.id) {
      clearForm();
      return;
    }
    setTrip(savedTrip);
    setRows(savedTrip.deliveries || []);
    setEditingSubmittedStep(null);
    setStepRemountNonce((n) => n + 1);
  }, [trip.id, savedTrip, setTrip, clearForm]);

  const createNewTrip = useCallback(() => {
    const urlTripId = Number(new URLSearchParams(location.search).get("tripId"));
    if (Number.isFinite(urlTripId) && urlTripId > 0) {
      suppressUrlResumeRef.current = urlTripId;
    }
    clearTrip();
    setRows([]);
    setViewStepIndex(0);
    setTrip((prev) => ({ ...prev, tripDate: getTripEntryDate() }));
    clearTripIdFromUrl();
    setIsEditing(true);
    setEditingSubmittedStep(null);
    setEntryScreen("form");
  }, [clearTrip, clearTripIdFromUrl, setIsEditing, setTrip, location.search]);

  const isStartCompleted = Boolean(trip.startStepSubmitted);
  const isFarmCompleted = Boolean(trip.farmStepSubmitted);
  const isPickupCompleted = Boolean(trip.pickupStepSubmitted);
  const isDeliveryCompleted = Boolean(trip.deliveryStepSubmitted);
  const isTripEnded = hasTripEnded(trip) || endStepSubmitted;

  const canEditTrip = trip.createdAt ? canEditItem(trip.createdAt) : true;

  // Shared Desktop + Mobile workflow definition.
  const currentStep = getNextIncompleteTripStep(trip);
  // Step-enablement dependency model: each step opens only when its predecessor
  // is SUBMITTED (Step 5 opens after Step 1 so expenses can be entered mid-trip;
  // its final submit stays gated on Steps 1–4). Opening != submitting — per-step
  // submit validation and order gating are enforced on submit (frontend + backend).
  const lockedSteps = getTripStepLockMask(trip);
  // Render-safe view index — the UI must never trust a requested index that
  // bypasses the sequence (direct state/URL manipulation included).
  const effectiveViewStepIndex = clampTripStepIndex(trip, viewStepIndex);

  const [vehicleOpts, setVehicleOpts] = useState<Array<{ id: number; vehicleNumber: string }>>([]);
  const [employeeOpts, setEmployeeOpts] = useState<Array<{ id: number; employeeName: string; department: string }>>([]);

  useEffect(() => {
    let cancelled = false;
    const tripId = trip.id > 0 ? trip.id : undefined;
    void fetchAvailableResources(tripId)
      .then((available) => {
        if (cancelled) return;
        setVehicleOpts(available.vehicles ?? []);
        setEmployeeOpts([
          ...(available.drivers ?? []),
          ...(available.supervisors ?? []),
          ...(available.helpers ?? []),
          ...(available.loaders ?? []),
        ]);
      })
      .catch(() => {
        if (!cancelled) {
          setVehicleOpts([]);
          setEmployeeOpts([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [trip.id, trip.startStepSubmitted, entryScreen]);

  const step1LoadSnapshot = useMemo(
    () => trip,
    [
      trip.id,
      trip.startTime,
      trip.startStepSubmitted,
      trip.vehicleId,
      trip.vehicleNo,
      trip.driverId,
      trip.driverName,
      trip.supervisorId,
      trip.supervisorName,
      trip.helpers,
      trip.loaders,
      trip.openingMeter,
      trip.advanceAmount,
    ]
  );

  // Clamp any requested step to the highest step that is legitimately
  // available. This runs regardless of how the step was requested (click,
  // programmatic navigation, state restoration) and never relies on the
  // frontend-only flag being "next".
  // No reconciling effect is needed: `effectiveViewStepIndex` re-derives a
  // safe, unlocked index from authoritative trip state on every render, so a
  // stale/locked `viewStepIndex` can never reach the rendered wizard.

  const isNewTrip = trip.id === 0 || !trip.tripNo;

  const isEditable = (stepCompleted: boolean) => {
    if (trip.status === "Completed") return false;
    if (editingSubmittedStep === effectiveViewStepIndex && isEditing) {
      return canEditTrip || trip.status === "Draft" || trip.status === "Pending";
    }
    if (effectiveViewStepIndex === 4) {
      return isEditing && (canEditTrip || trip.status === "Draft" || trip.status === "Pending");
    }
    const isViewingActiveStep = !isTripEnded && effectiveViewStepIndex === currentStep;
    if (isViewingActiveStep && !stepCompleted) {
      return isNewTrip || isEditing || trip.status === "Draft";
    }
    return false;
  };

  const renderSelectedStep = () => {
    if (effectiveViewStepIndex === 0) {
      return (
        <StepStart
          key={`step0-${stepRemountNonce}`}
          tripId={trip.id}
          tripNo={trip.tripNo}
          startTime={trip.startTime}
          startStepSubmitted={trip.startStepSubmitted}
          loadSnapshot={step1LoadSnapshot}
          updateTrip={updateStartTrip}
          submitStartStep={submitStartStep}
          updateStartStep={updateStartStep}
          hasUnsavedChanges={JSON.stringify({
            vehicleId: trip.vehicleId, vehicleNo: trip.vehicleNo, driverId: trip.driverId,
            driverName: trip.driverName, supervisorId: trip.supervisorId,
            supervisorName: trip.supervisorName, helpers: trip.helpers, loaders: trip.loaders,
            openingMeter: trip.openingMeter, advanceAmount: trip.advanceAmount,
          }) !== JSON.stringify({
            vehicleId: savedTrip.vehicleId, vehicleNo: savedTrip.vehicleNo, driverId: savedTrip.driverId,
            driverName: savedTrip.driverName, supervisorId: savedTrip.supervisorId,
            supervisorName: savedTrip.supervisorName, helpers: savedTrip.helpers, loaders: savedTrip.loaders,
            openingMeter: savedTrip.openingMeter, advanceAmount: savedTrip.advanceAmount,
          })}
          vehicleOptions={vehicleOpts}
          employeeOptions={employeeOpts}
          editable={isEditable(isStartCompleted)}
          canEdit={canEditTrip}
          onCancel={discardStepChanges}
          clearForm={clearForm}
          headerLoading={headerLoading}
          subscribeHeaderSaveStatus={subscribeHeaderSaveStatus}
          getHeaderSaveStatus={getHeaderSaveStatus}
        />
      );
    }

    if (effectiveViewStepIndex === 1) {
      return (
        <StepFarm
          key={`step1-${stepRemountNonce}`}
          trip={trip}
          setTrip={setTrip}
          updateTrip={updateTrip}
          submitFarmStep={submitFarmStep}
          saveFarmProgress={saveFarmProgress}
          hasUnsavedChanges={JSON.stringify({
            sourceFarmId: trip.sourceFarmId, sourceFarm: trip.sourceFarm, farmAddress: trip.farmAddress,
            destMeter: trip.destMeter, pickupTolls: trip.pickupTolls, avgBirdWeight: trip.avgBirdWeight,
            remarks: trip.remarks, farmGpsLat: trip.farmGpsLat, farmGpsLon: trip.farmGpsLon,
            farmGpsAccuracy: trip.farmGpsAccuracy, farmGpsTime: trip.farmGpsTime,
            birdTypeId: trip.birdTypeId, birdType: trip.birdType,
          }) !== JSON.stringify({
            sourceFarmId: savedTrip.sourceFarmId, sourceFarm: savedTrip.sourceFarm, farmAddress: savedTrip.farmAddress,
            destMeter: savedTrip.destMeter, pickupTolls: savedTrip.pickupTolls, avgBirdWeight: savedTrip.avgBirdWeight,
            remarks: savedTrip.remarks, farmGpsLat: savedTrip.farmGpsLat, farmGpsLon: savedTrip.farmGpsLon,
            farmGpsAccuracy: savedTrip.farmGpsAccuracy, farmGpsTime: savedTrip.farmGpsTime,
            birdTypeId: savedTrip.birdTypeId, birdType: savedTrip.birdType,
          })}
          farms={farms}
          birdTypes={birdTypes}
          editable={isEditable(isFarmCompleted)}
          canEdit={canEditTrip}
          onCancel={discardStepChanges}
          clearForm={clearForm}
        />
      );
    }

    if (effectiveViewStepIndex === 2) {
      return (
        <StepPickup
          key={`step2-${stepRemountNonce}`}
          trip={trip}
          setTrip={setTrip}
          updateTrip={updateTrip}
          submitPickupStep={submitPickupStep}
          savePickupProgress={savePickupProgress}
          updateBoxDetails={updateBoxDetails}
          editable={isEditable(isPickupCompleted)}
          canEdit={canEditTrip}
          onCancel={discardStepChanges}
          clearForm={clearForm}
        />
      );
    }

    if (effectiveViewStepIndex === 3) {
      return (
        <StepDeliveries
          key={`step3-${stepRemountNonce}`}
          rows={rows}
          setRows={setRows}
          shops={shops}
          birdTypes={birdTypes}
          trip={trip}
          updateDeliveries={updateDeliveries}
          submitDeliveriesStep={submitDeliveriesStep}
          saveDeliveriesProgress={saveDeliveriesProgress}
          boxDetails={trip.boxDetails || []}
          readOnly={!isEditable(isDeliveryCompleted)}
          editable={isEditable(isDeliveryCompleted)}
          canEdit={canEditTrip}
          onCancel={discardStepChanges}
          clearForm={clearForm}
          persistedDeliveries={savedTrip.deliveries || []}
        />
      );
    }

    if (effectiveViewStepIndex === 4) {
      return (
        <StepEnd
          key={`step4-${stepRemountNonce}`}
          trip={trip}
          setTrip={setTrip}
          updateTrip={updateTrip}
          editable={isEditable(isTripEnded)}
          canEdit={canEditTrip}
          onCancel={discardStepChanges}
          clearForm={clearForm}
          submitExpensesStep={submitEndTrip}
          saveEndProgress={saveEndProgress}
        />
      );
    }

    return (
      <div className="mt-8 text-center p-12 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 text-sm">
        👈 {t("ops.trip.select_step_hint")}
      </div>
    );
  };

  const content = (
    <div className="space-y-6">
      <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200/80 shadow-xl shadow-slate-100/70 space-y-6">
        {entryScreen === "prompt" ? (
          <div className="flex flex-col items-center justify-center text-center py-16 space-y-6">
            <div className="h-20 w-20 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 shadow-inner">
              <FileText size={36} />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-slate-800 tracking-tight">{t("ops.trip.trip_entry_title")}</h2>
              <p className="text-slate-500 max-w-md mx-auto">
                {t("ops.trip.no_active_trip")}
              </p>
            </div>
            <button
              onClick={createNewTrip}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 px-8 py-3 text-sm font-bold text-white shadow-md shadow-blue-200 transition-all active:scale-95"
            >
              <Plus size={18} />
              {t("ops.trip.create_new_trip")}
            </button>
          </div>
        ) : (
          <>
            {/* Always-visible trip identity while wizard is open */}
            {trip.tripNo ? (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-indigo-100 bg-indigo-50/60 px-3 py-2">
                <div className="flex flex-wrap items-center gap-2 min-w-0">
                  <TripNoBadge tripNo={trip.tripNo} />
                  {trip.vehicleNo ? (
                    <span className="text-[11px] font-semibold text-slate-600 tabular-nums">
                      {t("operations.vehicle_no")}: {trip.vehicleNo}
                    </span>
                  ) : null}
                  {trip.tripDate ? (
                    <span className="text-[11px] font-medium text-slate-500">{trip.tripDate}</span>
                  ) : null}
                </div>
                {trip.status ? (
                  <span className="text-[10px] font-bold uppercase tracking-wide text-indigo-700/80 bg-white/80 border border-indigo-100 rounded-full px-2 py-0.5">
                    {trip.status}
                  </span>
                ) : null}
              </div>
            ) : null}
            <TripWizardStepper
              steps={TRIP_STEP_LABELS}
              currentStep={isTripEnded ? 4 : effectiveViewStepIndex}
              completedMask={getTripWizardCompletedMask(trip)}
              lockedSteps={lockedSteps}
              onStepClick={(idx) => {
                setViewStepIndex(idx);
              }}
              onLockedStepClick={(idx) => {
                // A future step is locked until the previous step is actually
                // submitted (backend state). Redirect to the correct next step.
                setViewStepIndex(currentStep);
                showNotification(
                  t("ops.trip.step_locked", { locked: idx + 1, current: currentStep + 1, name: stepDisplayName(currentStep) }),
                  "info"
                );
              }}
            />

            {editingSubmittedStep != null && editingSubmittedStep === effectiveViewStepIndex && (
              <WizardStepNotice
                notice={{
                  type: "info",
                  message: t("ops.trip.edit_mode_notice", {
                    no: trip.tripNo,
                    step: editingSubmittedStep + 1,
                    name: stepDisplayName(editingSubmittedStep),
                  }),
                }}
              />
            )}

            <div className="mt-6">{renderSelectedStep()}</div>
            {<TripFinalKPI trip={savedTrip} deliveries={savedTrip.deliveries || []} />}
          </>
        )}
      </div>

      <TripRecentTable
        trips={allTrips}
        onRefresh={handleRefresh}
        onView={handleView}
        onEdit={handleEdit}
        onResume={handleResume}
        onDelete={(trip, reason) => deleteTrip(trip.id, reason)}
        onStatusChange={handleStatusChange}
      />

      <TripViewModal
        key={viewTrip?.id ?? "closed"}
        trip={viewTrip}
        open={viewOpen}
        onClose={() => {
          setViewOpen(false);
          setViewTrip(null);
        }}
        shops={shops}
        birdTypes={birdTypes}
      />
    </div>
  );

  if (embedded) return content;
  return <div className="px-4 md:px-8 py-8 max-w-7xl mx-auto bg-slate-50/50 min-h-screen">{content}</div>;
}

export default React.memo(TripEntryPage);
