import React, { useState, useEffect, useRef } from "react";
import useTrips from "../hooks/useTrips";
import TripFilters from "../components/TripFilters";
import TripKPICards from "../components/TripKPICards";
import TripMasterTable from "../components/TripMasterTable";
import TripViewModal from "../components/TripViewModal";

import { useSafeNotification } from "../../../../hooks/useSafeNotification";
import { exportToPDF, exportToExcel } from "../../../../utils/exportUtils";
import { useVehicles } from "../../../masters/vehicles/hooks/useVehicles";
import { useShops } from "../../../masters/shops/hooks/useShops";
import { useBirdTypes } from "../../../masters/bird-types/hooks/useBirdTypes";

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

  const pageSize = 15;
  const totalPagesCompleted = Math.ceil(completedTrips.length / pageSize);
  const paginatedTrips = completedTrips.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const startEntry = totalCompletedTrips === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endEntry = Math.min(currentPage * pageSize, totalCompletedTrips);

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
    if (trip) {
      openView(trip);
    } else {
      showNotification("No trip selected or trip not found.", "info");
    }
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
    showNotification("PDF exported successfully!", "success");
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
    showNotification("Excel exported successfully!", "success");
  };

  const handleResetFilters = () => {
    resetFilters();
    showNotification("Filters have been reset.", "info");
  };

  const content = (
    <div className={`w-full space-y-4 animate-in fade-in duration-500 ${
      embedded ? '' : 'px-3 md:px-6 py-4 bg-slate-50/50 min-h-screen text-slate-800'
    }`}>
      <div className="bg-white rounded-2xl p-4 md:p-6 border border-slate-200/85 shadow-sm space-y-4 text-slate-800">
        
        <div>
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
            supervisors={supervisors}
            farms={farms}
            onExportPDF={handleExportPDF}
            onExportExcel={handleExportExcel}
            onViewSelected={handleViewSelected}
            showViewButton={selectedRowId !== null}
            hasFilters={hasFilters}
            viewButtonRef={viewButtonRef}
          />
        </div>

        {hasFilters && (
          <div>
            <TripKPICards
              totalTrips={totalCompletedTrips}
              totalBirds={totalCompletedBirds}
              totalWeight={totalCompletedWeight}
              totalMortality={totalCompletedMortality}
              totalShops={totalCompletedShops}
            />
          </div>
        )}

        <div ref={tableContainerRef} className="rounded-2xl border border-slate-200/70 overflow-hidden bg-white shadow-sm text-xs md:text-sm">
          <TripMasterTable
            trips={paginatedTrips}
            selectedRowId={selectedRowId}
            onRowClick={handleRowClick}
            startIndex={(currentPage - 1) * pageSize}
          />
        </div>

        <div className="pt-2 border-t border-slate-200/60 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-semibold text-slate-500">
          <div>
            <div>
              Showing <span className="font-bold text-slate-700">{startEntry}&ndash;{endEntry}</span> of <span className="font-bold text-slate-700">{totalCompletedTrips}</span> entries
            </div>
          </div>
          <div className="inline-flex items-center gap-1 bg-white border border-slate-200/80 rounded-xl px-2 py-1.5 shadow-2xs">
            <button
              onClick={() => setCurrentPage(Math.max(currentPage - 1, 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            {Array.from({ length: totalPagesCompleted }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${
                  currentPage === page
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {page}
              </button>
            ))}
            <button
              onClick={() => setCurrentPage(Math.min(currentPage + 1, totalPagesCompleted))}
              disabled={currentPage === totalPagesCompleted || totalPagesCompleted === 0}
              className="px-3 py-1 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        </div>
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