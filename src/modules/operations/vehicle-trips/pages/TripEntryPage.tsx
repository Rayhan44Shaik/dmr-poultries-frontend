import React, { useEffect, useState, useRef } from "react";
import { X, Save, Plus, AlertCircle } from "lucide-react";
import TripInformation from "../components/TripInformation";
import UnLoadingTable from "../components/UnLoadingTable";
import TripTotals from "../components/TripTotals";
import TripRecentTable from "../components/TripRecentTable";
import TripViewModal from "../components/TripViewModal";
import TripEditModal from "../components/TripEditModal";

import { useTripEntry } from "../hooks/useTripEntry";
import useTrips from "../hooks/useTrips";
import { useVehicles } from "../../../masters/vehicles/hooks/useVehicles";
import { useEmployees } from "../../../masters/employees/hooks/useEmployees";
import { useFarms } from "../../../masters/farms/hooks/useFarms";
import { useShops } from "../../../masters/shops/hooks/useShops";
import { useBirdTypes } from "../../../masters/bird-types/hooks/useBirdTypes";
import { generateTripNo } from "../services/tripFormService";
import { useSafeNotification } from "../../../../hooks/useSafeNotification";
import { useFuelKMValidator } from "../../../operations/fuel-expenses/hooks/useFuelKMValidator";

import type { Trip, ShopDelivery } from "../types/trip";

type TripEntryPageProps = {
  embedded?: boolean;
};

// ─── Helper: Get yesterday's date in YYYY-MM-DD format ───
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

  const {
    trips,
    allTrips,
    refreshTrips,
    changeStatus,
    deleteTrip,
  } = useTrips(showNotification);

  const {
    trip,
    setTrip,
    updateField,
    updateDeliveries,
    saveTrip,
    updateTrip,
    loadTrip,
    clearTrip,
  } = useTripEntry(showNotification);

  // ── Fuel KM Validator ──
  const validator = useFuelKMValidator(trip.vehicleNo);
  const pendingWarning = validator.getPendingWarning();

  const drivers = employees.filter((x: any) => x.department === "Driver");
  const supervisors = employees.filter((x: any) => x.department === "Supervisor");

  const [rows, setRows] = useState<ShopDelivery[]>([]);
  const [viewTrip, setViewTrip] = useState<Trip | null>(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [editTrip, setEditTrip] = useState<Trip | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const handleView = (selectedTrip: Trip) => {
    setViewTrip(selectedTrip);
    setViewOpen(true);
  };

  const handleEdit = (selectedTrip: Trip) => {
    setEditTrip(selectedTrip);
    setEditOpen(true);
  };

  const loadTripForEditing = () => {
    if (!editTrip) return;
    loadTrip(editTrip);
    setRows(editTrip.deliveries);
    setIsEditing(true);
    setEditOpen(false);
  };

  const lastGeneratedDate = useRef<string | null>(null);
  const isInitialMount = useRef(true);

  // ─── Set default trip date to YESTERDAY on initial mount ───
  useEffect(() => {
    if (isInitialMount.current && !isEditing) {
      const yesterday = getYesterday();
      if (!trip.tripDate) {
        setTrip((prev) => ({ ...prev, tripDate: yesterday }));
      }
      isInitialMount.current = false;
    }
  }, []);

  // ─── Generate Trip No using ALL trips ───
  useEffect(() => {
    if (isEditing) return;
    if (!trip.tripDate) return;

    const currentDate = trip.tripDate;

    const shouldGenerate =
      lastGeneratedDate.current !== currentDate ||
      !trip.tripNo ||
      !trip.tripNo.startsWith(`TRP-${currentDate.replace(/-/g, '')}`);

    if (shouldGenerate) {
      const newTripNo = generateTripNo(allTrips, currentDate);
      setTrip((prev) => ({ ...prev, tripNo: newTripNo }));
      lastGeneratedDate.current = currentDate;
    }
  }, [trip.tripDate, allTrips, isEditing, setTrip, trip.tripNo]);

  // ─── Reset lastGeneratedDate when form is cleared ───
  const handleClear = () => {
    console.log(`[${new Date().toISOString()}] 🔹 CLEAR FORM triggered`);
    clearTrip();
    setRows([]);
    setIsEditing(false);
    lastGeneratedDate.current = null;
    setTrip((prev) => ({ ...prev, tripDate: getYesterday() }));
    showNotification("✨ Trip form has been securely cleared and reset.", "info");
  };

  // ─── Validation: Total Birds = Delivered Birds + Mortality ───
  const validateBirdCount = (): string | null => {
    const totalBirdsFromTrip = trip.totalBirds || 0;
    const totalBirdsDelivered = rows.reduce(
      (sum, row) => sum + (row.birds || 0),
      0
    );
    const totalMortalityFromTrip = trip.totalMortality || 0;
    const expected = totalBirdsDelivered + totalMortalityFromTrip;

    if (totalBirdsFromTrip !== expected) {
      return `⚠️ Discrepancy Detected: Total Birds (${totalBirdsFromTrip}) must equal Delivered (${totalBirdsDelivered}) + Mortality (${totalMortalityFromTrip}) = ${expected}`;
    }
    return null;
  };

  // ─── Check if there's a pending fuel bill ───
  const validatePendingFuel = (): string | null => {
    if (pendingWarning) {
      return `❌ Cannot save trip: ${pendingWarning}`;
    }
    return null;
  };

  // ─── Validate KM against approved fuel reading ───
  const validateKM = (): string | null => {
    if (!trip.vehicleNo) return null;
    
    // Check opening meter (if greater than 0)
    if (trip.openingMeter > 0) {
      const { valid, message } = validator.validateKM(trip.openingMeter);
      if (!valid) {
        return message || 'Invalid Opening KM';
      }
    }
    
    // Check closing meter (if greater than 0)
    if (trip.closingMeter > 0) {
      const { valid, message } = validator.validateKM(trip.closingMeter);
      if (!valid) {
        return message || 'Invalid Closing KM';
      }
    }
    
    return null;
  };

  // ─── HANDLERS ───

  const handleSave = () => {
    console.log(`[${new Date().toISOString()}] 🔹 SAVE TRIP triggered`);

    // Check for pending fuel bill first
    const pendingFuelError = validatePendingFuel();
    if (pendingFuelError) {
      console.error(`[${new Date().toISOString()}] ❌ PENDING FUEL BLOCKED: ${pendingFuelError}`);
      showNotification(pendingFuelError, "error");
      return;
    }

    // Check KM validation
    const kmError = validateKM();
    if (kmError) {
      console.error(`[${new Date().toISOString()}] ❌ KM VALIDATION FAILED: ${kmError}`);
      showNotification(kmError, "error");
      return;
    }

    const validationError = validateBirdCount();
    if (validationError) {
      console.error(`[${new Date().toISOString()}] ❌ VALIDATION FAILED: ${validationError}`);
      showNotification(validationError, "error");
      return;
    }

    updateDeliveries(rows);
    let success: boolean;
    if (isEditing) {
      success = updateTrip(rows);
    } else {
      success = saveTrip(rows);
    }
    if (success) {
      console.log(`[${new Date().toISOString()}] ✅ TRIP SAVED successfully`);
      showNotification("🚀 Success! Trip details have been successfully saved to the logistics ledger.", "success");
      refreshTrips();
      setIsEditing(false);
      setRows([]);
      lastGeneratedDate.current = null;
      setTrip((prev) => ({ ...prev, tripDate: getYesterday() }));
    } else {
      console.error(`[${new Date().toISOString()}] ❌ FAILED to save trip`);
      showNotification("❌ Action Failed: Unable to save trip. Please review all mandatory fields.", "error");
    }
  };

  const handleSaveNew = () => {
    console.log(`[${new Date().toISOString()}] 🔹 SAVE & NEW triggered`);

    // Check for pending fuel bill first
    const pendingFuelError = validatePendingFuel();
    if (pendingFuelError) {
      console.error(`[${new Date().toISOString()}] ❌ PENDING FUEL BLOCKED: ${pendingFuelError}`);
      showNotification(pendingFuelError, "error");
      return;
    }

    // Check KM validation
    const kmError = validateKM();
    if (kmError) {
      console.error(`[${new Date().toISOString()}] ❌ KM VALIDATION FAILED: ${kmError}`);
      showNotification(kmError, "error");
      return;
    }

    const validationError = validateBirdCount();
    if (validationError) {
      console.error(`[${new Date().toISOString()}] ❌ VALIDATION FAILED: ${validationError}`);
      showNotification(validationError, "error");
      return;
    }

    updateDeliveries(rows);
    const success = saveTrip(rows);
    if (success) {
      console.log(`[${new Date().toISOString()}] ✅ TRIP SAVED, clearing form for new entry`);
      showNotification("🌟 Trip saved successfully! Initialized a clean form for your next entry.", "success");
      refreshTrips();
      setRows([]);
      setIsEditing(false);
      lastGeneratedDate.current = null;
      setTrip((prev) => ({ ...prev, tripDate: getYesterday() }));
    } else {
      console.error(`[${new Date().toISOString()}] ❌ FAILED to save trip (Save & New)`);
      showNotification("❌ Action Failed: Unable to save trip. Please check your data inputs.", "error");
    }
  };

  const handleRefresh = () => {
    console.log(`[${new Date().toISOString()}] 🔄 REFRESH trip list triggered`);
    refreshTrips();
    showNotification("🔄 Trip dispatch pipeline list has been fully refreshed.", "info");
  };

  useEffect(() => {
    if (!isEditing) return;
    setRows(trip.deliveries);
  }, [trip, isEditing]);

  // ─── Modern Enhanced Action Buttons Toolbar ───
  const actionButtons = (
    <div className="flex flex-wrap items-center justify-end gap-3 pt-4 border-t border-slate-200/60 mt-4">
      <button
        onClick={handleClear}
        className="inline-flex items-center gap-2 rounded-xl bg-white hover:bg-rose-50 px-5 py-2.5 text-xs font-bold text-slate-700 hover:text-rose-700 border border-slate-200 hover:border-rose-200 transition-all shadow-sm active:scale-95 group"
      >
        <X size={15} className="text-slate-400 group-hover:text-rose-500 transition-colors" />
        Clear Form
      </button>
      <button
        onClick={handleSave}
        className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 px-6 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-200 hover:shadow-lg hover:shadow-blue-300 transition-all active:scale-95"
      >
        <Save size={15} />
        Save Trip Record
      </button>
      <button
        onClick={handleSaveNew}
        className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 px-6 py-2.5 text-xs font-bold text-white shadow-md shadow-emerald-200 hover:shadow-lg hover:shadow-emerald-300 transition-all active:scale-95"
      >
        <Plus size={15} />
        Save & Add New
      </button>
    </div>
  );

  // ─── Content ───
  const content = (
    <div className="space-y-6">
      {/* ── Main Form Components container with Clean Card Styling ── */}
      <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200/80 shadow-xl shadow-slate-100/70 space-y-6">
        {/* Pending Fuel Warning Banner */}
        {pendingWarning && (
          <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
            <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
            <span>{pendingWarning}</span>
          </div>
        )}

        <TripInformation
          trip={trip}
          setTrip={setTrip}
          updateField={updateField}
          vehicles={vehicles}
          drivers={drivers}
          supervisors={supervisors}
          farms={farms}
        />

        <div className="pt-2">
          <UnLoadingTable
            rows={rows}
            setRows={setRows}
            shops={shops}
            birdTypes={birdTypes}
            actions={actionButtons}
          />
        </div>

        <TripTotals rows={rows} />
      </div>

      {/* ── Recent Table Component ── */}
      <TripRecentTable
        trips={allTrips}
        onRefresh={handleRefresh}
        onView={handleView}
        onEdit={handleEdit}
        onDelete={(trip, reason) => deleteTrip(trip.id, reason)}
        onStatusChange={changeStatus}
      />

      <TripViewModal
        trip={viewTrip}
        open={viewOpen}
        onClose={() => {
          setViewOpen(false);
          setViewTrip(null);
        }}
      />

      <TripEditModal
        trip={editTrip}
        open={editOpen}
        onClose={() => {
          setEditOpen(false);
          setEditTrip(null);
        }}
        onEdit={loadTripForEditing}
      />
    </div>
  );

  if (embedded) {
    return content;
  }

  return (
    <div className="px-4 md:px-8 py-8 max-w-7xl mx-auto bg-slate-50/50 min-h-screen">
      {content}
    </div>
  );
}

export default React.memo(TripEntryPage);