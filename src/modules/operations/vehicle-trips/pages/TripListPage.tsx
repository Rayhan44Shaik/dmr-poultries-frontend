// TripListPage.tsx – corrected

import React, { useState, useEffect, useRef } from "react";
import DashboardLayout from "../../../../layouts/DashboardLayout/DashboardLayout";

import useTrips from "../hooks/useTrips";
import TripFilters from "../components/TripFilters";
import TripKPICards from "../components/TripKPICards";
import TripMasterTable from "../components/TripMasterTable";
import TripPagination from "../components/TripPagination";
import TripViewModal from "../components/TripViewModal";

import { useSafeNotification } from "../../../../hooks/useSafeNotification";
import { exportToPDF, exportToExcel } from "../../../../utils/exportUtils";
import { useVehicles } from "../../../masters/vehicles/hooks/useVehicles";

import type { Trip } from "../types/trip";

type TripListPageProps = { embedded?: boolean };

function TripListPage({ embedded = false }: TripListPageProps) {
  const { showNotification } = useSafeNotification();

  const {
    trips,
    filteredTrips,
    currentPage,
    setCurrentPage,
    search,
    setSearch,
    vehicle,
    setVehicle,
    supervisor,
    setSupervisor,
    farm,
    setFarm,
    fromDate,
    setFromDate,
    toDate,
    setToDate,
    resetFilters,
    selectedTrip,
    setSelectedTrip,
    refreshTrips,
  } = useTrips(showNotification);

  useEffect(() => {
    refreshTrips();
  }, []);

  const [viewOpen, setViewOpen] = useState(false);
  const [selectedRowId, setSelectedRowId] = useState<number | null>(null);

  const tableContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        tableContainerRef.current &&
        !tableContainerRef.current.contains(event.target as Node)
      ) {
        setSelectedRowId(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const { vehicles: masterVehicles } = useVehicles();
  const vehicleOptions = [
    "All Vehicles",
    ...Array.from(new Set(masterVehicles.map((v) => v.vehicleNumber).filter(Boolean))),
  ];

  // ✅ FIX: Use filteredTrips (full list) instead of trips (paginated)
  const safeTrips = (Array.isArray(filteredTrips) && filteredTrips.length > 0)
    ? filteredTrips
    : (Array.isArray(trips) ? trips : []);

  const supervisorSet = new Set(safeTrips.map((t) => t.supervisorName).filter(Boolean));
  const farmSet = new Set(safeTrips.map((t) => t.sourceFarm).filter(Boolean));

  const supervisors = ["All Supervisors", ...Array.from(supervisorSet)];
  const farms = ["All Sources", ...Array.from(farmSet)];

  const completedTrips = safeTrips.filter((t) => t.status === "Completed");

  const hasFilters =
    search !== "" ||
    vehicle !== "All Vehicles" ||
    supervisor !== "All Supervisors" ||
    farm !== "All Sources" ||
    fromDate !== "" ||
    toDate !== "";

  const totalCompletedTrips = completedTrips.length;
  const totalCompletedShops = completedTrips.reduce((sum, t) => sum + t.totalShops, 0);
  const totalCompletedBirds = completedTrips.reduce((sum, t) => sum + t.totalBirds, 0);
  const totalCompletedWeight = completedTrips.reduce((sum, t) => sum + t.totalWeight, 0);
  const totalCompletedMortality = completedTrips.reduce((sum, t) => sum + t.totalMortality, 0);

  const pageSize = 15; // Show all trips on one page
  const totalPagesCompleted = Math.ceil(completedTrips.length / pageSize);
  const paginatedTrips = completedTrips.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const openView = (trip: Trip) => {
    setSelectedTrip(trip);
    setViewOpen(true);
    setSelectedRowId(null);
  };

  const handleRowClick = (trip: Trip) => {
    setSelectedRowId(trip.id === selectedRowId ? null : trip.id);
  };

  const handleViewSelected = () => {
    const trip = completedTrips.find((t) => t.id === selectedRowId);
    if (trip) openView(trip);
  };

  const handleExportPDF = () => {
    const exportData = filteredTrips && filteredTrips.length > 0 ? filteredTrips : completedTrips;
    if (!exportData || exportData.length === 0) {
      showNotification("No data to export.", "error");
      return;
    }
    const headers = [
      "Trip No",
      "Date",
      "Vehicle",
      "Driver",
      "Supervisor",
      "Source Farm",
      "Shops",
      "Birds",
      "Weight (kg)",
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
    exportToPDF("Trip List", headers, rows, filename);
  };

  const handleExportExcel = () => {
    const exportData = filteredTrips && filteredTrips.length > 0 ? filteredTrips : completedTrips;
    if (!exportData || exportData.length === 0) {
      showNotification("No data to export.", "error");
      return;
    }
    const headers = [
      "Trip No",
      "Date",
      "Vehicle",
      "Driver",
      "Supervisor",
      "Source Farm",
      "Shops",
      "Birds",
      "Weight (kg)",
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
    exportToExcel("Trip List", headers, rows, filename);
  };

  const content = (
    <div className="px-6 py-6 space-y-6">
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
        onReset={resetFilters}
        vehicles={vehicleOptions}
        supervisors={supervisors}
        farms={farms}
        onExportPDF={handleExportPDF}
        onExportExcel={handleExportExcel}
        onViewSelected={handleViewSelected}
        showViewButton={selectedRowId !== null}
        hasFilters={hasFilters}
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

      <div ref={tableContainerRef}>
        <TripMasterTable
          trips={paginatedTrips}
          selectedRowId={selectedRowId}
          onRowClick={handleRowClick}
          startIndex={(currentPage - 1) * pageSize}
        />
      </div>

      <TripPagination
        currentPage={currentPage}
        totalPages={totalPagesCompleted}
        onPageChange={setCurrentPage}
      />

      <TripViewModal
        open={viewOpen}
        trip={selectedTrip}
        onClose={() => {
          setViewOpen(false);
          setSelectedTrip(null);
        }}
      />
    </div>
  );

  if (embedded) return content;
  return <DashboardLayout>{content}</DashboardLayout>;
}

export default React.memo(TripListPage);