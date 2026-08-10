// src/modules/operations/vehicle-trips/pages/TripEntryPage.tsx

import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { FileText, Plus } from "lucide-react";

// --- Components ---
import TripRecentTable from "../components/TripRecentTable";
import TripViewModal from "../components/TripViewModal";
import TripWizardStepper from "../components/TripWizardStepper";
import StepStart from "../components/StepStart";
import StepDeliveries from "../components/StepDeliveries";
import StepFarm from "../components/StepFarm";
import StepPickup from "../components/StepPickup";
import StepEnd from "../components/Step_5/StepEnd";
import TripFinalKPI from "../components/TripFinalKPI";

// --- Hooks ---
import { useTripEntry } from "../hooks/useTripEntry";
import useTrips from "../hooks/useTrips";
import { useVehicles } from "../../../masters/vehicles/hooks/useVehicles";
import { useEmployees } from "../../../masters/employees/hooks/useEmployees";
import { useFarms } from "../../../masters/farms/hooks/useFarms";
import { useShops } from "../../../masters/shops/hooks/useShops";
import { useBirdTypes } from "../../../masters/bird-types/hooks/useBirdTypes";
import { useSafeNotification } from "../../../../hooks/useSafeNotification";

// --- Services ---
import { fuelExpenseService } from "../../fuel-expenses/services/fuelExpenseService";

// --- Utils ---
import { canEditItem } from "../../../../utils/dateUtils";
import type { Trip, ShopDelivery } from "../types/trip";

type TripEntryPageProps = { embedded?: boolean; };

const getYesterday = () => {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return date.toISOString().split("T")[0];
};

type EntryScreen = "prompt" | "form";

function TripEntryPage({ embedded = false }: TripEntryPageProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { vehicles } = useVehicles();
  const { employees } = useEmployees();
  const { farms } = useFarms();
  const { shops } = useShops();
  const { birdTypes } = useBirdTypes();

  const { showNotification } = useSafeNotification();
  const { allTrips, refreshTrips, deleteTrip, changeStatus } = useTrips(showNotification);

  const {
    trip,
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
    submitFarmStep,
    submitPickupStep,
    submitDeliveriesStep,
    submitEndTrip,
    loadTrip,
    loadTripFromApi,
    clearTrip,
    updateStartTrip,
    registerStep1SuccessCallback,
  } = useTripEntry(showNotification, refreshTrips);

  const [rows, setRows] = useState<ShopDelivery[]>([]);
  const [viewTrip, setViewTrip] = useState<Trip | null>(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [viewStepIndex, setViewStepIndex] = useState(0);

  const [entryScreen, setEntryScreen] = useState<EntryScreen>("prompt");
  const isManualSelect = useRef(false);
  const endStepJustSubmitted = useRef(false);

  /** Strip tripId from URL so refresh never resumes an active wizard. */
  const clearTripIdFromUrl = useCallback(() => {
    const params = new URLSearchParams(location.search);
    if (!params.has("tripId")) return;
    params.set("tab", "trip-entry");
    params.delete("tripId");
    navigate(`/operations?${params.toString()}`, { replace: true });
  }, [location.search, navigate]);

  useEffect(() => {
    clearTripIdFromUrl();
  }, [clearTripIdFromUrl]);

  // After Step 1 success: keep trip in React state and open Step 2.
  useEffect(() => {
    registerStep1SuccessCallback(() => {
      setIsEditing(true);
      setViewStepIndex(1);
      setEntryScreen("form");
      isManualSelect.current = false;
    });
  }, [registerStep1SuccessCallback, setIsEditing]);

  // ─── Handle status change with fuel bill validation ────────────
  const handleStatusChange = (trip: Trip, status: "Pending" | "Completed") => {
    if (status === "Completed") {
      const bills = fuelExpenseService.getBillsForTrip(trip.vehicleId, trip.tripDate);
      const pendingBills = bills.filter(b => b.status === "Pending");

      if (pendingBills.length > 0) {
        const msg = pendingBills.length === 1
          ? `⚠️ 1 fuel bill for this trip is not approved. Please approve it before completing the trip.`
          : `⚠️ ${pendingBills.length} fuel bills for this trip are not approved. Please approve them before completing the trip.`;
        showNotification(msg, "info");
        return;
      }
    }

    changeStatus(trip, status);
  };

  const handleView = (selectedTrip: Trip) => {
    setViewTrip(selectedTrip);
    setViewOpen(true);
  };

  const handleEdit = (selectedTrip: Trip) => {
    setEntryScreen("form");
    let targetStep = 0;

    if (selectedTrip.status === "Completed" || selectedTrip.status === "Pending" || selectedTrip.endStepSubmitted || selectedTrip.expensesStepSubmitted) targetStep = 4;
    else if (selectedTrip.deliveryStepSubmitted) targetStep = 3;
    else if (selectedTrip.pickupStepSubmitted) targetStep = 2;
    else if (selectedTrip.farmStepSubmitted) targetStep = 1;
    else if (selectedTrip.startStepSubmitted) targetStep = 0;

    setViewStepIndex(targetStep);
    setRows(selectedTrip.deliveries || []);
    setIsEditing(true);
    isManualSelect.current = true;

    void (async () => {
      const loadedFromApi = await loadTripFromApi(selectedTrip.id);
      if (!loadedFromApi) {
        loadTrip(selectedTrip);
      }
      showNotification(`✏️ Trip ${selectedTrip.tripNo} loaded. Proceed to edit.`, "info");
    })();
  };

  const handleRefresh = () => {
    refreshTrips();
    showNotification("🔄 Refreshed", "info");
  };

  const isInitialMount = useRef(true);

  useEffect(() => {
    if (isInitialMount.current) {
      if (!trip.tripDate) {
        const yesterday = getYesterday();
        setTrip((prev) => ({ ...prev, tripDate: yesterday }));
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
    clearTrip();
    setRows([]);
    setEntryScreen("prompt");
    setViewStepIndex(0);
    setIsEditing(false);
    setTrip((prev) => ({ ...prev, tripDate: getYesterday() }));
    clearTripIdFromUrl();
    isManualSelect.current = false;
  }, [clearTrip, clearTripIdFromUrl, setIsEditing, setTrip]);

  const createNewTrip = useCallback(() => {
    clearTrip();
    setRows([]);
    setViewStepIndex(0);
    setTrip((prev) => ({ ...prev, tripDate: getYesterday() }));
    clearTripIdFromUrl();
    setIsEditing(true);
    setEntryScreen("form");
    isManualSelect.current = false;
  }, [clearTrip, clearTripIdFromUrl, setIsEditing, setTrip]);

  const isStartCompleted = Boolean(trip.startStepSubmitted);
  const isFarmCompleted = Boolean(trip.farmStepSubmitted);
  const isPickupCompleted = Boolean(trip.pickupStepSubmitted);
  const isDeliveryCompleted = Boolean(trip.deliveryStepSubmitted);
  const isTripEnded = Boolean(
    trip.endStepSubmitted ||
    trip.expensesStepSubmitted ||
    endStepSubmitted ||
    trip.status === "Completed" ||
    trip.status === "Pending"
  );

  const canEditTrip = trip.createdAt ? canEditItem(trip.createdAt) : true;

  // Next incomplete step becomes the active step after each successful submit.
  const currentStep = !isStartCompleted
    ? 0
    : !isFarmCompleted
      ? 1
      : !isPickupCompleted
        ? 2
        : !isDeliveryCompleted
          ? 3
          : 4;

  const vehicleOpts = useMemo(
    () => vehicles.map((v: any) => ({ id: v.id, vehicleNumber: v.vehicleNumber })),
    [vehicles]
  );
  const employeeOpts = useMemo(
    () => employees.map((e: any) => ({ id: e.id, employeeName: e.employeeName, department: e.department })),
    [employees]
  );

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

  useEffect(() => {
    if (isManualSelect.current) return;
    if (currentStep > viewStepIndex) {
      setViewStepIndex(currentStep);
    }
  }, [currentStep, viewStepIndex]);

  useEffect(() => {
    isManualSelect.current = false;
  }, [trip.id]);

  useEffect(() => {
    if (!isTripEnded && trip.status === "Pending" && entryScreen === "form") {
      setTrip((prev) => ({ ...prev, status: "Draft" as any }) as Trip);
    }
  }, [isTripEnded, trip.status, setTrip, entryScreen]);

  useEffect(() => {
    if (isTripEnded && trip.status === "Draft" && !endStepJustSubmitted.current && entryScreen === "form") {
      endStepJustSubmitted.current = true;
      setTrip((prev) => ({ ...prev, status: "Pending" }));
      showNotification?.("✅ Trip submitted for approval.", "success");
    }
    if (!isTripEnded) {
      endStepJustSubmitted.current = false;
    }
  }, [isTripEnded, trip.status, setTrip, showNotification, entryScreen]);

  const isNewTrip = trip.id === 0 || !trip.tripNo;

  const isEditable = (stepCompleted: boolean) => {
    if (viewStepIndex === 4) {
      if (trip.status === "Completed") return false;
      return isEditing && (canEditTrip || trip.status === "Draft" || trip.status === "Pending");
    }
    const isViewingActiveStep = !isTripEnded && viewStepIndex === currentStep;
    if (isViewingActiveStep && !stepCompleted) {
      // Active wizard step is always editable in-session.
      return isNewTrip || isEditing || trip.status === "Draft";
    }
    return false;
  };

  const renderSelectedStep = () => {
    if (viewStepIndex === 0) {
      return (
        <StepStart
          tripId={trip.id}
          startTime={trip.startTime}
          startStepSubmitted={trip.startStepSubmitted}
          loadSnapshot={step1LoadSnapshot}
          updateTrip={updateStartTrip}
          submitStartStep={submitStartStep}
          vehicleOptions={vehicleOpts}
          employeeOptions={employeeOpts}
          editable={isEditable(isStartCompleted)}
          canEdit={canEditTrip}
          onCancel={clearForm}
          clearForm={clearForm}
          headerLoading={headerLoading}
          subscribeHeaderSaveStatus={subscribeHeaderSaveStatus}
          getHeaderSaveStatus={getHeaderSaveStatus}
        />
      );
    }

    if (viewStepIndex === 1) {
      return (
        <StepFarm
          trip={trip}
          setTrip={setTrip}
          updateTrip={updateTrip}
          submitFarmStep={submitFarmStep}
          farms={farms}
          editable={isEditable(isFarmCompleted)}
          canEdit={canEditTrip}
          onCancel={clearForm}
        />
      );
    }

    if (viewStepIndex === 2) {
      return (
        <StepPickup
          trip={trip}
          setTrip={setTrip}
          updateTrip={updateTrip}
          submitPickupStep={submitPickupStep}
          updateBoxDetails={updateBoxDetails}
          editable={isEditable(isPickupCompleted)}
          canEdit={canEditTrip}
          onCancel={clearForm}
          clearForm={clearForm}
        />
      );
    }

    if (viewStepIndex === 3) {
      return (
        <StepDeliveries
          rows={rows}
          setRows={setRows}
          shops={shops}
          birdTypes={birdTypes}
          trip={trip}
          updateDeliveries={updateDeliveries}
          submitDeliveriesStep={submitDeliveriesStep}
          boxDetails={trip.boxDetails || []}
          readOnly={!isEditable(isDeliveryCompleted)}
          editable={isEditable(isDeliveryCompleted)}
          canEdit={canEditTrip}
          onCancel={clearForm}
          clearForm={clearForm}
        />
      );
    }

    if (viewStepIndex === 4) {
      return (
        <StepEnd
          trip={trip}
          setTrip={setTrip}
          updateTrip={updateTrip}
          editable={isEditable(isTripEnded)}
          canEdit={canEditTrip}
          onCancel={clearForm}
          clearForm={clearForm}
          submitExpensesStep={submitEndTrip}
        />
      );
    }

    return (
      <div className="mt-8 text-center p-12 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 text-sm">
        👈 Select a completed step or the current step to view it here.
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
              <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Trip Entry</h2>
              <p className="text-slate-500 max-w-md mx-auto">
                No active trip
              </p>
            </div>
            <button
              onClick={createNewTrip}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 px-8 py-3 text-sm font-bold text-white shadow-md shadow-blue-200 transition-all active:scale-95"
            >
              <Plus size={18} />
              Create New Trip
            </button>
          </div>
        ) : (
          <>
            <TripWizardStepper
              steps={["Start", "Farm", "Pickup", "Deliveries", "End"]}
              currentStep={isTripEnded ? 4 : currentStep}
              completedMask={{
                start: isStartCompleted,
                farm: isFarmCompleted,
                pickup: isPickupCompleted,
                delivery: isDeliveryCompleted,
                end: isTripEnded,
              } as any}
              onStepClick={(idx) => {
                setViewStepIndex(idx);
                isManualSelect.current = true;
              }}
            />

            <div className="mt-6">{renderSelectedStep()}</div>
            {isStartCompleted && <TripFinalKPI trip={trip} deliveries={rows} />}
          </>
        )}
      </div>

      <TripRecentTable
        trips={allTrips}
        onRefresh={handleRefresh}
        onView={handleView}
        onEdit={handleEdit}
        onDelete={(trip, reason) => deleteTrip(trip.id, reason)}
        onStatusChange={handleStatusChange}
      />

      <TripViewModal
        trip={viewTrip}
        open={viewOpen}
        onClose={() => {
          setViewOpen(false);
          setViewTrip(null);
        }}
        shops={shops}
        birdTypes={birdTypes}
        onEdit={(selectedTrip: Trip) => {
          handleEdit(selectedTrip);
          setViewOpen(false);
        }}
      />
    </div>
  );

  if (embedded) return content;
  return <div className="px-4 md:px-8 py-8 max-w-7xl mx-auto bg-slate-50/50 min-h-screen">{content}</div>;
}

export default React.memo(TripEntryPage);
