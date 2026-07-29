import React, { useEffect, useState, useRef } from "react";
import { AlertCircle, FileText, Plus } from "lucide-react";

// --- Components ---
import UnLoadingTable from "../components/UnLoadingTable";
import TripTotals from "../components/TripTotals";
import TripRecentTable from "../components/TripRecentTable";
import TripViewModal from "../components/TripViewModal";
import TripWizardStepper from "../components/TripWizardStepper";
import StepStart from "../components/StepStart";
import StepDeliveries from "../components/StepDeliveries";
import StepFarm from "../components/StepFarm";
import StepPickup from "../components/StepPickup";
import StepEnd from "../components/StepEnd";
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
import { useFuelKMValidator } from "../../../operations/fuel-expenses/hooks/useFuelKMValidator";

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
    updateTrip, 
    updateDeliveries, 
    updateBoxDetails,
    submitStartStep, 
    submitFarmStep, 
    submitPickupStep, 
    submitDeliveriesStep, 
    submitEndTrip, 
    loadTrip, 
    clearTrip 
  } = useTripEntry(showNotification);

  const validator = useFuelKMValidator(trip.vehicleNo);
  const pendingWarning = validator.getPendingWarning();

  const [rows, setRows] = useState<ShopDelivery[]>([]);
  const [viewTrip, setViewTrip] = useState<Trip | null>(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [viewStepIndex, setViewStepIndex] = useState(0);

  const [showEntryPrompt, setShowEntryPrompt] = useState(true);
  const isManualSelect = useRef(false);
  const endStepJustSubmitted = useRef(false);

  const handleView = (selectedTrip: Trip) => { 
    setViewTrip(selectedTrip); 
    setViewOpen(true); 
  };
  
  const handleEdit = (selectedTrip: Trip) => { 
    setShowEntryPrompt(false);
    let targetStep = 0;
    if (selectedTrip.status === "Completed") targetStep = 4;
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

  const lastGeneratedDate = useRef<string | null>(null);
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
  }, [trip]);

  const clearForm = () => { 
    clearTrip(); 
    setRows([]); 
    setShowEntryPrompt(true);
    setViewStepIndex(0);
    setTrip((prev) => ({ ...prev, tripDate: getYesterday() })); 
    showNotification("✨ Cleared.", "info"); 
  };

  const isStartCompleted = trip.startStepSubmitted;
  const isFarmCompleted = trip.farmStepSubmitted;
  const isPickupCompleted = trip.pickupStepSubmitted;
  const isDeliveryCompleted = trip.deliveryStepSubmitted;
  const isTripEnded = endStepSubmitted;

  const canEditTrip = trip.createdAt ? canEditItem(trip.createdAt) : false;
  const isGlobalEditMode = isEditing && canEditTrip;

  const currentStep = isTripEnded ? 5 
    : (isDeliveryCompleted ? 4 
      : (isPickupCompleted ? 3 
        : (isFarmCompleted ? 2 
          : (isStartCompleted ? 1 : 0))));
  
  const vehicleOpts = vehicles.map((v: any) => ({ id: v.id, vehicleNumber: v.vehicleNumber }));
  const employeeOpts = employees.map((e: any) => ({ id: e.id, employeeName: e.employeeName, department: e.department }));

  useEffect(() => {
    if (currentStep > viewStepIndex && !isManualSelect.current) {
      setViewStepIndex(currentStep);
    }
  }, [currentStep, viewStepIndex]);

  useEffect(() => {
    isManualSelect.current = false;
  }, [trip.id]);

  // ─── SAFEGUARD: prevent "Pending" status before End step ──────────
  useEffect(() => {
    if (!endStepSubmitted && trip.status === "Pending") {
      setTrip(prev => ({ ...prev, status: "Draft" as any }) as Trip);
      showNotification?.("⏳ Trip is still in draft. Complete the End step to submit for approval.", "info");
    }
  }, [endStepSubmitted, trip.status, setTrip, showNotification]);

  // ─── Force status to "Pending" when End step is submitted ──────────
  useEffect(() => {
    if (endStepSubmitted && trip.status === "Draft" && !endStepJustSubmitted.current) {
      endStepJustSubmitted.current = true;
      setTrip(prev => ({ ...prev, status: "Pending" }));
      showNotification?.("✅ Trip submitted for approval.", "success");
    }
    if (!endStepSubmitted) {
      endStepJustSubmitted.current = false;
    }
  }, [endStepSubmitted, trip.status, setTrip, showNotification]);

  // ─── Check if the trip is new (no saved data) ───────────────────────
  const isNewTrip = trip.id === 0 || !trip.tripNo;

  // ─── Editable logic ────────────────────────────────────────────────────
  const isEditable = (stepCompleted: boolean) => {
    // End step is never editable once the trip is ended
    if (viewStepIndex === 4 && isTripEnded) return false;
    const isViewingActiveStep = !isTripEnded && viewStepIndex === currentStep;
    if (isViewingActiveStep && !stepCompleted) {
      // For the active step, we allow editing if:
      // - The trip is new (no saved data yet), OR
      // - We are in edit mode (isEditing) and can edit (canEditTrip)
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
          submitEndTrip={submitEndTrip}
          editable={isEditable(isTripEnded)}
          canEdit={canEditTrip}
          onCancel={onCancelEdit}
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
        {pendingWarning && ( <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700"><AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" /><span>{pendingWarning}</span></div> )}
        
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
              onClick={() => setShowEntryPrompt(false)}
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
              currentStep={currentStep} 
              completedMask={{ start: isStartCompleted, farm: isFarmCompleted, pickup: isPickupCompleted, delivery: isDeliveryCompleted }} 
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
        onStatusChange={changeStatus} 
      />
      
      <TripViewModal trip={viewTrip} open={viewOpen} onClose={() => { setViewOpen(false); setViewTrip(null); }} shops={shops} birdTypes={birdTypes} onEdit={(selectedTrip) => { handleEdit(selectedTrip); setViewOpen(false); }} />
    </div>
  );

  if (embedded) return content;
  return <div className="px-4 md:px-8 py-8 max-w-7xl mx-auto bg-slate-50/50 min-h-screen">{content}</div>;
}

export default React.memo(TripEntryPage);