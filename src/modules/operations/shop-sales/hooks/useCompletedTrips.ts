import { useCallback, useEffect, useMemo, useState } from "react";
import { rateEntryApiService } from "../services/rateEntryApiService";
import type { RateEntryTripRow } from "../types/rateEntry";
import { useSafeNotification } from "../../../../hooks/useSafeNotification";
import { loadTripById } from "../../vehicle-trips/services/tripHeaderApiService";
import type { Trip } from "../../vehicle-trips/types/trip";

export default function useCompletedTrips() {
  const { showNotification } = useSafeNotification();

  const [trips, setTrips] = useState<RateEntryTripRow[]>([]);
  const [loading, setLoading] = useState(true);
  // The Rate Entry list row that was clicked (source of the rate_entry
  // id/bird type bookkeeping) and the real, full Trip hydrated from the
  // existing GET /api/trips/:id endpoint for that same trip — this is what
  // the existing (unmodified) EnterRateModal's `Trip`-shaped prop needs.
  const [selectedRow, setSelectedRow] = useState<RateEntryTripRow | null>(null);
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [opening, setOpening] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  const [filter, setFilter] = useState({
    fromDate: "",
    toDate: "",
    tripNo: "",
    vehicle: "",
    supervisor: "",
  });

  // Eligible (status = Completed, not deleted) trips, straight from
  // PostgreSQL via GET /api/operations/rate-entry — no localStorage.
  const loadTrips = useCallback(async () => {
    setLoading(true);
    try {
      const data = await rateEntryApiService.getEligibleTrips({
        fromDate: filter.fromDate || undefined,
        toDate: filter.toDate || undefined,
        vehicleNo: filter.vehicle || undefined,
        supervisorName: filter.supervisor || undefined,
        search: filter.tripNo || undefined,
      });
      setTrips(data);
    } catch {
      showNotification("Unable to load trips from the server.", "error");
    } finally {
      setLoading(false);
    }
  }, [filter.fromDate, filter.toDate, filter.vehicle, filter.supervisor, filter.tripNo, showNotification]);

  useEffect(() => {
    void loadTrips();
  }, [loadTrips]);

  // All filters (date range, vehicle, supervisor, search) are applied
  // server-side in loadTrips() — `trips` already reflects the current filter.
  const filteredTrips = trips;

  const totalPages = Math.max(1, Math.ceil(filteredTrips.length / pageSize));
  const paginatedTrips = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredTrips.slice(start, start + pageSize);
  }, [filteredTrips, currentPage]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(1);
  }, [totalPages, currentPage]);

  const vehicleList = useMemo(
    () => [...new Set(trips.map((t) => t.vehicleNo).filter((v): v is string => Boolean(v)))],
    [trips]
  );
  const supervisorList = useMemo(
    () => [...new Set(trips.map((t) => t.supervisorName).filter((v): v is string => Boolean(v)))],
    [trips]
  );

  /** Fetches the real Trip (with its real shop deliveries) for the row the
   * user clicked, so the existing EnterRateModal — built around the full
   * Trip shape — receives genuine data instead of anything invented here.
   * `rateCompleted` is overridden from the Rate Entry row's own rateStatus
   * (backed by rate_entry), since the raw trips.rate_completed column is
   * driven by the unrelated Collections workflow and would be misleading
   * for this modal's Enter/Modify decision. */
  const openRateModal = async (row: RateEntryTripRow) => {
    setSelectedRow(row);
    setOpening(true);
    try {
      const trip = await loadTripById(row.tripId);
      const rateCompleted = row.rateStatus === "Entered";
      // trip_deliveries.rate defaults to 0 (never previously written by Rate
      // Entry), so `0` — not just null/undefined — means "no real rate yet"
      // here; ?? would leave a stale 0 in place instead of the persisted
      // rate_entry value.
      const deliveries =
        rateCompleted && row.rate != null
          ? trip.deliveries.map((d) => {
              const existing = d.rate && d.rate > 0 ? d.rate : row.rate!;
              return { ...d, rate: existing, amount: existing * d.weight };
            })
          : trip.deliveries;
      setSelectedTrip({ ...trip, rateCompleted, deliveries });
      setModalOpen(true);
    } catch {
      showNotification("Unable to load trip details for rate entry.", "error");
      setSelectedRow(null);
    } finally {
      setOpening(false);
    }
  };

  const openRateEntry = (row: RateEntryTripRow) => {
    void openRateModal(row);
  };

  const openModifyRate = (row: RateEntryTripRow) => {
    void openRateModal(row);
  };

  const closeRateEntry = () => {
    setSelectedRow(null);
    setSelectedTrip(null);
    setModalOpen(false);
  };

  /** Matches the existing EnterRateModal's onSave contract exactly:
   * (deliveries: Trip["deliveries"]) => void. The modal collects a rate per
   * shop delivery, but the real backend model (rate_entry.trip_id UNIQUE)
   * persists one rate per trip — so the weighted-average rate across the
   * edited deliveries (total amount / total weight) is what gets saved via
   * the existing, already-working POST/PUT rate-entry API. */
  const saveTrip = (deliveries: Trip["deliveries"]) => {
    if (!selectedRow) return;
    const totalWeight = deliveries.reduce((sum, d) => sum + (d.weight || 0), 0);
    const totalAmount = deliveries.reduce((sum, d) => sum + ((d as any).amount || 0), 0);
    const rate = totalWeight > 0 ? Number((totalAmount / totalWeight).toFixed(2)) : 0;
    if (rate <= 0) {
      showNotification("Enter a valid rate before saving.", "error");
      return;
    }

    const row = selectedRow;
    void (async () => {
      try {
        // Rate Entry only ever lists trips with no rate_entry row yet (the
        // backend excludes rated trips), so this is always a first-time
        // create — there is no "Modify Rate" path here.
        await rateEntryApiService.createRate({
          tripId: row.tripId,
          rate,
          birdTypeId: row.birdTypeId,
          birdType: row.birdType ?? undefined,
        });

        // Rate Entry is not an editable history page — once locked, the
        // trip disappears immediately. The rate_entry row itself is never
        // deleted; it stays available to Shop Sales via trip_id.
        setTrips((prev) => prev.filter((t) => t.tripId !== row.tripId));
        showNotification("Rate saved and locked successfully.", "success");
      } catch (err: any) {
        showNotification(err?.message || "Failed to save rate.", "error");
      }
    })();
  };

  const resetFilters = () => {
    setFilter({ fromDate: "", toDate: "", tripNo: "", vehicle: "", supervisor: "" });
    setCurrentPage(1);
  };

  return {
    trips,
    loading,
    opening,
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
    refresh: loadTrips,
  };
}
