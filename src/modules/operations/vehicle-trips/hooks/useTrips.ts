// src/modules/operations/vehicle-trips/hooks/useTrips.ts

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Trip } from "../types/trip";
import {
  handleApiError,
  loadTrips,
  softDeleteTripWithReason,
  saveTrip,
  tripService,
} from "../services/tripService";

type NotificationFn = (
  message: string,
  type?: "success" | "error" | "info"
) => void;

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
  const [loading, setLoading] = useState(false);
  const pageSize = 10;

  const refreshTrips = useCallback(async () => {
    setLoading(true);
    try {
      const data = await loadTrips();
      setTrips(data);
    } catch (err) {
      notify(handleApiError(err), "error");
      setTrips(tripService.getAll() || []);
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    void refreshTrips();
  }, [refreshTrips]);

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

  const deleteTrip = async (id: number, reason?: string) => {
    try {
      await softDeleteTripWithReason(id, reason || "No reason provided");
      await refreshTrips();
      notify("Trip deleted successfully!", "success");
    } catch (err) {
      notify(handleApiError(err), "error");
    }
  };

  const updateTrip = async (trip: Trip) => {
    try {
      await saveTrip(trip.id, trip);
      await refreshTrips();
      notify("Trip updated successfully!", "success");
    } catch (err) {
      notify(handleApiError(err), "error");
    }
  };

  const changeStatus = (
    trip: Trip,
    status: "Pending" | "Completed",
    approvedBy?: string
  ) => {
    const updatedTrip = { ...trip, status };
    if (status === "Completed" && approvedBy) {
      (updatedTrip as any).approvedBy = approvedBy;
    }
    void updateTrip(updatedTrip);
  };

  const recentTrips = useMemo(
    () => tripService.getRecent(5) || [],
    [trips]
  );

  const filteredTrips = useMemo(() => {
    return (trips || []).filter((trip) => {
      const text = search.toLowerCase();
      const searchMatched =
        text === "" ||
        trip.tripNo.toLowerCase().includes(text) ||
        trip.vehicleNo.toLowerCase().includes(text) ||
        trip.driverName.toLowerCase().includes(text) ||
        trip.supervisorName.toLowerCase().includes(text) ||
        trip.sourceFarm.toLowerCase().includes(text);

      const statusMatched = status === "All" || trip.status === status;
      const vehicleMatched =
        vehicle === "All Vehicles" || trip.vehicleNo === vehicle;
      const driverMatched = driver === "All" || trip.driverName === driver;
      const supervisorMatched =
        supervisor === "All Supervisors" ||
        trip.supervisorName === supervisor;
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
        !trip.deleted
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

  const allTrips = trips || [];

  const totalTrips = filteredTrips?.length || 0;
  const totalShops =
    filteredTrips?.reduce((sum, t) => sum + t.totalShops, 0) || 0;
  const totalBirds =
    filteredTrips?.reduce((sum, t) => sum + t.totalBirds, 0) || 0;
  const totalWeight =
    filteredTrips?.reduce((sum, t) => sum + t.totalWeight, 0) || 0;
  const totalMortality =
    filteredTrips?.reduce((sum, t) => sum + t.totalMortality, 0) || 0;
  const totalExpenses =
    filteredTrips?.reduce((sum, t) => sum + t.expense, 0) || 0;

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
    loading,
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
