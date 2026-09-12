import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Trip } from "../../vehicle-trips/types/trip";
import { completedTripService } from "../services/completedTripService";
import { handleApiError } from "../../../../api";
import { isCanceledError } from "../../../../api/errors";
import { computeTotalPages } from "../../../../shared/ui/paginationStyles";
import { PAGINATION_DEFAULT_PAGE_SIZE } from "../../../../shared/ui/uiTokens";
import { useI18n } from "../../../../i18n";
import { formatVehicleNumber } from "../../../../utils/format";
import { displayRateEntryName, matchesRateEntrySearch } from "../utils/rateEntryDisplay";
import { dropLockedTripFromList, excludeKnownLockedTrips } from "./rateEntryLockList";

export type RateEntrySortKey =
  | "tripNo"
  | "tripDate"
  | "vehicleNo"
  | "supervisorName"
  | "sourceFarm"
  | "totalShops"
  | "totalBirds"
  | "totalWeight";

type RateEntryFilter = {
  fromDate: string;
  toDate: string;
  search: string;
  vehicle: string;
  supervisor: string;
};

const EMPTY_FILTER: RateEntryFilter = {
  fromDate: "",
  toDate: "",
  search: "",
  vehicle: "",
  supervisor: "",
};

// Helper to compute aggregates from deliveries
function computeTripAggregates(trip: Trip) {
  const deliveries = trip.deliveries || [];
  return {
    totalShops: trip.totalShops ?? deliveries.length,
    totalBirds: trip.totalBirds ?? deliveries.reduce((sum, d) => sum + (d.birds || 0), 0),
    totalWeight: trip.totalWeight ?? deliveries.reduce((sum, d) => sum + (d.weight || 0), 0),
  };
}

function sortText(value: unknown): string {
  return String(value ?? "").trim().toLocaleLowerCase();
}

function sortNumber(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function compareTrips(a: Trip, b: Trip, key: RateEntrySortKey, language: "en" | "te"): number {
  switch (key) {
    case "totalShops":
    case "totalBirds":
    case "totalWeight":
      return sortNumber(a[key]) - sortNumber(b[key]);
    case "tripDate":
      return sortText(a.tripDate).localeCompare(sortText(b.tripDate));
    case "vehicleNo":
      return sortText(formatVehicleNumber(a.vehicleNo)).localeCompare(sortText(formatVehicleNumber(b.vehicleNo)), undefined, { numeric: true });
    case "supervisorName":
    case "sourceFarm":
      return sortText(displayRateEntryName(a[key], language)).localeCompare(sortText(displayRateEntryName(b[key], language)), undefined, { numeric: true });
    case "tripNo":
      return sortText(a.tripNo).localeCompare(sortText(b.tripNo), undefined, { numeric: true });
    default:
      return 0;
  }
}

export default function useCompletedTrips() {
  const { language } = useI18n();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSizeState] = useState(PAGINATION_DEFAULT_PAGE_SIZE);
  const [sortBy, setSortBy] = useState<RateEntrySortKey | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const loadSeqRef = useRef(0);
  const loadAbortRef = useRef<AbortController | null>(null);
  const modalLoadSeqRef = useRef(0);
  const modalAbortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);
  const saveInFlightRef = useRef(false);
  const lockInFlightRef = useRef(false);
  const locallyLockedTripIdsRef = useRef<Set<number>>(new Set());
  const [filter, setFilterState] = useState<RateEntryFilter>(EMPTY_FILTER);

  const loadTrips = useCallback(async (): Promise<boolean> => {
    const requestSeq = loadSeqRef.current + 1;
    loadSeqRef.current = requestSeq;
    loadAbortRef.current?.abort();
    const controller = new AbortController();
    loadAbortRef.current = controller;
    setIsLoading(true);
    try {
      const data = await completedTripService.getCompletedTrips({ signal: controller.signal });
      if (!mountedRef.current || controller.signal.aborted || requestSeq !== loadSeqRef.current) return false;
      setTrips(excludeKnownLockedTrips(data, locallyLockedTripIdsRef.current));
      setLoadError(null);
      return true;
    } catch (error) {
      if (isCanceledError(error) || !mountedRef.current || requestSeq !== loadSeqRef.current) return false;
      console.error("Failed to load Rate Entry trips from the backend", error);
      setLoadError(handleApiError(error));
      return false;
    } finally {
      if (requestSeq === loadSeqRef.current) {
        loadAbortRef.current = null;
        if (mountedRef.current) setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void loadTrips();
    });
    return () => {
      cancelled = true;
      mountedRef.current = false;
      loadSeqRef.current += 1;
      modalLoadSeqRef.current += 1;
      loadAbortRef.current?.abort();
      modalAbortRef.current?.abort();
    };
  }, [loadTrips]);

  const setFilter = useCallback((next: Partial<RateEntryFilter>) => {
    setFilterState((prev) => ({ ...prev, ...next }));
    setCurrentPage(1);
  }, []);

  // Filter, enrich, and sort trips with aggregates.
  const filteredTrips = useMemo(() => {
    const rows = trips
      .filter((trip) => {
        const fromOk = !filter.fromDate || trip.tripDate >= filter.fromDate;
        const toOk = !filter.toDate || trip.tripDate <= filter.toDate;
        const searchOk = matchesRateEntrySearch(trip, filter.search, language);
        const vehicleOk = !filter.vehicle || trip.vehicleNo === filter.vehicle;
        const supervisorOk = !filter.supervisor || trip.supervisorName === filter.supervisor;
        return fromOk && toOk && searchOk && vehicleOk && supervisorOk;
      })
      .map((trip) => ({
        ...trip,
        ...computeTripAggregates(trip), // ensures totalShops, totalBirds, totalWeight exist
      }));

    if (!sortBy) return rows;
    const direction = sortDir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const primary = compareTrips(a, b, sortBy, language) * direction;
      return primary || b.id - a.id;
    });
  }, [trips, filter, sortBy, sortDir, language]);

  const totalPages = computeTotalPages(filteredTrips.length, pageSize);

  useEffect(() => {
    if (currentPage <= totalPages) return;
    const timer = window.setTimeout(() => setCurrentPage(totalPages), 0);
    return () => window.clearTimeout(timer);
  }, [currentPage, totalPages]);

  const paginatedTrips = useMemo(() => {
    const safePage = Math.min(currentPage, totalPages);
    const start = (safePage - 1) * pageSize;
    return filteredTrips.slice(start, start + pageSize);
  }, [filteredTrips, currentPage, pageSize, totalPages]);

  const vehicleList = useMemo(
    () =>
      [...new Set(trips.map((trip) => trip.vehicleNo).filter(Boolean))]
        .sort((a, b) => formatVehicleNumber(a).localeCompare(formatVehicleNumber(b), undefined, { numeric: true }))
        .map((vehicleNo) => ({ value: vehicleNo, label: formatVehicleNumber(vehicleNo) })),
    [trips]
  );
  const supervisorList = useMemo(
    () =>
      [...new Set(trips.map((trip) => trip.supervisorName).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
        .map((name) => ({ value: name, label: displayRateEntryName(name, language) })),
    [trips, language]
  );

  const setPageSize = useCallback((nextPageSize: number) => {
    setPageSizeState(nextPageSize);
    setCurrentPage(1);
  }, []);

  /** First click sorts ascending; second flips descending; third clears sort. */
  const handleSortChange = useCallback((key: RateEntrySortKey) => {
    setCurrentPage(1);
    if (sortBy === key) {
      if (sortDir === "asc") {
        setSortDir("desc");
      } else {
        setSortBy(null);
        setSortDir("asc");
      }
    } else {
      setSortBy(key);
      setSortDir("asc");
    }
  }, [sortBy, sortDir]);

  // Fetch the full Rate Entry detail (shop-wise deliveries + market
  // reference) from GET /operations/rate-entry/:tripId before opening the
  // modal — the backend is the authority for delivery rows.
  const openRateEntry = useCallback(async (trip: Trip) => {
    const requestSeq = modalLoadSeqRef.current + 1;
    modalLoadSeqRef.current = requestSeq;
    modalAbortRef.current?.abort();
    const controller = new AbortController();
    modalAbortRef.current = controller;
    setLoadError(null);
    try {
      const full = await completedTripService.getTrip(trip.id, { signal: controller.signal });
      if (!mountedRef.current || controller.signal.aborted || requestSeq !== modalLoadSeqRef.current) return;
      setSelectedTrip(full);
      setModalOpen(true);
    } catch (error) {
      if (isCanceledError(error) || !mountedRef.current || requestSeq !== modalLoadSeqRef.current) return;
      console.error(`Failed to load trip ${trip.id} for Rate Entry`, error);
      setLoadError(handleApiError(error));
    } finally {
      if (requestSeq === modalLoadSeqRef.current) modalAbortRef.current = null;
    }
  }, []);

  const openModifyRate = useCallback(async (trip: Trip) => {
    await openRateEntry(trip);
  }, [openRateEntry]);

  const closeRateEntry = useCallback(() => {
    modalLoadSeqRef.current += 1;
    modalAbortRef.current?.abort();
    setSelectedTrip(null);
    setModalOpen(false);
    setLoadError(null);
    setIsSaving(false);
    saveInFlightRef.current = false;
  }, []);

  /** Save only (no lock) — PUT /operations/rate-entry/:tripId. */
  const saveTrip = useCallback(
    async (deliveries: Trip["deliveries"]): Promise<boolean> => {
      if (!selectedTrip || isSaving || saveInFlightRef.current) return false;
      const tripId = selectedTrip.id;
      saveInFlightRef.current = true;
      setIsSaving(true);
      try {
        await completedTripService.saveOnly(tripId, deliveries);
        const full = await completedTripService.getTrip(tripId);
        if (mountedRef.current) setSelectedTrip(full);
        await loadTrips();
        return true;
      } catch (error) {
        console.error(`Failed to save rates for trip ${tripId}`, error);
        if (mountedRef.current) setLoadError(handleApiError(error));
        return false;
      } finally {
        saveInFlightRef.current = false;
        if (mountedRef.current) setIsSaving(false);
      }
    },
    [selectedTrip, isSaving, loadTrips]
  );

  /** Atomic Save & Lock — POST /operations/rate-entry/:tripId/lock. */
  const saveAndLockTrip = useCallback(
    async (deliveries: Trip["deliveries"]): Promise<boolean> => {
      if (!selectedTrip || isSaving || lockInFlightRef.current) return false;
      const lockedTripId = selectedTrip.id;
      lockInFlightRef.current = true;
      setIsSaving(true);
      try {
        await completedTripService.saveRates(lockedTripId, deliveries);
        locallyLockedTripIdsRef.current.add(lockedTripId);
        setTrips((prev) => dropLockedTripFromList(prev, lockedTripId));
        closeRateEntry();
        await loadTrips();
        return true;
      } catch (error) {
        console.error(`Failed to save & lock rates for trip ${lockedTripId}`, error);
        setLoadError(handleApiError(error));
        return false;
      } finally {
        lockInFlightRef.current = false;
        setIsSaving(false);
      }
    },
    [selectedTrip, isSaving, closeRateEntry, loadTrips]
  );

  const resetFilters = useCallback(() => {
    setFilterState(EMPTY_FILTER);
    setSortBy(null);
    setSortDir("asc");
    setCurrentPage(1);
  }, []);

  return {
    trips,
    filteredTrips,
    paginatedTrips,
    currentPage,
    pageSize,
    totalPages,
    setCurrentPage,
    setPageSize,
    sortBy,
    sortDir,
    handleSortChange,
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
    saveAndLockTrip,
    loadTrips,
    loadError,
    isLoading,
    isSaving,
  };
}
