import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { History } from "lucide-react";
import TripFilters from "../components/TripFilters";
import TripKPICards from "../components/TripKPICards";
import TripMasterTable, { type TripSortKey } from "../components/TripMasterTable";
import { TripHistoryViewModal } from "../components/TripViewModal";
import { shouldShowPagination } from "../../../../shared/ui/paginationStyles";
import { Pagination } from "../../../../ui";
import { PAGINATION_DEFAULT_PAGE_SIZE } from "../../../../shared/ui/uiTokens";

import { useSafeNotification } from "../../../../hooks/useSafeNotification";
import { exportToPDF, exportToExcel } from "../../../../utils/exportUtils";
import { useVehicles } from "../../../masters/vehicles/hooks/useVehicles";
import { useEmployees } from "../../../masters/employees/hooks/useEmployees";
import { useFarms } from "../../../masters/farms/hooks/useFarms";
import { useShops } from "../../../masters/shops/hooks/useShops";
import { useBirdTypes } from "../../../masters/bird-types/hooks/useBirdTypes";

import type { Trip } from "../types/trip";
import {
  listCompletedTrips,
  loadTripById,
  uniqueTripsById,
} from "../services/tripHeaderApiService";
import { isCanceledError } from "../../../../api/errors";
import { useI18n } from "../../../../i18n";
import { filterTripListTrips, sortTripListTrips } from "../utils/filterTripList";
import { formatVehicleNumber } from "../../../../utils/format";

type TripListPageProps = { embedded?: boolean };
type FilterOption = { value: string; label: string; searchText?: string };

const ALL_VEHICLES = "All Vehicles";
const ALL_SUPERVISORS = "All Supervisors";
const ALL_SOURCES = "All Sources";
const TRIP_LIST_FETCH_PAGE_SIZE = 200;

function numericFilter(value: string, sentinel: string): number | undefined {
  if (value === sentinel) return undefined;
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : undefined;
}

function selectedOptionLabel(options: readonly FilterOption[], value: string, fallback: string): string {
  return options.find((option) => option.value === value)?.label ?? fallback;
}

/**
 * Loads the shop / bird-type masters the view modal needs. Kept as a separate
 * component so those requests only fire once the modal is actually opened,
 * instead of on every Trip List page load.
 */
function TripViewModalWithMasters({
  trip,
  onClose,
}: {
  trip: Trip | null;
  onClose: () => void;
}) {
  const { shops } = useShops();
  const { birdTypes } = useBirdTypes();
  return (
    <TripHistoryViewModal open trip={trip} shops={shops} birdTypes={birdTypes} onClose={onClose} />
  );
}

function TripListPage({ embedded = false }: TripListPageProps) {
  const { t } = useI18n();
  const { showNotification } = useSafeNotification();

  const [trips, setTrips] = useState<Trip[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  /** True only once the current filter request has supplied its final totals. */
  const [filterResultsReady, setFilterResultsReady] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState("");
  const [vehicle, setVehicle] = useState(ALL_VEHICLES);
  const [supervisor, setSupervisor] = useState(ALL_SUPERVISORS);
  const [farm, setFarm] = useState(ALL_SOURCES);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [pageSize, setPageSize] = useState(PAGINATION_DEFAULT_PAGE_SIZE);
  const [sortBy, setSortBy] = useState<TripSortKey | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [viewOpen, setViewOpen] = useState(false);
  const [selectedRowId, setSelectedRowId] = useState<number | null>(null);
  const listRequestSeqRef = useRef(0);
  const listAbortRef = useRef<AbortController | null>(null);
  const viewRequestSeqRef = useRef(0);
  const exportBusyRef = useRef<"pdf" | "excel" | null>(null);

  const refreshTrips = useCallback(async (): Promise<boolean> => {
    const requestSeq = listRequestSeqRef.current + 1;
    listRequestSeqRef.current = requestSeq;
    listAbortRef.current?.abort();
    const controller = new AbortController();
    listAbortRef.current = controller;
    // Do not leave the previous filter's totals on screen while this request
    // is in flight — they can be dramatically different from the next result.
    setFilterResultsReady(false);
    setIsLoading(true);

    try {
      const filters = {
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        vehicleId: numericFilter(vehicle, ALL_VEHICLES),
        supervisorId: numericFilter(supervisor, ALL_SUPERVISORS),
        farmId: numericFilter(farm, ALL_SOURCES),
        sortBy: sortBy ?? undefined,
        sortDir: sortBy ? sortDir : undefined,
        signal: controller.signal,
      };

      // Retrieve every matching page before applying the visible filters. Some
      // deployed API versions accept the filter query but return all records;
      // the client-side pass below prevents that response from leaking into the
      // table, totals, exports, or paginator.
      const fetchedTrips: Trip[] = [];
      let page = 1;
      let totalPages = 1;
      do {
        const result = await listCompletedTrips({
          ...filters,
          page,
          limit: TRIP_LIST_FETCH_PAGE_SIZE,
        });
        if (controller.signal.aborted || requestSeq !== listRequestSeqRef.current) return false;
        fetchedTrips.push(...result.data);
        totalPages = Math.max(1, result.meta.totalPages);
        page += 1;
      } while (page <= totalPages);

      const matchingTrips = sortTripListTrips(
        filterTripListTrips(uniqueTripsById(fetchedTrips), filters),
        sortBy,
        sortDir,
      );
      setTrips(matchingTrips);
      setFilterResultsReady(true);
      setSelectedRowId((selectedId) =>
        selectedId != null && !matchingTrips.some((trip) => trip.id === selectedId) ? null : selectedId
      );
      return true;
    } catch (error) {
      if (isCanceledError(error) || requestSeq !== listRequestSeqRef.current) return false;
      showNotification(t("ops.trip.unable_load_trips"), "error");
      return false;
    } finally {
      if (requestSeq === listRequestSeqRef.current) {
        listAbortRef.current = null;
        setIsLoading(false);
      }
    }
  }, [showNotification, t, fromDate, toDate, vehicle, supervisor, farm, sortBy, sortDir]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void refreshTrips();
    });
    return () => {
      cancelled = true;
      listAbortRef.current?.abort();
    };
  }, [refreshTrips]);

  const resetFilters = () => {
    setFilterResultsReady(false);
    setSearch("");
    setVehicle(ALL_VEHICLES);
    setSupervisor(ALL_SUPERVISORS);
    setFarm(ALL_SOURCES);
    setFromDate("");
    setToDate("");
    setSortBy(null);
    setSortDir("asc");
    setCurrentPage(1);
  };

  const tableContainerRef = useRef<HTMLDivElement>(null);
  const viewButtonRef = useRef<HTMLButtonElement>(null);

  const setFilterSearch = useCallback((value: string) => {
    setSearch(value);
    setSelectedRowId(null);
    setCurrentPage(1);
  }, []);
  const setFilterFromDate = useCallback((value: string) => {
    setFilterResultsReady(false);
    setFromDate(value);
    setCurrentPage(1);
  }, []);
  const setFilterToDate = useCallback((value: string) => {
    setFilterResultsReady(false);
    setToDate(value);
    setCurrentPage(1);
  }, []);
  const setFilterVehicle = useCallback((value: string) => {
    setFilterResultsReady(false);
    setVehicle(value || ALL_VEHICLES);
    setCurrentPage(1);
  }, []);
  const setFilterSupervisor = useCallback((value: string) => {
    setFilterResultsReady(false);
    setSupervisor(value || ALL_SUPERVISORS);
    setCurrentPage(1);
  }, []);
  const setFilterFarm = useCallback((value: string) => {
    setFilterResultsReady(false);
    setFarm(value || ALL_SOURCES);
    setCurrentPage(1);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        tableContainerRef.current?.contains(target) ||
        viewButtonRef.current?.contains(target)
      ) {
        return;
      }
      setSelectedRowId(null);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => () => {
    viewRequestSeqRef.current += 1;
  }, []);

  const { vehicles: masterVehicles } = useVehicles();
  const { employees: masterEmployees } = useEmployees();
  const { farms: masterFarms } = useFarms();

  const vehicleOptions = useMemo<FilterOption[]>(() => {
    const seen = new Set<string>();
    return masterVehicles.flatMap((vehicleRecord) => {
      const value = String(vehicleRecord.id || "");
      const label = String(vehicleRecord.vehicleNumber || "").trim();
      const active = String(vehicleRecord.status ?? "Active") !== "Inactive";
      if (!value || !label || !active || seen.has(value)) return [];
      seen.add(value);
      return [{ value, label: formatVehicleNumber(label), searchText: label }];
    });
  }, [masterVehicles]);

  const supervisorOptions = useMemo<FilterOption[]>(() => {
    const seen = new Set<string>();
    return masterEmployees.flatMap((employee) => {
      const roleText = `${employee.department || ""} ${employee.role || ""}`.toLowerCase();
      const isSupervisor = roleText.includes("supervisor");
      const value = String(employee.id || "");
      const label = String(employee.employeeName || "").trim();
      const active = String(employee.status ?? "Active") !== "Inactive";
      if (!isSupervisor || !value || !label || !active || seen.has(value)) return [];
      seen.add(value);
      return [{ value, label }];
    });
  }, [masterEmployees]);

  const farmOptions = useMemo<FilterOption[]>(() => {
    const seen = new Set<string>();
    return masterFarms.flatMap((farmRecord) => {
      const value = String(farmRecord.id || "");
      const label = String(farmRecord.farmName || "").trim();
      const active = String(farmRecord.status ?? "Active") !== "Inactive";
      if (!value || !label || !active || seen.has(value)) return [];
      seen.add(value);
      return [{ value, label }];
    });
  }, [masterFarms]);

  const selectedVehicleLabel = selectedOptionLabel(vehicleOptions, vehicle, vehicle);
  const selectedSupervisorLabel = selectedOptionLabel(supervisorOptions, supervisor, supervisor);
  const selectedFarmLabel = selectedOptionLabel(farmOptions, farm, farm);

  // The full matching result is held locally so visible filters stay reliable
  // even against API versions that ignore a filter query parameter.
  const completedTrips = useMemo(
    () => filterTripListTrips(uniqueTripsById(Array.isArray(trips) ? trips : []), { search }),
    [trips, search],
  );

  const hasFilters =
    search.trim() !== "" ||
    vehicle !== ALL_VEHICLES ||
    supervisor !== ALL_SUPERVISORS ||
    farm !== ALL_SOURCES ||
    fromDate !== "" ||
    toDate !== "";

  const totals = useMemo(() => ({
    totalCompletedTrips: completedTrips.length,
    totalCompletedShops: completedTrips.reduce((sum, trip) => sum + trip.totalShops, 0),
    totalCompletedBirds: completedTrips.reduce((sum, trip) => sum + trip.totalBirds, 0),
    totalCompletedWeight: completedTrips.reduce((sum, trip) => sum + trip.totalWeight, 0),
    totalCompletedMortality: completedTrips.reduce((sum, trip) => sum + trip.totalMortality, 0),
  }), [completedTrips]);

  // Load mix for the Total Trips KPI: how many filtered trips ran with one
  // load, two loads, or more — same load rule as the Trip List table.
  const loadBreakdown = useMemo(() => {
    const mix = { one: 0, two: 0, more: 0 };
    for (const trip of completedTrips) {
      const loads = Math.max(1, trip.submittedLoadCount ?? trip.loadSummaries?.length ?? 1);
      if (loads <= 1) mix.one += 1;
      else if (loads === 2) mix.two += 1;
      else mix.more += 1;
    }
    return mix;
  }, [completedTrips]);

  const {
    totalCompletedTrips,
    totalCompletedShops,
    totalCompletedBirds,
    totalCompletedWeight,
    totalCompletedMortality,
  } = totals;

  const paginatedTrips = useMemo(
    () => completedTrips.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [completedTrips, currentPage, pageSize],
  );

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(totalCompletedTrips / pageSize));
    if (currentPage <= maxPage) return;
    const timer = window.setTimeout(() => setCurrentPage(maxPage), 0);
    return () => window.clearTimeout(timer);
  }, [currentPage, pageSize, totalCompletedTrips]);

  const startEntry = totalCompletedTrips === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endEntry = Math.min(currentPage * pageSize, totalCompletedTrips);
  void startEntry;
  void endEntry;

  const openView = (trip: Trip) => {
    const requestSeq = viewRequestSeqRef.current + 1;
    viewRequestSeqRef.current = requestSeq;
    setSelectedTrip(trip);
    setViewOpen(true);
    setSelectedRowId(null);
    void loadTripById(trip.id)
      .then((loaded) => {
        if (requestSeq === viewRequestSeqRef.current) setSelectedTrip(loaded);
      })
      .catch(() => {
        if (requestSeq === viewRequestSeqRef.current) {
          showNotification(t("ops.trip.refresh_failed_using_cached"), "info");
        }
      });
  };

  /** Applies the explicit Trip List Sort By selection and reloads its rows. */
  const setFilterSort = useCallback((nextSortBy: TripSortKey | null, nextSortDir: "asc" | "desc") => {
    setFilterResultsReady(false);
    setSortBy(nextSortBy);
    setSortDir(nextSortBy ? nextSortDir : "asc");
    setCurrentPage(1);
  }, []);

  /** First click sorts ascending; second flips to descending; a third click on
   *  the active column clears the sort entirely (deselect). */
  const handleSortChange = (key: TripSortKey) => {
    if (sortBy !== key) {
      setFilterSort(key, "asc");
    } else if (sortDir === "asc") {
      setFilterSort(key, "desc");
    } else {
      setFilterSort(null, "asc");
    }
  };

  const handleRowClick = (trip: Trip) => {
    setSelectedRowId(trip.id === selectedRowId ? null : trip.id);
  };

  const handleViewSelected = () => {
    const trip = completedTrips.find((t) => t.id === selectedRowId);
    if (trip) {
      openView(trip);
    } else {
      showNotification(t("ops.trip.no_trip_selected"), "info");
    }
  };

  // `completedTrips` is already the full locally verified filtered result;
  // export it directly so exports always agree with the displayed filter total.
  const fetchAllFilteredTrips = useCallback(async (): Promise<Trip[]> => completedTrips, [completedTrips]);

  const handleExportPDF = async () => {
    if (exportBusyRef.current) return;
    exportBusyRef.current = "pdf";
    try {
      const exportData = await fetchAllFilteredTrips();
      if (!exportData || exportData.length === 0) {
        showNotification(t("ops.trip.no_data_export"), "error");
        return;
      }
      const headers = [
        t("operations.trip_no"),
        t("table.date"),
        t("common.vehicle"),
        t("common.driver"),
        t("common.supervisor"),
        t("ops.trip.source_farm"),
        t("ops.trip.shops"),
        t("common.birds"),
        t("ops.trip.weight_kg"),
      ];
      const rows = exportData.map((tripRecord) => [
        tripRecord.tripNo,
        tripRecord.tripDate,
        tripRecord.vehicleNo,
        tripRecord.driverName || "-",
        tripRecord.supervisorName,
        tripRecord.sourceFarm,
        tripRecord.totalShops.toString(),
        tripRecord.totalBirds.toString(),
        tripRecord.totalWeight.toFixed(2),
      ]);
      const filename = `Trips_${new Date().toISOString().split("T")[0]}`;

      // Report the filters actually in force, so the PDF is self-describing.
      const activeFilters = [
        fromDate || toDate
          ? { label: t("table.date"), value: `${fromDate || "..."} to ${toDate || "..."}` }
          : null,
        vehicle !== ALL_VEHICLES ? { label: t("common.vehicle"), value: selectedVehicleLabel } : null,
        supervisor !== ALL_SUPERVISORS ? { label: t("common.supervisor"), value: selectedSupervisorLabel } : null,
        farm !== ALL_SOURCES ? { label: t("ops.trip.source_farm"), value: selectedFarmLabel } : null,
      ].filter((filter): filter is { label: string; value: string } => filter !== null);

      exportToPDF(t("ops.trip.trip_list"), headers, rows, filename, {
        filters: activeFilters.length
          ? activeFilters
          : [{ label: t("common.filter"), value: t("common.all") }],
        summary: [
          { label: t("ops.trip.total_trips"), value: String(exportData.length) },
          { label: t("ops.trip.total_shops"), value: String(exportData.reduce((n, tripRecord) => n + tripRecord.totalShops, 0)) },
          { label: t("common.birds"), value: exportData.reduce((n, tripRecord) => n + tripRecord.totalBirds, 0).toLocaleString() },
          { label: t("ops.trip.weight_kg"), value: exportData.reduce((n, tripRecord) => n + tripRecord.totalWeight, 0).toFixed(2) },
          { label: t("operations.mortality_count"), value: String(exportData.reduce((n, tripRecord) => n + tripRecord.totalMortality, 0)) },
        ],
        numericColumns: [6, 7, 8],
      });
      showNotification(t("notification.export_success"), "success");
    } catch {
      showNotification(t("ops.trip.unable_load_trips"), "error");
    } finally {
      exportBusyRef.current = null;
    }
  };

  const handleExportExcel = async () => {
    if (exportBusyRef.current) return;
    exportBusyRef.current = "excel";
    try {
      const exportData = await fetchAllFilteredTrips();
      if (!exportData || exportData.length === 0) {
        showNotification(t("ops.trip.no_data_export"), "error");
        return;
      }
      const headers = [
        t("operations.trip_no"),
        t("table.date"),
        t("common.vehicle"),
        t("common.driver"),
        t("common.supervisor"),
        t("ops.trip.source_farm"),
        t("ops.trip.shops"),
        t("common.birds"),
        t("ops.trip.weight_kg"),
      ];
      const rows = exportData.map((tripRecord) => [
        tripRecord.tripNo,
        tripRecord.tripDate,
        tripRecord.vehicleNo,
        tripRecord.driverName || "-",
        tripRecord.supervisorName,
        tripRecord.sourceFarm,
        tripRecord.totalShops,
        tripRecord.totalBirds,
        tripRecord.totalWeight,
      ]);
      const filename = `Trips_${new Date().toISOString().split("T")[0]}`;
      exportToExcel(t("ops.trip.trip_list"), headers, rows, filename);
      showNotification(t("notification.export_success"), "success");
    } catch {
      showNotification(t("ops.trip.unable_load_trips"), "error");
    } finally {
      exportBusyRef.current = null;
    }
  };

  const handleRefreshClick = () => {
    setFilterResultsReady(false);
    void refreshTrips().then((ok) => {
      if (ok) showNotification(t("notification.data_refreshed"), "success");
    });
  };

  const handleResetFilters = () => {
    resetFilters();
    showNotification(t("ops.trip.filters_reset"), "info");
  };

  const content = (
    <div className={`w-full space-y-5 animate-in fade-in duration-200 ${
      embedded ? '' : 'px-3 md:px-6 py-4 bg-slate-50/50 min-h-screen text-slate-800'
    }`}>
      <TripFilters
        fromDate={fromDate}
        toDate={toDate}
        vehicle={vehicle}
        supervisor={supervisor}
        farm={farm}
        sortBy={sortBy}
        sortDir={sortDir}
        search={search}
        setFromDate={setFilterFromDate}
        setToDate={setFilterToDate}
        setVehicle={setFilterVehicle}
        setSupervisor={setFilterSupervisor}
        setFarm={setFilterFarm}
        setSort={setFilterSort}
        setSearch={setFilterSearch}
        onReset={handleResetFilters}
        vehicles={vehicleOptions}
        supervisors={supervisorOptions}
        farms={farmOptions}
        onExportPDF={() => void handleExportPDF()}
        onExportExcel={() => void handleExportExcel()}
        onRefresh={handleRefreshClick}
        onViewSelected={handleViewSelected}
        showViewButton={selectedRowId !== null}
        hasFilters={hasFilters}
        viewButtonRef={viewButtonRef}
      />

      {hasFilters && filterResultsReady && !isLoading && (
        <TripKPICards
          totalTrips={totalCompletedTrips}
          loadBreakdown={vehicle !== ALL_VEHICLES || supervisor !== ALL_SUPERVISORS ? loadBreakdown : undefined}
          totalBirds={totalCompletedBirds}
          totalWeight={totalCompletedWeight}
          totalMortality={totalCompletedMortality}
          totalShops={totalCompletedShops}
        />
      )}

      <div ref={tableContainerRef} className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden text-xs md:text-sm">
        {/* Header — neatly like Recent Trip Activity, same at top */}
        <div className="flex items-center px-6 py-3 border-b border-slate-100 bg-gradient-to-r from-blue-50/60 via-white to-blue-50/40">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-blue-50/70 border border-blue-100 flex items-center justify-center text-blue-500 shadow-inner">
              <History className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-800 tracking-tight">{t("ops.trip.trip_list")}</h3>
          </div>
        </div>

        <TripMasterTable
          trips={paginatedTrips}
          isLoading={isLoading}
          selectedRowId={selectedRowId}
          onRowClick={handleRowClick}
          onRowSelect={(trip) => setSelectedRowId(trip.id)}
          startIndex={(currentPage - 1) * pageSize}
          sortBy={sortBy}
          sortDir={sortDir}
          onSortChange={handleSortChange}
        />
        {shouldShowPagination(totalCompletedTrips) && (
          <Pagination
            page={currentPage}
            pageSize={pageSize}
            totalItems={totalCompletedTrips}
            onPageChange={setCurrentPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setCurrentPage(1);
            }}
          />
        )}
      </div>

      {viewOpen && (
        <TripViewModalWithMasters
          trip={selectedTrip}
          onClose={() => {
            viewRequestSeqRef.current += 1;
            setViewOpen(false);
            setSelectedTrip(null);
          }}
        />
      )}
    </div>
  );

  return content;
}

export default React.memo(TripListPage);