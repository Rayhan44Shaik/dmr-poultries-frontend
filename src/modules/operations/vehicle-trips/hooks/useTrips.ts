import { useMemo, useState } from "react";
import type { Trip } from "../types/trip";
import { tripService } from "../services/tripService";
import { renumberPendingTripsForDate } from "../services/tripFormService";

type NotificationFn = (message: string, type?: "success" | "error" | "info") => void;

export default function useTrips(showNotification?: NotificationFn) {
  const notify = showNotification || ((msg: string) => alert(msg));

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All");
  const [vehicle, setVehicle] = useState("All Vehicles");
  const [driver, setDriver] = useState("All");
  const [supervisor, setSupervisor] = useState("All Supervisors");
  const [farm, setFarm] = useState("All Sources");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const [trips, setTrips] = useState<Trip[]>(tripService.getAll() || []);
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const refreshTrips = () => setTrips(tripService.getAll() || []);

  const resetFilters = () => {
    setSearch("");
    setStatus("All");
    setVehicle("All Vehicles");
    setDriver("All");
    setSupervisor("All Supervisors");
    setFarm("All Sources");
    setFromDate("");
    setToDate("");
    setCurrentPage(1);
  };

  // ✅ Soft‑delete with reason and renumbering
  const deleteTrip = (id: number, reason?: string) => {
    try {
      const allTrips = tripService.getAll() || [];
      const tripIndex = allTrips.findIndex((t) => t.id === id);
      if (tripIndex === -1) {
        notify("Trip not found.", "error");
        return;
      }

      const tripToDelete = allTrips[tripIndex];
      const wasPending = tripToDelete.status === "Pending";
      const tripDate = tripToDelete.tripDate;

      // 1. Mark as deleted and store reason
      const updatedTrip: Trip = {
        ...tripToDelete,
        deleted: true,
        deletedReason: reason || "No reason provided",
      };
      tripService.update(updatedTrip);
      refreshTrips();

      // 2. If it was pending, renumber remaining pending trips for that date
      if (wasPending) {
        renumberPendingTripsForDate(tripDate);
        refreshTrips(); // reload after renumbering
        notify(`Trip deleted and remaining pending trips for ${tripDate} renumbered.`, "success");
      } else {
        notify("Trip deleted successfully!", "success");
      }
    } catch {
      notify("Failed to delete trip.", "error");
    }
  };

  const updateTrip = (trip: Trip) => {
    try {
      tripService.update(trip);
      refreshTrips();
      notify("Trip updated successfully!", "success");
    } catch {
      notify("Failed to update trip.", "error");
    }
  };

  const changeStatus = (trip: Trip, status: "Pending" | "Completed") => {
    updateTrip({ ...trip, status });
  };

  const recentTrips = useMemo(() => tripService.getRecent(5) || [], [trips]);

  const filteredTrips = useMemo(() => {
    return (trips || []).filter((trip) => {
      // 🔹 Exclude deleted trips from default views (they are shown only in "Deleted" filter)
      const text = search.toLowerCase();
      const searchMatched =
        text === "" ||
        trip.tripNo.toLowerCase().includes(text) ||
        trip.vehicleNo.toLowerCase().includes(text) ||
        trip.driverName.toLowerCase().includes(text) ||
        trip.supervisorName.toLowerCase().includes(text) ||
        trip.sourceFarm.toLowerCase().includes(text);

      const statusMatched = status === "All" || trip.status === status;
      const vehicleMatched = vehicle === "All Vehicles" || trip.vehicleNo === vehicle;
      const driverMatched = driver === "All" || trip.driverName === driver;
      const supervisorMatched = supervisor === "All Supervisors" || trip.supervisorName === supervisor;
      const farmMatched = farm === "All Sources" || trip.sourceFarm === farm;
      const fromMatched = !fromDate || trip.tripDate >= fromDate;
      const toMatched = !toDate || trip.tripDate <= toDate;

      return (
        searchMatched &&
        statusMatched &&
        vehicleMatched &&
        driverMatched &&
        supervisorMatched &&
        farmMatched &&
        fromMatched &&
        toMatched &&
        !trip.deleted  // ⬅️ Exclude deleted trips from default lists
      );
    });
  }, [
    trips,
    search,
    status,
    vehicle,
    driver,
    supervisor,
    farm,
    fromDate,
    toDate,
  ]);

  const totalPages = Math.ceil((filteredTrips?.length || 0) / pageSize);
  const paginatedTrips = (filteredTrips || []).slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  // 👇 Expose all trips including deleted ones for the Recent Table
  const allTrips = trips || [];

  const totalTrips = filteredTrips?.length || 0;
  const totalShops = filteredTrips?.reduce((sum, t) => sum + t.totalShops, 0) || 0;
  const totalBirds = filteredTrips?.reduce((sum, t) => sum + t.totalBirds, 0) || 0;
  const totalWeight = filteredTrips?.reduce((sum, t) => sum + t.totalWeight, 0) || 0;
  const totalMortality = filteredTrips?.reduce((sum, t) => sum + t.totalMortality, 0) || 0;
  const totalExpenses = filteredTrips?.reduce((sum, t) => sum + t.expense, 0) || 0;

  return {
    trips: paginatedTrips || [],
    allTrips: allTrips,
    filteredTrips: filteredTrips || [],
    recentTrips: recentTrips || [],
    refreshTrips,
    deleteTrip,
    selectedTrip,
    setSelectedTrip,
    currentPage,
    setCurrentPage,
    totalPages,
    pageSize,
    totalTrips,
    totalShops,
    totalBirds,
    totalWeight,
    totalMortality,
    totalExpenses,
    updateTrip,
    changeStatus,
    search,
    setSearch,
    status,
    setStatus,
    vehicle,
    setVehicle,
    driver,
    setDriver,
    supervisor,
    setSupervisor,
    farm,
    setFarm,
    fromDate,
    setFromDate,
    toDate,
    setToDate,
    resetFilters,
  };
}