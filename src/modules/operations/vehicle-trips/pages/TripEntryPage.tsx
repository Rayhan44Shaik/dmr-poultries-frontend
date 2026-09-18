// src/modules/operations/vehicle-trips/pages/TripEntryPage.tsx

import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { FileText, Plus } from "lucide-react";

// --- Components ---
import TripRecentTable from "../components/TripRecentTable";
import { RecentTripViewModal } from "../components/TripViewModal";
import TripWizardStepper from "../components/TripWizardStepper";
import { WizardStepNotice } from "../components/WizardStepUI";
import StepStart from "../components/StepStart";
import StepDeliveries from "../components/StepDeliveries";
import StepFarm from "../components/StepFarm";
import StepPickup from "../components/StepPickup";
import StepEnd from "../components/Step_5/StepEnd";

// --- Hooks ---
import { useTripEntry } from "../hooks/useTripEntry";
import useTrips from "../hooks/useTrips";
import { fetchAvailableResources, loadTripById } from "../services/tripHeaderApiService";
import { useFarms } from "../../../masters/farms/hooks/useFarms";
import { useShops } from "../../../masters/shops/hooks/useShops";
import { useBirdTypes } from "../../../masters/bird-types/hooks/useBirdTypes";
import { useSafeNotification } from "../../../../hooks/useSafeNotification";
import { useI18n } from "../../../../i18n";
import { CAPABILITIES, useCan } from "../../../auth/permissions";

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
  const localizedStepLabels = useMemo(
    () => [
      t("ops.trip.step.start"),
      t("ops.trip.step.farm"),
      t("ops.trip.step.pickup"),
      t("ops.trip.step.deliveries"),
      t("ops.trip.step.expenses"),
    ],
    [t],
  );
  const location = useLocation();
  const navigate = useNavigate();
  const { farms } = useFarms();
  const { shops } = useShops();
  const { birdTypes } = useBirdTypes();

  const { showNotification } = useSafeNotification();
  const can = useCan();
  const { allTrips, isLoading: tripsLoading, refreshTrips, deleteTrip, changeStatus } = useTrips(showNotification, {
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
  const viewLoadSeqRef = useRef(0);
  const openExistingTripBusyRef = useRef(false);
  const resourceLoadSeqRef = useRef(0);

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

  const handleStatusChange = async (trip: Trip, status: TripStatus, approvedBy?: string) => {
    // Pending tab may list wizard-done trips still marked Draft in storage —
    // promote Draft→Pending first, then Pending→Completed so the API accepts it.
    if (
      status === "Completed" &&
      trip.status === "Draft" &&
      (trip.endStepSubmitted || trip.expensesStepSubmitted)
    ) {
      await changeStatus(trip, "Pending");
      await changeStatus({ ...trip, status: "Pending" }, "Completed", approvedBy);
      return;
    }
    await changeStatus(trip, status, approvedBy);
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
    const requestSeq = viewLoadSeqRef.current + 1;
    viewLoadSeqRef.current = requestSeq;
    setViewTrip(selectedTrip);
    setViewOpen(true);
    void loadTripById(selectedTrip.id)
      .then((loaded) => {
        if (requestSeq === viewLoadSeqRef.current) setViewTrip(loaded);
      })
      .catch(() => {
        if (requestSeq === viewLoadSeqRef.current) {
          showNotification(t("ops.trip.refresh_failed_using_cached"), "info");
        }
      });
  };

  const openExistingTrip = async (
    selectedTrip: Trip,
    targetStep: number,
    message: string,
    editSubmittedStep: number | null
  ) => {
    if (openExistingTripBusyRef.current) return;
    openExistingTripBusyRef.current = true;
    try {
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
    } finally {
      openExistingTripBusyRef.current = false;
    }
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
    const ok = await refreshTrips();
    if (ok) showNotification(t("ops.trip.table_refreshed"), "success");
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
  }, [setTrip, trip.tripDate]);

  useEffect(() => {
    if (!isEditing && !trip.startStepSubmitted) return;
    if (!trip.deliveries) return;
    let cancelled = false;
    const deliveries = trip.deliveries;
    queueMicrotask(() => {
      if (!cancelled) setRows(deliveries);
    });
    return () => {
      cancelled = true;
    };
  }, [trip.deliveries, isEditing, trip.startStepSubmitted]);

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
   * Common edit navigation (all steps 1–5):
   *
   *  Close (X / exit edit) → discard unsaved edits and return to the locked
   *    submitted view for the current step (stay in the trip wizard).
   *  Cancel (bottom bar) → leave the wizard entirely and show Create New Trip.
   *
   * Never deletes the trip or clears submitted flags/status.
   */
  const exitEditToLocked = useCallback(() => {
    if (!trip.id) {
      clearForm();
      return;
    }
    setTrip(savedTrip);
    setRows(savedTrip.deliveries || []);
    setEditingSubmittedStep(null);
    setStepRemountNonce((n) => n + 1);
  }, [trip.id, savedTrip, setTrip, clearForm]);

  /** Bottom Cancel — close the whole entry and show Create New Trip. */
  const cancelToLanding = useCallback(() => {
    clearForm();
  }, [clearForm]);

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
    if (entryScreen !== "form") return;
    let cancelled = false;
    const requestSeq = resourceLoadSeqRef.current + 1;
    resourceLoadSeqRef.current = requestSeq;
    const tripId = trip.id > 0 ? trip.id : undefined;
    void fetchAvailableResources(tripId)
      .then((available) => {
        if (cancelled || requestSeq !== resourceLoadSeqRef.current) return;
        setVehicleOpts(available.vehicles ?? []);
        setEmployeeOpts([
          ...(available.drivers ?? []),
          ...(available.supervisors ?? []),
          ...(available.helpers ?? []),
          ...(available.loaders ?? []),
        ]);
      })
      .catch(() => {
        if (!cancelled && requestSeq === resourceLoadSeqRef.current) {
          setVehicleOpts([]);
          setEmployeeOpts([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [trip.id, entryScreen]);

  const step1LoadSnapshot = useMemo(() => trip, [trip]);

  // Clamp any requested step to the highest step that is legitimately
  // available. This runs regardless of how the step was requested (click,
  // programmatic navigation, state restoration) and never relies on the
  // frontend-only flag being "next".
  // No reconciling effect is needed: `effectiveViewStepIndex` re-derives a
  // safe, unlocked index from authoritative trip state on every render, so a
  // stale/locked `viewStepIndex` can never reach the rendered wizard.

  const isNewTrip = trip.id === 0 || !trip.tripNo;

  /**
   * Common editability for steps 1–5:
   *  - Completed trips: never editable here
   *  - Explicit edit of a submitted step (pencil / Recent Edit): that step opens editable
   *  - Draft resume on the next incomplete step: editable
   *  - Step 5 while Draft/Pending and editing: editable (same as other steps)
   */
  const isEditable = (stepCompleted: boolean) => {
    if (trip.status === "Completed") return false;
    const mayEdit = canEditTrip || trip.status === "Draft" || trip.status === "Pending";
    if (!mayEdit) return false;

    // User chose Edit on this (or another) submitted step — only that step is editable.
    if (editingSubmittedStep != null) {
      return isEditing && editingSubmittedStep === effectiveViewStepIndex;
    }

    // Resume / new work on the next incomplete step.
    const isViewingActiveStep = !isTripEnded && effectiveViewStepIndex === currentStep;
    if (isViewingActiveStep && !stepCompleted) {
      return isNewTrip || isEditing || trip.status === "Draft";
    }

    // Step 5 may be filled mid-trip (after Step 1) before final lock.
    if (effectiveViewStepIndex === 4 && isEditing && !stepCompleted) {
      return true;
    }

    return false;
  };

  /**
   * Navigate wizard steps (common for all 1–5).
   * - Highlights the selected step (never force-jumps to step 5).
   * - Submitted steps open locked; use pencil / Recent Edit to edit.
   * - Leaving a step clears edit-mode so ticks stay accurate.
   */
  const navigateToStep = useCallback(
    (idx: number) => {
      const safe = clampTripStepIndex(trip, idx);
      setViewStepIndex(safe);
      // Drop edit-mode when moving away so other steps stay locked (ticks stay).
      setEditingSubmittedStep((prev) => (prev != null && prev !== safe ? null : prev));
    },
    [trip]
  );

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
          onCancel={cancelToLanding}
          onExitEdit={exitEditToLocked}
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
          onCancel={cancelToLanding}
          onExitEdit={exitEditToLocked}
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
          onCancel={cancelToLanding}
          onExitEdit={exitEditToLocked}
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
          onCancel={cancelToLanding}
          onExitEdit={exitEditToLocked}
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
          onCancel={cancelToLanding}
          onExitEdit={exitEditToLocked}
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
            <div className="h-20 w-20 rounded-full bg-blue-50/70 flex items-center justify-center text-blue-500 shadow-inner">
              <FileText size={36} />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-slate-800 tracking-tight">{t("ops.trip.trip_entry_title")}</h2>
              <p className="text-slate-500 max-w-md mx-auto">
                {t("ops.trip.no_active_trip")}
              </p>
            </div>
            <button
              type="button"
              onClick={createNewTrip}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-400 to-indigo-400 hover:from-blue-500 hover:to-indigo-500 px-8 py-3 text-sm font-bold text-white shadow-md shadow-blue-100 transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/40 focus-visible:ring-offset-2"
            >
              <Plus size={18} />
              {t("ops.trip.create_new_trip")}
            </button>
          </div>
        ) : (
          <>
            <TripWizardStepper
              steps={localizedStepLabels}
              // Always highlight the step the user is viewing (not forced to 5).
              currentStep={effectiveViewStepIndex}
              completedMask={getTripWizardCompletedMask(trip)}
              lockedSteps={lockedSteps}
              onStepClick={(idx) => {
                navigateToStep(idx);
              }}
              onLockedStepClick={(idx) => {
                // A future step is locked until the previous step is actually
                // submitted (backend state). Redirect to the correct next step.
                navigateToStep(currentStep);
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
          </>
        )}
      </div>

      <TripRecentTable
        trips={allTrips}
        isLoading={tripsLoading}
        onRefresh={handleRefresh}
        onView={handleView}
        onEdit={handleEdit}
        onResume={handleResume}
        onDelete={can(CAPABILITIES.TRIP_DELETE) ? (trip, reason) => deleteTrip(trip.id, reason) : undefined}
        onStatusChange={handleStatusChange}
      />

      <RecentTripViewModal
        key={viewTrip?.id ?? "closed"}
        trip={viewTrip}
        open={viewOpen}
        onClose={() => {
          viewLoadSeqRef.current += 1;
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