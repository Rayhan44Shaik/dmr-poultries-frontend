import React, { useEffect, useState, useRef } from "react";
import TripInformation from "../components/TripInformation";
import ShopDeliveryTable from "../components/ShopDeliveryTable";
import TripTotals from "../components/TripTotals";
import TripFooter from "../components/TripFooter";
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

import type { Trip, ShopDelivery } from "../types/trip";

type TripEntryPageProps = {
  embedded?: boolean;
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
    deleteTrip 
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

  useEffect(() => {
    if (!isEditing && trip.tripDate) {
      if (lastGeneratedDate.current !== trip.tripDate) {
        const newTripNo = generateTripNo(trips, trip.tripDate);
        if (trip.tripNo !== newTripNo) {
          setTrip((prev) => ({ ...prev, tripNo: newTripNo }));
          lastGeneratedDate.current = trip.tripDate;
        }
      }
    }
  }, [trip.tripDate, trips, isEditing, setTrip, trip.tripNo]);

  const handleSave = () => {
    updateDeliveries(rows);
    let success: boolean;
    if (isEditing) {
      success = updateTrip(rows);
    } else {
      success = saveTrip(rows);
    }
    if (success) {
      showNotification("Trip saved successfully!", "success");
      refreshTrips();
      setIsEditing(false);
      setRows([]);
    } else {
      showNotification("Failed to save trip. Please check the form.", "error");
    }
  };

  const handleSaveNew = () => {
    updateDeliveries(rows);
    const success = saveTrip(rows);
    if (success) {
      showNotification("Trip saved successfully! You can start a new trip.", "success");
      refreshTrips();
      setRows([]);
      setIsEditing(false);
    } else {
      showNotification("Failed to save trip. Please check the form.", "error");
    }
  };

  const handleClear = () => {
    clearTrip();
    setRows([]);
    setIsEditing(false);
    showNotification("Trip form cleared.", "info");
  };

  const handleRefresh = () => {
    refreshTrips();
    showNotification("Trip list refreshed.", "info");
  };

  useEffect(() => {
    if (!isEditing) return;
    setRows(trip.deliveries);
  }, [trip, isEditing]);

  // ─── Content with ZERO top padding ───
  const content = (
    <div className="space-y-4">   {/* only spacing between children, no top padding */}
      <TripInformation
        trip={trip}
        setTrip={setTrip}
        updateField={updateField}
        vehicles={vehicles}
        drivers={drivers}
        supervisors={supervisors}
        farms={farms}
      />

      <ShopDeliveryTable
        rows={rows}
        setRows={setRows}
        shops={shops}
        birdTypes={birdTypes}
      />

      <TripTotals rows={rows} />

      <TripRecentTable
        trips={allTrips}
        onRefresh={handleRefresh}
        onView={handleView}
        onEdit={handleEdit}
        onDelete={(trip) => deleteTrip(trip.id)}
        onStatusChange={changeStatus}
      />

      <TripFooter
        onClear={handleClear}
        onSave={handleSave}
        onSaveNew={handleSaveNew}
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

  // ─── Return ───
  if (embedded) {
    return content;  // No wrapper, no padding, no margin
  }

  // Standalone mode: minimal padding only (p-2) to avoid edge touching
  return <div className="p-2">{content}</div>;
}

export default React.memo(TripEntryPage);