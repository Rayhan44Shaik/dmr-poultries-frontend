import useCompletedTrips from "../hooks/useCompletedTrips";
import CompletedTripsFilters from "../components/CompletedTripsFilters";
import CompletedTripsTable from "../components/CompletedTripsTable";
import EnterRateModal from "../components/EnterRateModal";
import TripPagination from "../../vehicle-trips/components/TripPagination";
import TripKPICards from "../../vehicle-trips/components/TripKPICards";
import { useSafeNotification } from "../../../../hooks/useSafeNotification";
import { exportToPDF, exportToExcel } from "../../../../utils/exportUtils";

type Props = {
  embedded?: boolean;
};

export default function RatesEntryPage({ embedded = false }: Props) {
  const { showNotification } = useSafeNotification();

  const {
    filteredTrips,
    paginatedTrips,
    currentPage,
    totalPages,
    setCurrentPage,
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
    loadError,
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

  const handleResetFilters = () => {
    resetFilters();
    showNotification("Filters have been reset.", "info");
  };

  const handleExportPDF = () => {
    if (filteredTrips.length === 0) {
      showNotification("No data to export.", "error");
      return;
    }
    const headers = ["Trip No", "Date", "Vehicle", "Supervisor", "Source Farm", "Shops", "Birds", "Weight (KG)"];
    const rows = filteredTrips.map((t) => [
      t.tripNo, t.tripDate, t.vehicleNo, t.supervisorName, t.sourceFarm,
      t.totalShops.toString(), t.totalBirds.toString(), t.totalWeight.toFixed(2),
    ]);
    const filename = `Rates_${new Date().toISOString().split("T")[0]}`;
    exportToPDF("Rates Entry Report", headers, rows, filename);
    showNotification("PDF exported successfully!", "success");
  };

  const handleExportExcel = () => {
    if (filteredTrips.length === 0) {
      showNotification("No data to export.", "error");
      return;
    }
    const headers = ["Trip No", "Date", "Vehicle", "Supervisor", "Source Farm", "Shops", "Birds", "Weight (KG)"];
    const rows = filteredTrips.map((t) => [
      t.tripNo, t.tripDate, t.vehicleNo, t.supervisorName, t.sourceFarm,
      t.totalShops, t.totalBirds, t.totalWeight,
    ]);
    const filename = `Rates_${new Date().toISOString().split("T")[0]}`;
    exportToExcel("Rates Entry Report", headers, rows, filename);
    showNotification("Excel exported successfully!", "success");
  };

  const content = (
    <div className="space-y-6">
      <CompletedTripsFilters
        fromDate={filter.fromDate}
        toDate={filter.toDate}
        tripNo={filter.tripNo}
        vehicle={filter.vehicle}
        supervisor={filter.supervisor}
        vehicleList={vehicleList}
        supervisorList={supervisorList}
        setFromDate={(value) => setFilter({ ...filter, fromDate: value })}
        setToDate={(value) => setFilter({ ...filter, toDate: value })}
        setTripNo={(value) => setFilter({ ...filter, tripNo: value })}
        setVehicle={(value) => setFilter({ ...filter, vehicle: value })}
        setSupervisor={(value) => setFilter({ ...filter, supervisor: value })}
        onSearch={() => setCurrentPage(1)}
        onReset={handleResetFilters}
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
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-10 text-center text-sm font-medium text-slate-500">
          No completed trips awaiting rate entry.
        </div>
      ) : (
        <CompletedTripsTable
          trips={paginatedTrips}
          onEnterRate={openRateEntry}
          onModifyRate={openModifyRate}
        />
      )}

      <TripPagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
      />

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