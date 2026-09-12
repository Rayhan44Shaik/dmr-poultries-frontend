import { useRef } from "react";
import useCompletedTrips from "../hooks/useCompletedTrips";
import CompletedTripsFilters from "../components/CompletedTripsFilters";
import CompletedTripsTable from "../components/CompletedTripsTable";
import EnterRateModal from "../components/EnterRateModal";
import { Pagination } from "../../../../ui/Pagination";
import { shouldShowPagination } from "../../../../shared/ui/paginationStyles";
import TripKPICards from "../../vehicle-trips/components/TripKPICards";
import { useSafeNotification } from "../../../../hooks/useSafeNotification";
import { exportToPDF, exportToExcel } from "../../../../utils/exportUtils";
import { opsPageClass, opsEmptyStateClass } from "../../../../shared/ui/operationsStyles";
import { formatTripListDay } from "../../vehicle-trips/utils/formatTripListDay";
import { formatVehicleNumber } from "../../../../utils/format";
import { useI18n } from "../../../../i18n";

type Props = {
  embedded?: boolean;
};

export default function RatesEntryPage({ embedded = false }: Props) {
  void embedded;
  const { t } = useI18n();
  const { showNotification } = useSafeNotification();
  const exportBusyRef = useRef<"pdf" | "excel" | null>(null);

  const {
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
  } = useCompletedTrips();

  const hasFilters =
    filter.fromDate !== "" ||
    filter.toDate !== "" ||
    filter.tripNo !== "" ||
    filter.vehicle !== "" ||
    filter.supervisor !== "";

  const totalTrips = filteredTrips.length;
  const totalShops = filteredTrips.reduce((sum, trip) => sum + trip.totalShops, 0);
  const totalBirds = filteredTrips.reduce((sum, trip) => sum + trip.totalBirds, 0);
  const totalWeight = filteredTrips.reduce((sum, trip) => sum + trip.totalWeight, 0);
  const safeCurrentPage = Math.min(currentPage, Math.max(totalPages, 1));
  const startIndex = (safeCurrentPage - 1) * pageSize;

  const handleResetFilters = () => {
    resetFilters();
    showNotification("Filters have been reset.", "info");
  };

  const handleRefresh = () => {
    void loadTrips().then((ok) => {
      if (ok) showNotification(t("notification.data_refreshed"), "success");
    });
  };

  const handleExportPDF = () => {
    if (exportBusyRef.current) return;
    exportBusyRef.current = "pdf";
    try {
      if (filteredTrips.length === 0) {
        showNotification("No data to export.", "error");
        return;
      }
      const headers = ["Trip No", "Day", "Vehicle", "Supervisor", "Source Farm", "Shops", "Birds", "Weight (KG)"];
      const rows = filteredTrips.map((trip) => [
        trip.tripNo,
        formatTripListDay(trip.tripDate),
        formatVehicleNumber(trip.vehicleNo),
        trip.supervisorName,
        trip.sourceFarm,
        trip.totalShops.toString(),
        trip.totalBirds.toString(),
        trip.totalWeight.toFixed(2),
      ]);
      const filename = `Rates_${new Date().toISOString().split("T")[0]}`;
      exportToPDF("Rates Entry Report", headers, rows, filename);
      showNotification("PDF exported successfully!", "success");
    } catch {
      showNotification("Unable to export Rate Entry PDF.", "error");
    } finally {
      exportBusyRef.current = null;
    }
  };

  const handleExportExcel = () => {
    if (exportBusyRef.current) return;
    exportBusyRef.current = "excel";
    try {
      if (filteredTrips.length === 0) {
        showNotification("No data to export.", "error");
        return;
      }
      const headers = ["Trip No", "Day", "Vehicle", "Supervisor", "Source Farm", "Shops", "Birds", "Weight (KG)"];
      const rows = filteredTrips.map((trip) => [
        trip.tripNo,
        formatTripListDay(trip.tripDate),
        formatVehicleNumber(trip.vehicleNo),
        trip.supervisorName,
        trip.sourceFarm,
        trip.totalShops,
        trip.totalBirds,
        trip.totalWeight,
      ]);
      const filename = `Rates_${new Date().toISOString().split("T")[0]}`;
      exportToExcel("Rates Entry Report", headers, rows, filename);
      showNotification("Excel exported successfully!", "success");
    } catch {
      showNotification("Unable to export Rate Entry Excel.", "error");
    } finally {
      exportBusyRef.current = null;
    }
  };

  const content = (
    <div className={opsPageClass}>
      <CompletedTripsFilters
        fromDate={filter.fromDate}
        toDate={filter.toDate}
        tripNo={filter.tripNo}
        vehicle={filter.vehicle}
        supervisor={filter.supervisor}
        vehicleList={vehicleList}
        supervisorList={supervisorList}
        setFromDate={(value) => setFilter({ fromDate: value })}
        setToDate={(value) => setFilter({ toDate: value })}
        setTripNo={(value) => setFilter({ tripNo: value })}
        setVehicle={(value) => setFilter({ vehicle: value })}
        setSupervisor={(value) => setFilter({ supervisor: value })}
        onSearch={() => setCurrentPage(1)}
        onReset={handleResetFilters}
        onRefresh={handleRefresh}
        refreshing={isLoading}
        pendingTrips={filteredTrips.length}
        hasFilters={hasFilters}
        onExportPDF={handleExportPDF}
        onExportExcel={handleExportExcel}
      />

      {loadError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {loadError}
        </div>
      )}

      {hasFilters && (
        <TripKPICards
          totalTrips={totalTrips}
          totalBirds={totalBirds}
          totalWeight={totalWeight}
          totalMortality={0}
          totalShops={totalShops}
        />
      )}

      {filteredTrips.length === 0 && !loadError ? (
        <div className={opsEmptyStateClass}>
          No completed trips awaiting rate entry.
        </div>
      ) : (
        <CompletedTripsTable
          trips={paginatedTrips}
          onEnterRate={openRateEntry}
          onModifyRate={openModifyRate}
          startIndex={startIndex}
          sortBy={sortBy}
          sortDir={sortDir}
          onSortChange={handleSortChange}
        >
          {shouldShowPagination(filteredTrips.length) && (
            <Pagination
              page={safeCurrentPage}
              pageSize={pageSize}
              totalItems={filteredTrips.length}
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
              disabled={isLoading}
            />
          )}
        </CompletedTripsTable>
      )}

      <EnterRateModal
        open={modalOpen}
        trip={selectedTrip}
        onClose={closeRateEntry}
        onSave={saveTrip}
        onSaveAndLock={saveAndLockTrip}
        isSaving={isSaving}
        loadError={loadError}
      />
    </div>
  );

  return content;
}
