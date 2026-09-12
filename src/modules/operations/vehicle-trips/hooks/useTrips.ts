// src/modules/operations/vehicle-trips/hooks/useTrips.ts

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Trip } from "../types/trip";
import type { TripStatus } from "../../../../shared/trip";
import { apiPut } from "../../../../api";
import { isCanceledError } from "../../../../api/errors";
import { listTrips, changeTripStatus, deleteTripFromApi } from "../services/tripHeaderApiService";
import { clearStep5Draft } from "../../../../shared/trip/step5DraftStore";
import { sendTripDeliveryEmails } from "../services/deliveryEmailService";
import { translate } from "../../../../i18n";
import { notify as globalNotify } from "../../../../ui/notifications/notificationStore";

type NotificationFn = (message: string, type?: "success" | "error" | "info") => void;

export default function useTrips(
  showNotification?: NotificationFn,
  options?: { includeDeleted?: boolean }
) {
  const notify = useCallback(
    (message: string, type?: "success" | "error" | "info") =>
      // A caller-supplied notifier still wins. The fallback used to be a
      // blocking window.alert; it now uses the global notification store,
      // which is always mounted (NotificationHost in App), so this hook still
      // surfaces a real, dismissible toast when used outside a provider.
      showNotification
        ? showNotification(message, type)
        : type === "error"
          ? globalNotify.error(message)
          : type === "success"
            ? globalNotify.success(message)
            : globalNotify.info(message),
    [showNotification]
  );

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All");
  const [vehicle, setVehicle] = useState("All Vehicles");
  const [driver, setDriver] = useState("All");
  const [supervisor, setSupervisor] = useState("All Supervisors");
  const [farm, setFarm] = useState("All Sources");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const [trips, setTrips] = useState<Trip[]>([]);
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const includeDeleted = Boolean(options?.includeDeleted);
  const refreshSeqRef = useRef(0);
  const refreshAbortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);
  const operationLocksRef = useRef<Set<string>>(new Set());

  useEffect(() => () => {
    mountedRef.current = false;
    refreshSeqRef.current += 1;
    refreshAbortRef.current?.abort();
  }, []);

  const refreshTrips = useCallback(async (): Promise<boolean> => {
    const requestSeq = refreshSeqRef.current + 1;
    refreshSeqRef.current = requestSeq;
    refreshAbortRef.current?.abort();
    const controller = new AbortController();
    refreshAbortRef.current = controller;
    try {
      const nextTrips = await listTrips({ includeDeleted, signal: controller.signal });
      if (!mountedRef.current || controller.signal.aborted || requestSeq !== refreshSeqRef.current) return false;
      setTrips(nextTrips);
      return true;
    } catch (error) {
      if (isCanceledError(error) || !mountedRef.current || requestSeq !== refreshSeqRef.current) return false;
      notify(translate("ops.trip.unable_load_trips"), "error");
      return false;
    } finally {
      if (requestSeq === refreshSeqRef.current) refreshAbortRef.current = null;
    }
  }, [includeDeleted, notify]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void refreshTrips();
    });
    return () => {
      cancelled = true;
      refreshAbortRef.current?.abort();
    };
  }, [refreshTrips]);

  const acquireOperationLock = (key: string) => {
    if (operationLocksRef.current.has(key)) return false;
    operationLocksRef.current.add(key);
    return true;
  };
  const releaseOperationLock = (key: string) => {
    operationLocksRef.current.delete(key);
  };

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

  // ✅ Soft-delete via the backend API (PostgreSQL soft-delete). The Trip List /
  // Recent lifecycle is backend-authoritative and survives refresh — never
  // localStorage. `deleted` trips stay soft-deleted and never resurface.
  const deleteTrip = async (id: number, reason?: string) => {
    const lockKey = `delete:${id}`;
    if (!acquireOperationLock(lockKey)) return;
    try {
      await deleteTripFromApi(id, reason || translate("ops.trip.no_reason"));
      // Part K: a deleted trip's local Step 5 draft/queue is obsolete. Only this
      // trip's keys are removed — other trips' drafts are untouched.
      await clearStep5Draft(id).catch(() => {});
      await refreshTrips();
      notify(translate("ops.trip.deleted_success"), "success");
    } catch (err) {
      const msg = (err as { message?: string })?.message ?? translate("ops.trip.failed_delete_trip");
      notify(translate("ops.trip.failed_delete_trip_msg", { msg }), "error");
    } finally {
      releaseOperationLock(lockKey);
    }
  };

  // ✅ Persist a full-trip edit through the backend generic save. Kept for API
  // parity; the wizard uses submitStep endpoints, but any caller that replaces
  // a trip object now writes to PostgreSQL, not localStorage.
  const updateTrip = async (trip: Trip) => {
    const lockKey = `update:${trip.id}`;
    if (!acquireOperationLock(lockKey)) return undefined;
    try {
      const { data } = await apiPut<Record<string, unknown>>(
        `/trips/${trip.id}`,
        { ...trip, mode: "submit" }
      );
      await refreshTrips();
      notify(translate("ops.trip.updated_success"), "success");
      return data;
    } catch {
      notify(translate("ops.trip.failed_update_trip"), "error");
    } finally {
      releaseOperationLock(lockKey);
    }
  };

  // ✅ Updated: accept approvedBy parameter. Status transitions are validated and persisted by the backend API.
  const changeStatus = async (trip: Trip, status: TripStatus, approvedBy?: string) => {
    const lockKey = `status:${trip.id}:${status}`;
    if (!acquireOperationLock(lockKey)) return;
    try {
      const updated = await changeTripStatus(trip.id, status, approvedBy);
      await refreshTrips();
      notify(status === "Completed" ? translate("ops.trip.approved_success") : translate("ops.trip.status_updated"), "success");
      if (status === "Completed") {
        void sendTripDeliveryEmails(updated);
      }
    } catch (err) {
      const msg = (err as { message?: string })?.message ?? translate("ops.trip.failed_status_update");
      notify(translate("ops.trip.failed_status_update_msg", { msg }), "error");
    } finally {
      releaseOperationLock(lockKey);
    }
  };

  const recentTrips = useMemo(() => trips.slice(0, 5), [trips]);

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
