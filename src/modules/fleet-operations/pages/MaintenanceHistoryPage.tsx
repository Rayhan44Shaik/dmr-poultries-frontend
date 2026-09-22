import { memo, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, CalendarClock, History } from "lucide-react";
import { useSafeNotification } from "../../../hooks/useSafeNotification";
import { useI18n } from "../../../i18n";
import { apiGet } from "../../../api";
import ErrorBoundary from "../components/common/ErrorBoundary";
import MaintenanceFilters, {
  type MaintenanceSortKey,
} from "../components/maintenance/MaintenanceFilters";
import MaintenanceKPICards from "../components/maintenance/MaintenanceKPICards";
import MaintenanceTimeline, {
  MaintenanceTimelineSkeleton,
  type VehicleMeterEvent,
} from "../components/maintenance/MaintenanceTimeline";
import UpcomingServices from "../components/maintenance/UpcomingServices";
import { useMaintenanceData } from "../hooks/useMaintenanceData";
import { formatVehicleNumber } from "../../../utils/format";
import { MAINTENANCE_TYPES } from "../utils/constants";
import { useEmployees } from "../../masters/employees/hooks/useEmployees";
import type { MaintenanceEvent } from "../types";

interface MaintenanceHistoryPageProps {
  embedded?: boolean;
}

function sortMaintenanceRecords(
  records: readonly MaintenanceEvent[],
  sortDir: "asc" | "desc",
): MaintenanceEvent[] {
  // Timeline sorting is intentionally calendar-only: a timeline must preserve
  // a truthful chronological sequence when maintenance and meter events meet.
  const multiplier = sortDir === "asc" ? 1 : -1;
  return [...records].sort(
    (left, right) =>
      String(left.date || left.createdAt || "")
        .slice(0, 10)
        .localeCompare(
          String(right.date || right.createdAt || "").slice(0, 10),
        ) * multiplier,
  );
}

const meterDateKey = (event: VehicleMeterEvent) =>
  String(event.eventDate || event.eventInstant || "").slice(0, 10);

/**
 * The history feed is a submitted-record view. Trip start/end rows and fuel
 * rows linked to a trip must never leak Draft/Pending workflow data into it.
 * Standalone fuel bills remain valid timeline events and have no tripStatus.
 */
const isSubmittedTripMeterEvent = (event: VehicleMeterEvent) =>
  event.sourceType === "TRIP_START" || event.sourceType === "TRIP_END"
    ? event.tripStatus === "Approved" || event.tripStatus === "Completed"
    : event.sourceType === "FUEL"
      ? event.tripStatus == null || event.tripStatus === "Approved" || event.tripStatus === "Completed"
      : true;

const withinDateRange = (
  date: string,
  fromDate: string,
  toDate: string,
) =>
  Boolean(date) &&
  (!fromDate || date >= fromDate) &&
  (!toDate || date <= toDate);

/**
 * Sum only approved/completed trips whose start and end readings are inside the active
 * calendar range. This avoids inventing partial-trip mileage at a range edge
 * and keeps the KPI equal to the trip distances shown in the timeline.
 */
function completedTripDistance(
  meterEvents: readonly VehicleMeterEvent[],
  fromDate: string,
  toDate: string,
): number {
  const trips = new Map<
    string,
    { start?: VehicleMeterEvent; end?: VehicleMeterEvent }
  >();

  meterEvents.forEach((event) => {
    if (event.sourceType !== "TRIP_START" && event.sourceType !== "TRIP_END") {
      return;
    }
    const key = `${event.vehicleId}:${event.ref}`;
    const trip = trips.get(key) || {};
    if (event.sourceType === "TRIP_START") trip.start = event;
    if (event.sourceType === "TRIP_END") trip.end = event;
    trips.set(key, trip);
  });

  return Math.round(
    [...trips.values()].reduce((total, trip) => {
      const start = trip.start;
      const end = trip.end;
      if (
        !start ||
        !end ||
        !withinDateRange(meterDateKey(start), fromDate, toDate) ||
        !withinDateRange(meterDateKey(end), fromDate, toDate)
      ) {
        return total;
      }
      const distance = Number(end.meter) - Number(start.meter);
      return Number.isFinite(distance) && distance > 0 ? total + distance : total;
    }, 0),
  );
}

const MaintenanceHistoryPage = ({
  embedded = false,
}: MaintenanceHistoryPageProps) => {
  const { t } = useI18n();
  const { employees } = useEmployees();
  const { showNotification } = useSafeNotification();
  const data = useMaintenanceData('history');
  const [meterEvents, setMeterEvents] = useState<VehicleMeterEvent[]>([]);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const refreshRequested = useRef(false);

  // Drivers remain available from the master even when a narrow date/type
  // filter has no rows. Historic names stay searchable when someone has left.
  const driverOptions = useMemo(() => {
    const options = new Map<string, { value: string; label: string }>();
    employees
      .filter(
        (employee) =>
          String(employee.department || "")
            .trim()
            .toLowerCase() === "driver",
      )
      .forEach((employee) => {
        const value = String(employee.id || "");
        const label = String(employee.employeeName || "").trim();
        if (value && label) options.set(value, { value, label });
      });
    data.drivers.forEach((driver) => {
      if (!options.has(driver.id)) {
        options.set(driver.id, { value: driver.id, label: driver.name });
      }
    });
    return [...options.values()].sort((left, right) =>
      left.label.localeCompare(right.label),
    );
  }, [data.drivers, employees]);

  const maintenanceTypes = useMemo(
    () =>
      [...new Set([...MAINTENANCE_TYPES, ...data.maintenanceTypes])].sort(
        (left, right) => left.localeCompare(right),
      ),
    [data.maintenanceTypes],
  );

  const vehicleOptions = useMemo(
    () =>
      data.vehicles
        .map((vehicle) => {
          const value = String(vehicle.id || "");
          const vehicleNumber = String(
            vehicle.vehicleNumber || vehicle.vehicleNo || "",
          ).trim();
          return value && vehicleNumber
            ? {
                value,
                label: formatVehicleNumber(vehicleNumber),
                searchText: vehicleNumber,
              }
            : null;
        })
        .filter(
          (
            option,
          ): option is { value: string; label: string; searchText: string } =>
            option !== null,
        ),
    [data.vehicles],
  );

  // The secondary timeline mixes approved maintenance with trip/fuel odometer
  // events. Its meter ledger remains scoped to the selected vehicle(s).
  useEffect(() => {
    let cancelled = false;
    if (data.selectedVehicle === "all") {
      const ids = data.vehicles
        .map((vehicle) => Number(vehicle.id))
        .filter(Boolean);
      if (ids.length === 0) return;
      Promise.all(
        ids.map((id) =>
          apiGet<VehicleMeterEvent[]>(`/fleet/vehicles/${id}/meter-history`)
            .then((response) => response.data || [])
            .catch(() => []),
        ),
      )
        .then((lists) => {
          if (!cancelled) {
            setMeterEvents(
              lists
                .flat()
                .filter(
                  (event) =>
                    event.sourceType !== "MAINTENANCE" &&
                    isSubmittedTripMeterEvent(event),
                ),
            );
          }
        })
        .catch(() => {
          if (!cancelled) setMeterEvents([]);
        });
    } else {
      apiGet<VehicleMeterEvent[]>(
        `/fleet/vehicles/${data.selectedVehicle}/meter-history`,
      )
        .then((response) => {
          if (!cancelled) {
            setMeterEvents(
              (response.data || []).filter(
                (event) =>
                  event.sourceType !== "MAINTENANCE" &&
                  isSubmittedTripMeterEvent(event),
              ),
            );
          }
        })
        .catch(() => {
          if (!cancelled) setMeterEvents([]);
        });
    }
    return () => {
      cancelled = true;
    };
  }, [data.selectedVehicle, data.vehicles]);

  const resultsReady = !data.historyLoading && !data.historyError;
  const filteredMeterEvents = useMemo(() => {
    if (!data.fromDate && !data.toDate) return meterEvents;
    return meterEvents.filter((event) => {
      const date = String(event.eventDate || "").slice(0, 10);
      if (!date) return true;
      if (data.fromDate && date < data.fromDate) return false;
      if (data.toDate && date > data.toDate) return false;
      return true;
    });
  }, [data.fromDate, data.toDate, meterEvents]);

  const timelineEvents = useMemo(() => {
    const filteredApproved = data.filtered.filter(
      (record) => record.paymentStatus === "approved" && !record.deletedAt,
    );
    const source = data.hasActiveFilters
      ? filteredApproved
      : data.approvedHistory.length
        ? data.approvedHistory
        : filteredApproved;
    return sortMaintenanceRecords(source, sortDir);
  }, [
    data.approvedHistory,
    data.filtered,
    data.hasActiveFilters,
    sortDir,
  ]);

  const timelineStats = useMemo(
    () => ({
      totalCost: timelineEvents.reduce(
        (sum, record) => sum + Number(record.totalCost || 0),
        0,
      ),
      totalServices: timelineEvents.length,
      totalDistance: completedTripDistance(
        meterEvents,
        data.fromDate,
        data.toDate,
      ),
    }),
    [data.fromDate, data.toDate, meterEvents, timelineEvents],
  );

  const visibleUpcoming = useMemo(() => {
    let services = data.upcomingServices;
    if (data.selectedVehicle !== "all") {
      services = services.filter(
        (item) => String(item.vehicle?.id) === String(data.selectedVehicle),
      );
    }
    if (data.fromDate || data.toDate) {
      services = services.filter((item) => {
        const date = String(item.lastMaint?.date || "").slice(0, 10);
        if (!date) return true;
        if (data.fromDate && date < data.fromDate) return false;
        if (data.toDate && date > data.toDate) return false;
        return true;
      });
    }
    return services;
  }, [data.fromDate, data.selectedVehicle, data.toDate, data.upcomingServices]);

  // A refresh toast is emitted after the replacement response completes, never
  // at click time, so a failed refresh cannot appear successful.
  useEffect(() => {
    if (!refreshRequested.current || data.historyLoading) return;
    refreshRequested.current = false;
    if (!data.historyError) {
      showNotification(t("notification.data_refreshed"), "success");
    }
  }, [data.historyError, data.historyLoading, showNotification, t]);

  const updateFilter = (update: () => void) => update();

  const updateSort = (
    _nextSortBy: MaintenanceSortKey,
    nextSortDir: "asc" | "desc",
  ) => {
    setSortDir(nextSortDir);
  };

  const resetFilters = () => {
    data.resetFilters();
    updateSort("date", "desc");
    showNotification(t("fleet.maintenance_history.filters_reset"), "info");
  };

  const handleRefresh = () => {
    if (data.historyLoading) return;
    refreshRequested.current = true;
    data.refresh();
  };

  /* Trip-List-style section heading: gradient bar + logo tile + bold title,
     so the Approved Timeline reads like the Trip List / Order registers. */
  const approvedHeader = (
    <div className="flex items-center border-b border-slate-100 bg-gradient-to-r from-emerald-50/60 via-white to-emerald-50/40 px-5 py-3">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-100 bg-emerald-50 text-emerald-600 shadow-inner">
          <History className="h-4 w-4" />
        </div>
        <div>
          <h2 className="text-base font-bold tracking-tight text-slate-800">
            {t("fleet.maintenance_history.approved_timeline")}
          </h2>
          <p className="mt-0.5 text-[11px] font-medium text-slate-500">
            Completed trips and approved maintenance, in chronological order
          </p>
        </div>
      </div>
    </div>
  );
  const upcomingHeader = (
    <div className="flex items-center border-b border-slate-100 bg-gradient-to-r from-emerald-50/60 via-white to-emerald-50/40 px-5 py-3">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-100 bg-emerald-50 text-emerald-600 shadow-inner">
          <CalendarClock className="h-4 w-4" />
        </div>
        <h2 className="text-base font-bold tracking-tight text-slate-800">
          {t("fleet.maintenance_history.upcoming_service")}
        </h2>
      </div>
    </div>
  );

  return (
    <ErrorBoundary>
      <div
        className={`w-full space-y-5 animate-in fade-in duration-200 ${
          embedded
            ? ""
            : "min-h-screen bg-slate-50/50 px-3 py-4 text-slate-800 md:px-6"
        }`}
      >
        <MaintenanceFilters
          fromDate={data.fromDate}
          toDate={data.toDate}
          vehicle={data.selectedVehicle === "all" ? "" : data.selectedVehicle}
          driver={data.selectedDriver === "all" ? "" : data.selectedDriver}
          maintenanceType={
            data.selectedMaintenanceType === "all"
              ? ""
              : data.selectedMaintenanceType
          }
          sortBy="date"
          sortDir={sortDir}
          search={data.searchQuery}
          vehicles={vehicleOptions}
          drivers={driverOptions}
          maintenanceTypes={maintenanceTypes}
          loading={data.historyLoading}
          setFromDate={(value) => updateFilter(() => data.setFromDate(value))}
          setToDate={(value) => updateFilter(() => data.setToDate(value))}
          setVehicle={(value) =>
            updateFilter(() => data.setSelectedVehicle(value || "all"))
          }
          setDriver={(value) =>
            updateFilter(() => data.setSelectedDriver(value || "all"))
          }
          setMaintenanceType={(value) =>
            updateFilter(() => data.setSelectedMaintenanceType(value || "all"))
          }
          setSort={updateSort}
          setSearch={(value) => updateFilter(() => data.setSearchQuery(value))}
          onReset={resetFilters}
          onRefresh={handleRefresh}
        />


        {resultsReady ? (
          <MaintenanceKPICards {...timelineStats} />
        ) : !data.historyError && !data.error ? (
          /* The KPI row loads in place with the same pulse as the Trip List. */
          <div
            className="grid grid-cols-1 gap-4 sm:grid-cols-3"
            role="status"
            aria-busy="true"
          >
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-24 animate-pulse rounded-2xl border border-slate-200 bg-white shadow-sm"
              />
            ))}
          </div>
        ) : null}

        {data.historyError || data.error ? (
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            <span className="flex items-center gap-2">
              <AlertCircle size={17} />
              {data.historyError || data.error}
            </span>
            <button
              type="button"
              onClick={handleRefresh}
              className="font-bold underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
            >
              {t("common.retry")}
            </button>
          </div>
        ) : null}

        {resultsReady ? (
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm xl:col-span-2">
              {approvedHeader}
              <div className="p-5">
                <MaintenanceTimeline
                  events={timelineEvents}
                  meterEvents={filteredMeterEvents}
                  vehicles={data.vehicles}
                  vehicleHistory={
                    data.approvedHistory.length
                      ? data.approvedHistory
                      : timelineEvents
                  }
                  hasActiveFilters={data.hasActiveFilters}
                  sortDirection={sortDir}
                  onClearFilters={resetFilters}
                />
              </div>
            </section>
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              {upcomingHeader}
              <div className="p-5">
                <UpcomingServices services={visibleUpcoming} />
              </div>
            </section>
          </div>
        ) : !data.historyError && !data.error ? (
          /* While the history loads, the very same shells show animated
             skeleton rows — exactly how the Trip List / Order Assignment
             registers fill in place. */
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm xl:col-span-2">
              {approvedHeader}
              <div className="p-5">
                <MaintenanceTimelineSkeleton rows={4} />
                <p className="pt-2 text-center text-sm font-medium text-slate-400">
                  <span className="inline-flex items-center gap-2">
                    <span
                      className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-emerald-600"
                      aria-hidden="true"
                    />
                    {t("fleet.maintenance_history.loading_timeline")}
                  </span>
                </p>
              </div>
            </section>
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              {upcomingHeader}
              <div className="space-y-3 p-5" role="status" aria-busy="true">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-16 animate-pulse rounded-xl border border-slate-200/70 bg-slate-50"
                  />
                ))}
                <p className="pt-1 text-center text-xs font-medium text-slate-400">
                  {t("fleet.maintenance_history.loading_upcoming")}
                </p>
              </div>
            </section>
          </div>
        ) : null}
      </div>
    </ErrorBoundary>
  );
};

export default memo(MaintenanceHistoryPage);
