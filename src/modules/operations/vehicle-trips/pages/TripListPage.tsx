import React, { useState, useEffect, useRef, useCallback } from "react";
import TripFilters from "../components/TripFilters";
import TripKPICards from "../components/TripKPICards";
import TripMasterTable from "../components/TripMasterTable";
import TripViewModal from "../components/TripViewModal";
import { shouldShowPagination } from "../../../../shared/ui/paginationStyles";
import { Pagination } from "../../../../ui";
import { PAGINATION_DEFAULT_PAGE_SIZE } from "../../../../shared/ui/uiTokens";

import { useSafeNotification } from "../../../../hooks/useSafeNotification";
import { exportToPDF, exportToExcel } from "../../../../utils/exportUtils";
import { useVehicles } from "../../../masters/vehicles/hooks/useVehicles";
import { useShops } from "../../../masters/shops/hooks/useShops";
import { useBirdTypes } from "../../../masters/bird-types/hooks/useBirdTypes";

import type { Trip } from "../types/trip";
import { listCompletedTrips, loadTripById, type PaginatedTripListResult } from "../services/tripHeaderApiService";
import { useI18n } from "../../../../i18n";

type TripListPageProps = { embedded?: boolean };

function TripListPage({ embedded = false }: TripListPageProps) {
  const { t } = useI18n();
  const { showNotification } = useSafeNotification();

  const [trips, setTrips] = useState<Trip[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalTrips, setTotalTrips] = useState(0);
  const [, setIsLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [vehicle, setVehicle] = useState("All Vehicles");
  const [supervisor, setSupervisor] = useState("All Supervisors");
  const [farm, setFarm] = useState("All Sources");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [pageSize, setPageSize] = useState(PAGINATION_DEFAULT_PAGE_SIZE);

  const refreshTrips = useCallback(async () => {
    setIsLoading(true);
    try {
      const result: PaginatedTripListResult = await listCompletedTrips({
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        vehicleId: vehicle !== "All Vehicles" ? Number(vehicle) : undefined,
        supervisorId: supervisor !== "All Supervisors" ? Number(supervisor) : undefined,
        farmId: farm !== "All Sources" ? Number(farm) : undefined,
        search: search || undefined,
        page: currentPage,
        limit: pageSize,
      });
      setTrips(result.data);
      setTotalTrips(result.meta.total);
    } catch {
      showNotification(t("ops.trip.unable_load_trips"), "error");
    } finally {
      setIsLoading(false);
    }
  }, [showNotification, t, currentPage, pageSize, fromDate, toDate, vehicle, supervisor, farm, search]);

  useEffect(() => {
    void refreshTrips();
  }, [refreshTrips]);

  const resetFilters = () => {
    setSearch("");
    setVehicle("All Vehicles");
    setSupervisor("All Supervisors");
    setFarm("All Sources");
    setFromDate("");
    setToDate("");
    setCurrentPage(1);
  };


  const [viewOpen, setViewOpen] = useState(false);
  const [selectedRowId, setSelectedRowId] = useState<number | null>(null);

  const tableContainerRef = useRef<HTMLDivElement>(null);
  const viewButtonRef = useRef<HTMLButtonElement>(null);

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

  const { vehicles: masterVehicles } = useVehicles();
  const { shops } = useShops();
  const { birdTypes } = useBirdTypes();

  const vehicleOptions = [
    "All Vehicles",
    ...Array.from(new Set(masterVehicles.map((v) => v.vehicleNumber).filter(Boolean))),
  ];

  // Server-side pagination - trips are already filtered and paginated by the API
  const safeTrips = Array.isArray(trips) ? trips : [];
  const completedTrips = safeTrips;

  const hasFilters =
    search !== "" ||
    vehicle !== "All Vehicles" ||
    supervisor !== "All Supervisors" ||
    farm !== "All Sources" ||
    fromDate !== "" ||
    toDate !== "";

  const totalCompletedTrips = totalTrips;
  const totalCompletedShops = completedTrips.reduce((sum, t) => sum + t.totalShops, 0);
  const totalCompletedBirds = completedTrips.reduce((sum, t) => sum + t.totalBirds, 0);
  const totalCompletedWeight = completedTrips.reduce((sum, t) => sum + t.totalWeight, 0);
  const totalCompletedMortality = completedTrips.reduce((sum, t) => sum + t.totalMortality, 0);

  const paginatedTrips = completedTrips;

  const startEntry = totalCompletedTrips === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endEntry = Math.min(currentPage * pageSize, totalCompletedTrips);
  void startEntry;
  void endEntry;

  const openView = (trip: Trip) => {
    setSelectedTrip(trip);
    setViewOpen(true);
    setSelectedRowId(null);
    void loadTripById(trip.id)
      .then((loaded) => setSelectedTrip(loaded))
      .catch(() => {
        showNotification(t("ops.trip.refresh_failed_using_cached"), "info");
      });
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

  const handleExportPDF = async () => {
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
    const rows = exportData.map((t) => [
      t.tripNo,
      t.tripDate,
      t.vehicleNo,
      t.driverName || "-",
      t.supervisorName,
      t.sourceFarm,
      t.totalShops.toString(),
      t.totalBirds.toString(),
      t.totalWeight.toFixed(2),
    ]);
    const filename = `Trips_${new Date().toISOString().split("T")[0]}`;

    // Report the filters actually in force, so the PDF is self-describing.
    const activeFilters = [
      fromDate || toDate
        ? { label: t("table.date"), value: `${fromDate || "..."} to ${toDate || "..."}` }
        : null,
      vehicle !== "All Vehicles" ? { label: t("common.vehicle"), value: vehicle } : null,
      supervisor !== "All Supervisors" ? { label: t("common.supervisor"), value: supervisor } : null,
      farm !== "All Sources" ? { label: t("ops.trip.source_farm"), value: farm } : null,
      search ? { label: t("common.search"), value: search } : null,
    ].filter((f): f is { label: string; value: string } => f !== null);

    exportToPDF(t("ops.trip.trip_list"), headers, rows, filename, {
      filters: activeFilters.length
        ? activeFilters
        : [{ label: t("common.filter"), value: t("common.all") }],
      summary: [
        { label: t("ops.trip.total_trips"), value: String(exportData.length) },
        { label: t("ops.trip.total_shops"), value: String(exportData.reduce((n, r) => n + r.totalShops, 0)) },
        { label: t("common.birds"), value: exportData.reduce((n, r) => n + r.totalBirds, 0).toLocaleString() },
        { label: t("ops.trip.weight_kg"), value: exportData.reduce((n, r) => n + r.totalWeight, 0).toFixed(2) },
        { label: t("operations.mortality_count"), value: String(exportData.reduce((n, r) => n + r.totalMortality, 0)) },
      ],
      numericColumns: [6, 7, 8],
    });
    showNotification(t("notification.export_success"), "success");
  };

  const handleExportExcel = async () => {
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
    const rows = exportData.map((t) => [
      t.tripNo,
      t.tripDate,
      t.vehicleNo,
      t.driverName || "-",
      t.supervisorName,
      t.sourceFarm,
      t.totalShops,
      t.totalBirds,
      t.totalWeight,
    ]);
    const filename = `Trips_${new Date().toISOString().split("T")[0]}`;
    exportToExcel(t("ops.trip.trip_list"), headers, rows, filename);
    showNotification(t("notification.export_success"), "success");
  };

  const fetchAllFilteredTrips = useCallback(async (): Promise<Trip[]> => {
    const result = await listCompletedTrips({
      fromDate: fromDate || undefined,
      toDate: toDate || undefined,
      vehicleId: vehicle !== "All Vehicles" ? Number(vehicle) : undefined,
      supervisorId: supervisor !== "All Supervisors" ? Number(supervisor) : undefined,
      farmId: farm !== "All Sources" ? Number(farm) : undefined,
      search: search || undefined,
      page: 1,
      limit: Math.max(totalTrips, 1),
    });
    return result.data;
  }, [fromDate, toDate, vehicle, supervisor, farm, search, totalTrips]);

  const handleRefreshClick = () => {
    void refreshTrips();
    showNotification(t("notification.data_refreshed"), "success");
  };

  const handleResetFilters = () => {
    resetFilters();
    showNotification(t("ops.trip.filters_reset"), "info");
  };

  const content = (
    <div className={`w-full space-y-5 animate-in fade-in duration-500 ${
      embedded ? '' : 'px-3 md:px-6 py-4 bg-slate-50/50 min-h-screen text-slate-800'
    }`}>
      <TripFilters
        fromDate={fromDate}
        toDate={toDate}
        vehicle={vehicle}
        supervisor={supervisor}
        farm={farm}
        search={search}
        setFromDate={setFromDate}
        setToDate={setToDate}
        setVehicle={setVehicle}
        setSupervisor={setSupervisor}
        setFarm={setFarm}
        setSearch={setSearch}
        onSearch={() => {}}
        onReset={handleResetFilters}
        vehicles={vehicleOptions}
        supervisors={[]}
        farms={[]}
        onExportPDF={() => void handleExportPDF()}
        onExportExcel={() => void handleExportExcel()}
        onRefresh={handleRefreshClick}
        onViewSelected={handleViewSelected}
        showViewButton={selectedRowId !== null}
        hasFilters={hasFilters}
        viewButtonRef={viewButtonRef}
      />

      {hasFilters && (
        <TripKPICards
          totalTrips={totalCompletedTrips}
          totalBirds={totalCompletedBirds}
          totalWeight={totalCompletedWeight}
          totalMortality={totalCompletedMortality}
          totalShops={totalCompletedShops}
        />
      )}

      <div ref={tableContainerRef} className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden text-xs md:text-sm">
        <TripMasterTable
          trips={paginatedTrips}
          selectedRowId={selectedRowId}
          onRowClick={handleRowClick}
          startIndex={(currentPage - 1) * pageSize}
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

      <TripViewModal
        open={viewOpen}
        trip={selectedTrip}
        shops={shops}
        birdTypes={birdTypes}
        onClose={() => {
          setViewOpen(false);
          setSelectedTrip(null);
        }}
      />
    </div>
  );

  return content;
}

export default React.memo(TripListPage);