import React, { useEffect, useState } from "react";
import DashboardLayout from "../../../../layouts/DashboardLayout/DashboardLayout";

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
  // Masters data
  const { vehicles } = useVehicles();
  const { employees } = useEmployees();
  const { farms } = useFarms();
  const { shops } = useShops();
  const { birdTypes } = useBirdTypes();

  // Safe notification
  const { showNotification } = useSafeNotification();

  // Pass notification to both hooks
  const { 
    trips, 
    allTrips,           // full list
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

  // Employees filters
  const drivers = employees.filter((x: any) => x.department === "Driver");
  const supervisors = employees.filter((x: any) => x.department === "Supervisor");

  // Delivery rows
  const [rows, setRows] = useState<ShopDelivery[]>([]);

  // View modal
  const [viewTrip, setViewTrip] = useState<Trip | null>(null);
  const [viewOpen, setViewOpen] = useState(false);

  // Edit modal
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

  // ---- Generate sequential trip number when date changes (only for new trips) ----
  useEffect(() => {
    if (!isEditing && trip.tripDate && !trip.tripNo) {
      const newTripNo = generateTripNo(trips, trip.tripDate);
      if (trip.tripNo !== newTripNo) {
        setTrip((prev) => ({ ...prev, tripNo: newTripNo }));
      }
    }
  }, [trip.tripDate, trips, isEditing, setTrip, trip.tripNo]);

  // ---- Save or Update ----
  const handleSave = () => {
    updateDeliveries(rows);
    let success: boolean;
    if (isEditing) {
      success = updateTrip(rows);
    } else {
      success = saveTrip(rows);
    }
    if (success) {
      refreshTrips();
      setIsEditing(false);
      setRows([]);
    }
  };

  const handleSaveNew = () => {
    updateDeliveries(rows);
    const success = saveTrip(rows);
    if (success) {
      refreshTrips();
      setRows([]);
      setIsEditing(false);
    }
  };

  const handleClear = () => {
    clearTrip();
    setRows([]);
    setIsEditing(false);
  };

  const handleRefresh = () => {
    refreshTrips();
  };

  // ---- When editing, load delivery rows ----
  useEffect(() => {
    if (!isEditing) return;
    setRows(trip.deliveries);
  }, [trip, isEditing]);

  // ---- Content (shared) ----
  const content = (
    <div className="px-6 py-6 space-y-8">
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

  if (embedded) {
    return content;
  }

  return <DashboardLayout>{content}</DashboardLayout>;
}

export default React.memo(TripEntryPage);