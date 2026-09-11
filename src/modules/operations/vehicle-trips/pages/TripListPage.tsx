import React, { useState, useEffect, useRef, useCallback } from "react";
import TripFilters from "../components/TripFilters";
import TripKPICards from "../components/TripKPICards";
import TripMasterTable from "../components/TripMasterTable";
import TripViewModal from "../components/TripViewModal";
import {
  paginationBarClass,
  paginationNavBtnClass,
  paginationPageBtnClass,
  shouldShowPagination,
} from "../../../../shared/ui/paginationStyles";

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
  const [totalPages, setTotalPages] = useState(1);
  const [totalTrips, setTotalTrips] = useState(0);
  const [search, setSearch] = useState("");
  const [vehicle, setVehicle] = useState("All Vehicles");
  const [supervisor, setSupervisor] = useState("All Supervisors");
  const [farm, setFarm] = useState("All Sources");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const pageSize = 15;

  const refreshTrips = useCallback(async () => {
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
      setTotalPages(result.meta.totalPages);
      setTotalTrips(result.meta.total);
    } catch {
      showNotification(t("ops.trip.unable_load_trips"), "error");
    }
  }, [showNotification, t, currentPage, pageSize, fromDate, toDate, vehicle, supervisor, farm, search]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => { if (!cancelled) void refreshTrips(); });
    return () => { cancelled = true; };
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

  const totalPagesCompleted = totalPages;
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

  const handleExportPDF = () => {
    const exportData = completedTrips;
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
    exportToPDF(t("ops.trip.trip_list"), headers, rows, filename);
    showNotification(t("notification.export_success"), "success");
  };

  const handleExportExcel = () => {
    const exportData = completedTrips;
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
        onExportPDF={handleExportPDF}
        onExportExcel={handleExportExcel}
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
        <div className={paginationBarClass}>
          <button
            onClick={() => setCurrentPage(Math.max(currentPage - 1, 1))}
            disabled={currentPage === 1}
            className={paginationNavBtnClass}
          >
            {t("common.previous")}
          </button>
          {Array.from({ length: totalPagesCompleted }, (_, i) => i + 1).map((page) => (
            <button
              key={page}
              onClick={() => setCurrentPage(page)}
              className={paginationPageBtnClass(currentPage === page)}
            >
              {page}
            </button>
          ))}
          <button
            onClick={() => setCurrentPage(Math.min(currentPage + 1, totalPagesCompleted))}
            disabled={currentPage === totalPagesCompleted || totalPagesCompleted === 0}
            className={paginationNavBtnClass}
          >
            {t("common.next")}
          </button>
        </div>
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
