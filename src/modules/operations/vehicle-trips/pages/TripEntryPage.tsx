// src/modules/operations/vehicle-trips/pages/TripEntryPage.tsx

import React, { useEffect, useState, useRef } from "react";
import { AlertCircle, FileText, Plus } from "lucide-react";

// --- Components ---
import UnLoadingTable from "../components/Step_4";
import TripTotals from "../components/TripTotals";
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

function TripEntryPage({ embedded = false }: TripEntryPageProps) {
  const { vehicles } = useVehicles();
  const { employees } = useEmployees();
  const { farms } = useFarms();
  const { shops } = useShops();
  const { birdTypes } = useBirdTypes();

  const { showNotification } = useSafeNotification();
  const { trips, allTrips, refreshTrips, deleteTrip, changeStatus } = useTrips(showNotification);

  const {
    trip,
    setTrip,
    isEditing,
    setIsEditing,
    endStepSubmitted,
    saving,
    loading: tripLoading,
    error: tripError,
    setError: setTripError,
    updateTrip,
    updateDeliveries,
    updateBoxDetails,
    submitStartStep,
    submitFarmStep,
    submitPickupStep,
    submitDeliveriesStep,
    submitEndTrip,
    saveDraft,
    loadTrip,
    resumeDraft,
    reloadCurrentTrip,
    clearTrip,
  } = useTripEntry(showNotification);

  const [rows, setRows] = useState<ShopDelivery[]>([]);
  const [viewTrip, setViewTrip] = useState<Trip | null>(null);
  const [viewOpen, setViewOpen] = useState(false);
  
  // ✅ FIX: This strictly represents the index of the screen currently being viewed (0 to 4)
  const [viewStepIndex, setViewStepIndex] = useState(0);

  const [showEntryPrompt, setShowEntryPrompt] = useState(true);
  const isManualSelect = useRef(false);
  const endStepJustSubmitted = useRef(false);

  // ─── Automated Fuel Bill Generation & Approval ────────────
  const handleStatusChange = (changedTrip: Trip, status: "Pending" | "Completed", approvedBy?: string) => {
    if (status === "Completed") {
      const approverName = approvedBy || "Admin";

      const existingBills = fuelExpenseService.getBillsForTrip(changedTrip.vehicleId, changedTrip.tripDate);
      const alreadyGenerated = existingBills.some(b => b.remarks?.includes(changedTrip.tripNo));

      if (!alreadyGenerated) {
        let createdCount = 0;
        const indices = new Set<string>();
        Object.keys(changedTrip).forEach(key => {
            if (key.startsWith("dieselLtr")) {
                indices.add(key.replace("dieselLtr", ""));
            }
        });
        
        if (indices.size === 0 && (changedTrip.fuel || 0) > 0) {
            indices.add("");
        }

        indices.forEach(idx => {
            const tripAny = changedTrip as any;
            const liters = Number(tripAny[`dieselLtr${idx}`]) || 0;
            const rate = Number(tripAny[`dieselRate${idx}`]) || 0;
            const baseAmount = idx === "" ? Number(changedTrip.fuel || 0) : 0;
            const computedAmount = baseAmount > 0 ? baseAmount : (liters * rate);

            if (liters > 0 || computedAmount > 0) {
                fuelExpenseService.createAndApprove({
                    date: changedTrip.tripDate,
                    vehicleId: changedTrip.vehicleId,
                    vehicleNo: changedTrip.vehicleNo,
                    driverId: changedTrip.driverId,
                    driverName: changedTrip.driverName,
                    supervisorId: changedTrip.supervisorId,
                    supervisorName: changedTrip.supervisorName,
                    meterReading: Number(tripAny[`dieselMeter${idx}`]) || changedTrip.closingMeter || 0,
                    amount: computedAmount,
                    rate: rate,
                    litres: liters,
                    petrolBunk: tripAny[`dieselBunk${idx}`] || "Auto-Captured from Trip",
                    remarks: `Auto-generated from Trip ${changedTrip.tripNo}`,
                    image: tripAny[`dieselImage${idx}`] || ""
                }, approverName);
                createdCount++;
            }
        });

        if (createdCount > 0) {
          showNotification(`⛽ ${createdCount} fuel bill(s) auto-generated and approved.`, "success");
        }
      }
    }

    changeStatus(changedTrip, status, approvedBy);
  };

  const handleView = (selectedTrip: Trip) => {
    setViewTrip(selectedTrip);
    setViewOpen(true);
  };

  const handleEdit = (selectedTrip: Trip) => {
    setShowEntryPrompt(false);
    let targetStep = 0;
    
    // Determine highest uncompleted step to drop user in
    if (selectedTrip.endStepSubmitted || selectedTrip.expensesStepSubmitted) targetStep = 4;
    else if (selectedTrip.deliveryStepSubmitted) targetStep = 4;
    else if (selectedTrip.pickupStepSubmitted) targetStep = 3;
    else if (selectedTrip.farmStepSubmitted) targetStep = 2;
    else if (selectedTrip.startStepSubmitted) targetStep = 1;

    setViewStepIndex(targetStep);
    loadTrip(selectedTrip);
    setRows(selectedTrip.deliveries);
    showNotification(`✏️ Trip ${selectedTrip.tripNo} loaded. Proceed to edit.`, "info");
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
    void refreshTrips();
  }, [trip.id, trip.updatedAt, trip.status, refreshTrips]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const draft = await resumeDraft();
      if (cancelled || !draft) return;
      setShowEntryPrompt(false);
      let targetStep = 0;
      if (draft.endStepSubmitted || draft.expensesStepSubmitted) targetStep = 4;
      else if (draft.deliveryStepSubmitted) targetStep = 3;
      else if (draft.pickupStepSubmitted) targetStep = 2;
      else if (draft.farmStepSubmitted) targetStep = 1;
      else if (draft.startStepSubmitted) targetStep = 0;
      
      setViewStepIndex(targetStep);
      setRows(draft.deliveries || []);
      showNotification(
        `📂 Resumed draft trip ${draft.tripNo} from PostgreSQL.`,
        "info"
      );
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const clearForm = () => {
    clearTrip();
    setRows([]);
    setShowEntryPrompt(true);
    setViewStepIndex(0);
    setTrip((prev) => ({ ...prev, tripDate: getYesterday() }));
    showNotification("✨ Cleared.", "info");
  };

  // ✅ FIX: Masks rely purely on the submission flags. 
  const isStartCompleted = Boolean(trip.startStepSubmitted);
  const isFarmCompleted = Boolean(trip.farmStepSubmitted);
  const isPickupCompleted = Boolean(trip.pickupStepSubmitted);
  const isDeliveryCompleted = Boolean(trip.deliveryStepSubmitted);
  const isEndCompleted = Boolean(trip.endStepSubmitted || trip.expensesStepSubmitted);
  
  // Note: isTripEnded is still used just to know if we are entirely finished to fire success toasts
  const isTripEnded = Boolean(isEndCompleted || trip.status === "Completed" || trip.status === "Pending");

  const canEditTrip = trip.createdAt ? canEditItem(trip.createdAt) : false;

  // Track the highest step completed to ensure user drops in the correct tab automatically
  let farthestStep = 0;
  if (isEndCompleted) farthestStep = 4;
  else if (isDeliveryCompleted) farthestStep = 4;
  else if (isPickupCompleted) farthestStep = 3;
  else if (isFarmCompleted) farthestStep = 2;
  else if (isStartCompleted) farthestStep = 1;

  const vehicleOpts = vehicles.map((v: any) => ({ id: v.id, vehicleNumber: v.vehicleNumber }));
  const employeeOpts = employees.map((e: any) => ({ id: e.id, employeeName: e.employeeName, department: e.department }));

  useEffect(() => {
    // Only advance the view index if the user hasn't manually clicked another step
    if (farthestStep > viewStepIndex && !isManualSelect.current) {
      setViewStepIndex(farthestStep);
    }
  }, [farthestStep, viewStepIndex]);

  useEffect(() => {
    isManualSelect.current = false;
  }, [trip.id]);

  useEffect(() => {
    if (!isTripEnded && trip.status === "Pending") {
      setTrip((prev) => ({ ...prev, status: "Draft" as any }) as Trip);
      showNotification?.("⏳ Trip is still in draft. Complete the End step to submit.", "info");
    }
  }, [isTripEnded, trip.status, setTrip, showNotification]);

  useEffect(() => {
    if (isTripEnded && trip.status === "Draft" && !endStepJustSubmitted.current) {
      endStepJustSubmitted.current = true;
      setTrip((prev) => ({ ...prev, status: "Pending" }));
      showNotification?.("✅ Trip submitted for approval.", "success");
    }
    if (!isTripEnded) {
      endStepJustSubmitted.current = false;
    }
  }, [isTripEnded, trip.status, setTrip, showNotification]);

  const isNewTrip = trip.id === 0 || !trip.tripNo;

  const isEditable = (stepCompleted: boolean) => {
    if (viewStepIndex === 4) {
      if (trip.status === "Completed") return false;
      return isEditing && canEditTrip;
    }
    const isViewingActiveStep = !isTripEnded && viewStepIndex === farthestStep;
    if (isViewingActiveStep && !stepCompleted) {
      return isNewTrip || (isEditing && canEditTrip);
    }
    return false;
  };

  const renderSelectedStep = () => {
    const onCancelEdit = () => setIsEditing(false);

    if (viewStepIndex === 0) {
      return (
        <StepStart
          trip={trip}
          setTrip={setTrip}
          updateTrip={updateTrip}
          submitStartStep={submitStartStep}
          vehicleOptions={vehicleOpts}
          employeeOptions={employeeOpts}
          editable={isEditable(isStartCompleted)}
          canEdit={canEditTrip}
          onCancel={onCancelEdit}
          clearForm={clearForm}
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
          onCancel={onCancelEdit}
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
          onCancel={onCancelEdit}
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
          onCancel={onCancelEdit}
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
          onCancel={onCancelEdit}
          {...({
            submitEndTrip,
            submitExpensesStep: submitEndTrip,
            submitEndStep: submitEndTrip,
            onSubmit: submitEndTrip,
          } as any)}
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
        {showEntryPrompt ? (
          <div className="flex flex-col items-center justify-center text-center py-16 space-y-6">
            <div className="h-20 w-20 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 shadow-inner">
              <FileText size={36} />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Ready for a New Trip?</h2>
              <p className="text-slate-500 max-w-md mx-auto">
                Start a new unloading trip by creating an entry, or view your recent trip activity below.
              </p>
            </div>
            <button
              onClick={async () => {
                setShowEntryPrompt(false);
                const draft = await resumeDraft();
                if (draft) {
                  let targetStep = 0;
                  if (draft.deliveryStepSubmitted) targetStep = 3;
                  else if (draft.pickupStepSubmitted) targetStep = 2;
                  else if (draft.farmStepSubmitted) targetStep = 1;
                  else if (draft.startStepSubmitted) targetStep = 0;
                  setViewStepIndex(targetStep);
                  setRows(draft.deliveries || []);
                  showNotification(
                    `📂 Resumed draft trip ${draft.tripNo}.`,
                    "info"
                  );
                } else {
                  clearTrip();
                  setViewStepIndex(0);
                  setTrip((prev) => ({ ...prev, tripDate: getYesterday() }));
                }
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 px-8 py-3 text-sm font-bold text-white shadow-md shadow-blue-200 transition-all active:scale-95"
            >
              <Plus size={18} />
              Create New Trip
            </button>
          </div>
        ) : (
          <>
            {(tripLoading || saving) && (
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                <div className="h-3.5 w-3.5 rounded-full border-2 border-slate-200 border-t-blue-600 animate-spin" />
                {tripLoading ? "Loading trip..." : "Saving to PostgreSQL..."}
              </div>
            )}

            {tripError && (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                <span className="flex items-center gap-2">
                  <AlertCircle size={16} />
                  {tripError}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setTripError(null);
                    void (trip.id ? reloadCurrentTrip() : resumeDraft());
                  }}
                  className="shrink-0 text-xs font-bold underline"
                >
                  Retry
                </button>
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => void saveDraft()}
                disabled={saving || !trip.startStepSubmitted}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40"
              >
                Save Draft
              </button>
            </div>

            <TripWizardStepper
              steps={["Start", "Farm", "Pickup", "Deliveries", "End"]}
              currentStep={viewStepIndex} // ✅ FIX: currentStep strictly equals the active tab being edited/viewed
              completedMask={{
                start: isStartCompleted,
                farm: isFarmCompleted,
                pickup: isPickupCompleted,
                delivery: isDeliveryCompleted,
                end: isEndCompleted, 
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