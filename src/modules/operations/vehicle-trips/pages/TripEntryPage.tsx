import React, { useEffect, useState, useRef } from "react";
import { AlertCircle } from "lucide-react";

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
  const { trips, allTrips, refreshTrips, deleteTrip } = useTrips(showNotification);

  const { 
    trip, 
    setTrip, 
    isEditing, 
    setIsEditing,
    updateTrip, 
    updateDeliveries, 
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

  const isManualSelect = useRef(false);

  const handleView = (selectedTrip: Trip) => { 
    setViewTrip(selectedTrip); 
    setViewOpen(true); 
  };
  
  const handleEdit = (selectedTrip: Trip) => { 
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

  const clearForm = () => { 
    clearTrip(); 
    setRows([]); 
    setTrip((prev) => ({ ...prev, tripDate: getYesterday() })); 
    showNotification("✨ Cleared.", "info"); 
  };

  // ─── STEP STATE FLAGS & PERMISSIONS ───
  const isStartCompleted = trip.startStepSubmitted;
  const isFarmCompleted = trip.farmStepSubmitted;
  const isPickupCompleted = trip.pickupStepSubmitted;
  const isDeliveryCompleted = trip.deliveryStepSubmitted;
  const isTripEnded = trip.status === "Completed";
  
  const canEditTrip = trip.createdAt ? canEditItem(trip.createdAt) : false;
  const isGlobalEditMode = isEditing && canEditTrip;

  const currentStep = isTripEnded ? 5 : (isDeliveryCompleted ? 4 : (isPickupCompleted ? 3 : (isFarmCompleted ? 2 : (isStartCompleted ? 1 : 0))));
  const vehicleOpts = vehicles.map((v: any) => ({ id: v.id, vehicleNumber: v.vehicleNumber }));
  const employeeOpts = employees.map((e: any) => ({ id: e.id, employeeName: e.employeeName, department: e.department }));

  // 🔹 TRACK PREVIOUS STEP STATE TO DETECT FRESH SUBMISSIONS
  const prevStepFlags = useRef({ start: false, farm: false, pickup: false, delivery: false });
  
  // 🔹 ROBUST AUTO-ADVANCE: Forces the view to the next step when a step is successfully submitted for the first time.
  useEffect(() => {
    const flags = {
      start: isStartCompleted,
      farm: isFarmCompleted,
      pickup: isPickupCompleted,
      delivery: isDeliveryCompleted
    };
    
    // Only auto-advance if it's a brand new submission (not an edit)
    if (!isGlobalEditMode) {
      if (flags.start && !prevStepFlags.current.start) { isManualSelect.current = false; setViewStepIndex(1); }
      if (flags.farm && !prevStepFlags.current.farm) { isManualSelect.current = false; setViewStepIndex(2); }
      if (flags.pickup && !prevStepFlags.current.pickup) { isManualSelect.current = false; setViewStepIndex(3); }
      if (flags.delivery && !prevStepFlags.current.delivery) { isManualSelect.current = false; setViewStepIndex(4); }
    }
    prevStepFlags.current = flags;
  }, [isStartCompleted, isFarmCompleted, isPickupCompleted, isDeliveryCompleted, isGlobalEditMode]);

  useEffect(() => {
    isManualSelect.current = false;
  }, [trip.id]);

  // 🔹 RENDER SELECTED STEP LOGIC
  const renderSelectedStep = () => {
    const isViewingActiveStep = !isTripEnded && viewStepIndex === currentStep;
    const onCancelEdit = () => setIsEditing(false);

    if (viewStepIndex === 0) {
      if (isViewingActiveStep && !isStartCompleted) {
        return <StepStart trip={trip} setTrip={setTrip} updateTrip={updateTrip} submitStartStep={submitStartStep} vehicleOptions={vehicleOpts} employeeOptions={employeeOpts} editable={isGlobalEditMode} canEdit={canEditTrip} onCancel={onCancelEdit} clearForm={clearForm} />;
      } else if (isStartCompleted) {
        return <StepStart trip={trip} setTrip={setTrip} updateTrip={updateTrip} submitStartStep={submitStartStep} vehicleOptions={vehicleOpts} employeeOptions={employeeOpts} editable={isGlobalEditMode} canEdit={canEditTrip} onCancel={onCancelEdit} clearForm={clearForm} />;
      }
    }
    if (viewStepIndex === 1) {
      if (isViewingActiveStep && isStartCompleted && !isFarmCompleted) {
        return <StepFarm trip={trip} setTrip={setTrip} updateTrip={updateTrip} submitFarmStep={submitFarmStep} farms={farms} editable={isGlobalEditMode} canEdit={canEditTrip} onCancel={onCancelEdit} />;
      } else if (isFarmCompleted) {
        return <StepFarm trip={trip} setTrip={setTrip} updateTrip={updateTrip} submitFarmStep={submitFarmStep} farms={farms} editable={isGlobalEditMode} canEdit={canEditTrip} onCancel={onCancelEdit} />;
      }
    }
    if (viewStepIndex === 2) {
      if (isViewingActiveStep && isFarmCompleted && !isPickupCompleted) {
        return <StepPickup trip={trip} setTrip={setTrip} updateTrip={updateTrip} submitPickupStep={submitPickupStep} editable={isGlobalEditMode} canEdit={canEditTrip} onCancel={onCancelEdit} clearForm={clearForm} />;
      } else if (isPickupCompleted) {
        return <StepPickup trip={trip} setTrip={setTrip} updateTrip={updateTrip} submitPickupStep={submitPickupStep} editable={isGlobalEditMode} canEdit={canEditTrip} onCancel={onCancelEdit} clearForm={clearForm} />;
      }
    }
    if (viewStepIndex === 3) {
      if (isViewingActiveStep && isPickupCompleted && !isDeliveryCompleted) {
        return <StepDeliveries rows={rows} setRows={setRows} shops={shops} birdTypes={birdTypes} trip={trip} updateDeliveries={updateDeliveries} submitDeliveriesStep={submitDeliveriesStep} readOnly={!isGlobalEditMode} editable={isGlobalEditMode} canEdit={canEditTrip} onCancel={onCancelEdit} clearForm={clearForm} />;
      } else if (isDeliveryCompleted) {
        return <StepDeliveries rows={rows} setRows={setRows} shops={shops} birdTypes={birdTypes} trip={trip} updateDeliveries={updateDeliveries} submitDeliveriesStep={submitDeliveriesStep} readOnly={!isGlobalEditMode} editable={isGlobalEditMode} canEdit={canEditTrip} onCancel={onCancelEdit} clearForm={clearForm} />;
      }
    }
    if (viewStepIndex === 4) {
      if (isTripEnded) {
        return <div className="mt-8 bg-emerald-50 border border-emerald-200 rounded-2xl p-8 text-center"><h2 className="text-2xl font-bold text-emerald-700">🎉 Trip Completed Successfully</h2></div>;
      } else if (isViewingActiveStep && isDeliveryCompleted) {
        return <StepEnd trip={trip} setTrip={setTrip} updateTrip={updateTrip} submitEndTrip={submitEndTrip} editable={isGlobalEditMode} canEdit={canEditTrip} onCancel={onCancelEdit} />;
      }
    }
    return <div className="mt-8 text-center p-12 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 text-sm">👈 Select a completed step or the current step to view it here.</div>;
  };

  // 🔹 CONTENT UI (Final Return)
  const content = (
    <div className="space-y-6">
      <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200/80 shadow-xl shadow-slate-100/70 space-y-6">
        {pendingWarning && ( <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700"><AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" /><span>{pendingWarning}</span></div> )}
        
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
        {isStartCompleted && <TripFinalKPI trip={trip} />}
      </div>

      <TripRecentTable trips={allTrips} onRefresh={handleRefresh} onView={handleView} onEdit={handleEdit} onDelete={(trip, reason) => deleteTrip(trip.id, reason)} />
      
      <TripViewModal trip={viewTrip} open={viewOpen} onClose={() => { setViewOpen(false); setViewTrip(null); }} shops={shops} birdTypes={birdTypes} onEdit={(selectedTrip) => { handleEdit(selectedTrip); setViewOpen(false); }} />
    </div>
  );

  if (embedded) return content;
  return <div className="px-4 md:px-8 py-8 max-w-7xl mx-auto bg-slate-50/50 min-h-screen">{content}</div>;
}

export default React.memo(TripEntryPage);