import { memo, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, History } from "lucide-react";
import { Pagination } from "../../../ui";
import { useSafeNotification } from "../../../hooks/useSafeNotification";
import { useI18n } from "../../../i18n";
import { apiGet } from "../../../api";
import { shouldShowPagination } from "../../../shared/ui/paginationStyles";
import { PAGINATION_DEFAULT_PAGE_SIZE } from "../../../shared/ui/uiTokens";
import ErrorBoundary from "../components/common/ErrorBoundary";
import MaintenanceFilters from "../components/maintenance/MaintenanceFilters";
import MaintenanceKPICards from "../components/maintenance/MaintenanceKPICards";
import MaintenanceMasterTable, {
  type MaintenanceSortKey,
} from "../components/maintenance/MaintenanceMasterTable";
import MaintenanceTimeline, {
  type VehicleMeterEvent,
} from "../components/maintenance/MaintenanceTimeline";
import UpcomingServices from "../components/maintenance/UpcomingServices";
import ViewModal from "../components/maintenance/ViewModal";
import { useMaintenanceData } from "../hooks/useMaintenanceData";
import { formatVehicleNumber } from "../../../utils/format";
import { MAINTENANCE_TYPES } from "../utils/constants";
import { safeDate } from "../utils/maintenanceHelpers";
import { useEmployees } from "../../masters/employees/hooks/useEmployees";
import type { MaintenanceEvent } from "../types";

interface MaintenanceHistoryPageProps {
  embedded?: boolean;
}

function recordStatus(
  record: MaintenanceEvent,
): "Approved" | "Pending" | "Deleted" {
  if (record.deletedAt) return "Deleted";
  return record.paymentStatus === "approved" ? "Approved" : "Pending";
}

function comparableValue(
  record: MaintenanceEvent,
  key: MaintenanceSortKey,
): string | number {
  switch (key) {
    case "currentKM":
      return Number(record.currentKM || 0);
    case "totalCost":
      return Number(record.totalCost || 0);
    case "status":
      return recordStatus(record);
    case "date":
      return String(record.date || record.createdAt || "").slice(0, 10);
    default:
      return String(record[key] || "");
  }
}

/** Sorting is local because every loaded page is already part of the exact
 * active result. A deterministic newest-first fallback matches maintenance
 * operators' workflow while the sort dropdown remains visibly unselected. */
function sortMaintenanceRecords(
  records: readonly MaintenanceEvent[],
  sortBy: MaintenanceSortKey | null,
  sortDir: "asc" | "desc",
): MaintenanceEvent[] {
  const key = sortBy ?? "date";
  const direction = sortBy ? sortDir : "desc";
  const multiplier = direction === "asc" ? 1 : -1;
  return [...records].sort((left, right) => {
    const leftValue = comparableValue(left, key);
    const rightValue = comparableValue(right, key);
    if (typeof leftValue === "number" && typeof rightValue === "number") {
      return (leftValue - rightValue) * multiplier;
    }
    return (
      String(leftValue).localeCompare(String(rightValue), undefined, {
        numeric: true,
        sensitivity: "base",
      }) * multiplier
    );
  });
}

function KpiSkeleton() {
  const { t } = useI18n();
  return (
    <section
      className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5"
      aria-label={t("common.loading")}
      aria-busy="true"
    >
      {Array.from({ length: 5 }, (_, index) => (
        <div
          key={index}
          className="min-h-[6.75rem] animate-pulse rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-3 pt-1">
              <span className="block h-2.5 w-20 rounded bg-slate-100" />
              <span className="block h-6 w-16 rounded bg-slate-100" />
            </div>
            <span className="block h-11 w-11 rounded-xl bg-slate-100" />
          </div>
        </div>
      ))}
    </section>
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
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGINATION_DEFAULT_PAGE_SIZE);
  const [sortBy, setSortBy] = useState<MaintenanceSortKey | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [viewRecord, setViewRecord] = useState<MaintenanceEvent | null>(null);
  const refreshRequested = useRef(false);
  const tableContainerRef = useRef<HTMLElement>(null);
  const viewButtonRef = useRef<HTMLButtonElement>(null);

  // Drivers remain available from the master even when the current date/status
  // filter returns no rows. Historic record drivers are merged in so a driver
  // who has since left the master can still be used to find their records.
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
      if (!options.has(driver.id))
        options.set(driver.id, { value: driver.id, label: driver.name });
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

  // Trip/Fuel meter events for the timeline. When a single vehicle is selected
  // we hit its ledger; with "All Vehicles" selected, merge the independent
  // ledgers so the secondary timeline remains complete.
  useEffect(() => {
    let cancelled = false;
    if (data.selectedVehicle === "all") {
      const ids = (data.vehicles || [])
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
          if (cancelled) return;
          setMeterEvents(
            lists.flat().filter((event) => event.sourceType !== "MAINTENANCE"),
          );
        })
        .catch(() => {
          if (!cancelled) setMeterEvents([]);
        });
      return () => {
        cancelled = true;
      };
    }

    apiGet<VehicleMeterEvent[]>(
      `/fleet/vehicles/${data.selectedVehicle}/meter-history`,
    )
      .then((response) => {
        if (!cancelled) {
          setMeterEvents(
            (response.data || []).filter(
              (event) => event.sourceType !== "MAINTENANCE",
            ),
          );
        }
      })
      .catch(() => {
        if (!cancelled) setMeterEvents([]);
      });
    return () => {
      cancelled = true;
    };
  }, [data.selectedVehicle, data.vehicles]);

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

  const resultsReady = !data.historyLoading && !data.historyError;
  const sortedRecords = useMemo(
    () => sortMaintenanceRecords(data.filtered, sortBy, sortDir),
    [data.filtered, sortBy, sortDir],
  );
  const safePage = Math.min(
    currentPage,
    Math.max(1, Math.ceil(sortedRecords.length / pageSize)),
  );
  const paginatedRecords = useMemo(
    () =>
      sortedRecords.slice((safePage - 1) * pageSize, safePage * pageSize),
    [pageSize, safePage, sortedRecords],
  );
  const activeSelectedRecordId = selectedRecordId && sortedRecords.some(
    (record) => String(record.id) === selectedRecordId,
  ) ? selectedRecordId : null;

  // Match the Trip List selection contract: clicking outside the table or its
  // View action returns the list to an unselected state.
  useEffect(() => {
    const clearSelectionOutsideTable = (event: MouseEvent) => {
      const target = event.target as Node;
      if (tableContainerRef.current?.contains(target) || viewButtonRef.current?.contains(target)) return;
      setSelectedRecordId(null);
    };
    document.addEventListener("mousedown", clearSelectionOutsideTable);
    return () => document.removeEventListener("mousedown", clearSelectionOutsideTable);
  }, []);

  // A refresh toast is emitted only after the new response completes, never at
  // click time. That prevents a false success signal when the API rejects it.
  useEffect(() => {
    if (!refreshRequested.current || data.historyLoading) return;
    refreshRequested.current = false;
    if (data.historyError) return;
    showNotification(t("notification.data_refreshed"), "success");
  }, [data.historyError, data.historyLoading, showNotification, t]);

  const resetFilters = () => {
    data.resetFilters();
    setSortBy(null);
    setSortDir("asc");
    setCurrentPage(1);
    setSelectedRecordId(null);
    showNotification(t("fleet.maintenance_history.filters_reset"), "info");
  };

  const updateFilter = (update: () => void) => {
    update();
    setCurrentPage(1);
    setSelectedRecordId(null);
  };

  const updateSort = (
    nextSortBy: MaintenanceSortKey | null,
    nextSortDir: "asc" | "desc",
  ) => {
    setSortBy(nextSortBy);
    setSortDir(nextSortBy ? nextSortDir : "asc");
    setCurrentPage(1);
    setSelectedRecordId(null);
  };

  const handleColumnSort = (key: MaintenanceSortKey) => {
    if (sortBy !== key) {
      updateSort(key, "asc");
    } else if (sortDir === "asc") {
      updateSort(key, "desc");
    } else {
      updateSort(null, "asc");
    }
  };

  const handleRefresh = () => {
    if (data.historyLoading) return;
    refreshRequested.current = true;
    setSelectedRecordId(null);
    data.refresh();
  };

  const openSelectedRecord = () => {
    const selected = sortedRecords.find(
      (record) => String(record.id) === activeSelectedRecordId,
    );
    if (!selected) {
      showNotification(t("fleet.maintenance_history.select_record"), "info");
      return;
    }
    setViewRecord(selected);
    setSelectedRecordId(null);
  };

  const activeTimelineRecords = useMemo(() => {
    const source = data.hasActiveFilters
      ? data.filtered.filter(
          (record) => record.paymentStatus === "approved" && !record.deletedAt,
        )
      : data.approvedHistory;
    return [...source].sort(
      (left, right) =>
        safeDate(right.date).getTime() - safeDate(left.date).getTime(),
    );
  }, [data.approvedHistory, data.filtered, data.hasActiveFilters]);

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

  const vehicleHistory = useMemo(() => {
    if (!viewRecord) return [];
    return data.approvedHistory
      .filter(
        (record) => String(record.vehicleId) === String(viewRecord.vehicleId),
      )
      .sort(
        (left, right) =>
          safeDate(right.date).getTime() - safeDate(left.date).getTime(),
      );
  }, [data.approvedHistory, viewRecord]);

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
          serviceType={
            data.selectedServiceType === "all" ? "" : data.selectedServiceType
          }
          status={data.selectedStatus === "all" ? "" : data.selectedStatus}
          sortBy={sortBy}
          sortDir={sortDir}
          search={data.searchQuery}
          vehicles={vehicleOptions}
          drivers={driverOptions}
          maintenanceTypes={maintenanceTypes}
          serviceTypes={data.serviceTypes}
          resultCount={data.filtered.length}
          loading={data.historyLoading}
          showViewButton={activeSelectedRecordId !== null}
          viewButtonRef={viewButtonRef}
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
          setServiceType={(value) =>
            updateFilter(() => data.setSelectedServiceType(value || "all"))
          }
          setStatus={(value) =>
            updateFilter(() => data.setSelectedStatus(value || "all"))
          }
          setSort={updateSort}
          setSearch={(value) => updateFilter(() => data.setSearchQuery(value))}
          onReset={resetFilters}
          onRefresh={handleRefresh}
          onViewSelected={openSelectedRecord}
        />

        {resultsReady ? (
          <MaintenanceKPICards
            totalRecords={data.historyStats.total}
            totalCost={data.historyStats.totalCost}
            vehiclesServiced={data.historyStats.vehiclesServiced}
            approved={data.historyStats.approved}
            pending={data.historyStats.pending}
          />
        ) : data.historyLoading ? (
          <KpiSkeleton />
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

        <section ref={tableContainerRef} className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white text-xs shadow-sm md:text-sm">
          <div className="flex items-center border-b border-slate-100 bg-gradient-to-r from-blue-50/60 via-white to-blue-50/40 px-5 py-3 sm:px-6">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-blue-100 bg-blue-50/70 text-blue-500 shadow-inner">
                <History size={19} aria-hidden="true" />
              </span>
              <h2 className="text-base font-bold tracking-tight text-slate-800">
                {t("nav.maintenanceHistory")}
              </h2>
            </div>
          </div>
          <MaintenanceMasterTable
            records={resultsReady ? paginatedRecords : []}
            vehicles={data.vehicles}
            isLoading={data.historyLoading}
            selectedRecordId={activeSelectedRecordId}
            onRowClick={(record) =>
              setSelectedRecordId((current) =>
                current === String(record.id) ? null : String(record.id),
              )
            }
            onRowSelect={(record) => setSelectedRecordId(String(record.id))}
            startIndex={(safePage - 1) * pageSize}
            sortBy={sortBy}
            sortDir={sortDir}
            onSortChange={handleColumnSort}
          />
          {resultsReady && shouldShowPagination(sortedRecords.length) ? (
            <Pagination
              page={safePage}
              pageSize={pageSize}
              totalItems={sortedRecords.length}
              onPageChange={setCurrentPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setCurrentPage(1);
              }}
              ariaLabel={t("nav.maintenanceHistory")}
            />
          ) : null}
        </section>

        {resultsReady ? (
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm xl:col-span-2">
              <div className="border-b border-slate-100 px-5 py-4">
                <h3 className="text-sm font-bold text-slate-800">
                  {t("fleet.maintenance_history.approved_timeline")}
                </h3>
              </div>
              <div className="p-5">
                <MaintenanceTimeline
                  events={activeTimelineRecords}
                  meterEvents={filteredMeterEvents}
                  vehicles={data.vehicles}
                  hasActiveFilters={data.hasActiveFilters}
                  onClearFilters={resetFilters}
                />
              </div>
            </section>
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-5 py-4">
                <h3 className="text-sm font-bold text-slate-800">
                  {t("fleet.maintenance_history.upcoming_service")}
                </h3>
              </div>
              <div className="p-5">
                <UpcomingServices services={visibleUpcoming} />
              </div>
            </section>
          </div>
        ) : null}
      </div>

      {viewRecord ? (
        <ViewModal
          record={viewRecord}
          vehicles={data.vehicles}
          vehicleHistory={vehicleHistory}
          onClose={() => setViewRecord(null)}
        />
      ) : null}
    </ErrorBoundary>
  );
};

export default memo(MaintenanceHistoryPage);
