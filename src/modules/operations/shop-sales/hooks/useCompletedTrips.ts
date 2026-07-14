import { useEffect, useMemo, useState } from "react";
import type { Trip } from "../../vehicle-trips/types/trip";
import { completedTripService } from "../services/completedTripService";

// Helper to compute aggregates from deliveries
function computeTripAggregates(trip: Trip) {
  const deliveries = trip.deliveries || [];
  return {
    totalShops: trip.totalShops ?? deliveries.length,
    totalBirds: trip.totalBirds ?? deliveries.reduce((sum, d) => sum + (d.birds || 0), 0),
    totalWeight: trip.totalWeight ?? deliveries.reduce((sum, d) => sum + (d.weight || 0), 0),
  };
}

export default function useCompletedTrips() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  const [filter, setFilter] = useState({
    fromDate: "",
    toDate: "",
    tripNo: "",
    vehicle: "",
    supervisor: "",
  });

  function loadTrips() {
    setTrips(completedTripService.getCompletedTrips());
  }

  useEffect(() => {
    loadTrips();
  }, []);

  // Filter and enrich trips with aggregates
  const filteredTrips = useMemo(() => {
    return trips
      .filter((trip) => {
        const fromOk = !filter.fromDate || trip.tripDate >= filter.fromDate;
        const toOk = !filter.toDate || trip.tripDate <= filter.toDate;
        const tripOk = !filter.tripNo || trip.tripNo.toLowerCase().includes(filter.tripNo.toLowerCase());
        const vehicleOk = !filter.vehicle || trip.vehicleNo === filter.vehicle;
        const supervisorOk = !filter.supervisor || trip.supervisorName === filter.supervisor;
        return fromOk && toOk && tripOk && vehicleOk && supervisorOk;
      })
      .map((trip) => ({
        ...trip,
        ...computeTripAggregates(trip), // ensures totalShops, totalBirds, totalWeight exist
      }));
  }, [trips, filter]);

  const totalPages = Math.ceil(filteredTrips.length / pageSize);
  const paginatedTrips = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredTrips.slice(start, start + pageSize);
  }, [filteredTrips, currentPage]);

  const vehicleList = [...new Set(trips.map((x) => x.vehicleNo))];
  const supervisorList = [...new Set(trips.map((x) => x.supervisorName))];

  const openRateEntry = (trip: Trip) => {
    setSelectedTrip(trip);
    setModalOpen(true);
  };

  const openModifyRate = (trip: Trip) => {
    setSelectedTrip(trip);
    setModalOpen(true);
  };

  const closeRateEntry = () => {
    setSelectedTrip(null);
    setModalOpen(false);
  };

  const saveTrip = (deliveries: Trip["deliveries"]) => {
    if (!selectedTrip) return;
    const saved = completedTripService.saveRates(selectedTrip.id, deliveries);
    if (saved) {
      closeRateEntry();
      loadTrips();
    }
  };

  const resetFilters = () => {
    setFilter({ fromDate: "", toDate: "", tripNo: "", vehicle: "", supervisor: "" });
    setCurrentPage(1);
  };

  return {
    trips,
    filteredTrips,
    paginatedTrips,
    currentPage,
    totalPages,
    setCurrentPage,
    filter,
    setFilter,
    resetFilters,
    vehicleList,
    supervisorList,
    modalOpen,
    selectedTrip,
    openRateEntry,
    openModifyRate,
    closeRateEntry,
    saveTrip,
  };
}